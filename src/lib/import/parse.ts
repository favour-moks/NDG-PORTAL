import ExcelJS from 'exceljs'
import Papa from 'papaparse'

// The upload form (edition, kind, category, state) supplies everything
// except per-person data, so the spreadsheet template only needs these six
// columns. Shared with the corrections export and the empty-state template
// download so all three stay in sync.
export const TEMPLATE_COLUMNS = [
  'Full Name',
  'Account Name',
  'Account Number',
  'Bank Name',
  'BVN',
  'NIN',
] as const

export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number]

export type ParsedRow = { rowNumber: number } & Record<TemplateColumn, string>

export type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; reason: string; missingColumns?: string[] }

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase()
}

function findMissingColumns(headers: string[]): string[] {
  const present = new Set(headers.map(normaliseHeader))
  return TEMPLATE_COLUMNS.filter((column) => !present.has(normaliseHeader(column)))
}

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParseResult> {
  return filename.toLowerCase().endsWith('.csv') ? parseCsv(buffer) : parseXlsx(buffer)
}

async function parseXlsx(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    // ArrayBuffer, not Buffer directly — exceljs's Node typings expect one.
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
  } catch {
    return { ok: false, reason: 'This file could not be read as an Excel spreadsheet.' }
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { ok: false, reason: 'The spreadsheet has no worksheet to import.' }
  }

  const headerRow = worksheet.getRow(1)
  const headers: string[] = []
  const columnIndexByName = new Map<TemplateColumn, number>()

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = String(cell.text ?? '').trim()
    headers.push(text)
    const match = TEMPLATE_COLUMNS.find((c) => normaliseHeader(c) === normaliseHeader(text))
    if (match) columnIndexByName.set(match, colNumber)
  })

  const missingColumns = findMissingColumns(headers)
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This file does not match the import template. Missing columns: ${missingColumns.join(', ')}.`,
      missingColumns,
    }
  }

  const rows: ParsedRow[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return

    const record = { rowNumber } as ParsedRow
    let hasAnyValue = false
    for (const column of TEMPLATE_COLUMNS) {
      const colIndex = columnIndexByName.get(column)
      const cell = colIndex ? row.getCell(colIndex) : undefined
      // .text reads the displayed form of the cell — for a text-formatted
      // cell that's the exact string (leading zeros intact); for a cell
      // Excel stored as a number, it's the number's text with whatever was
      // already lost. Either way this is the correct "read as text" step —
      // it never re-infers digits that aren't there.
      const value = cell ? String(cell.text ?? '').trim() : ''
      record[column] = value
      if (value.length > 0) hasAnyValue = true
    }
    if (hasAnyValue) rows.push(record)
  })

  return { ok: true, rows }
}

function parseCsv(buffer: Buffer): ParseResult {
  const text = decodeBuffer(buffer)
  if (text === null) {
    return {
      ok: false,
      reason:
        'This file could not be read — it may not be saved as UTF-8 text. Re-save the file as UTF-8 CSV and upload again.',
    }
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = parsed.meta.fields ?? []
  const missingColumns = findMissingColumns(headers)
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This file does not match the import template. Missing columns: ${missingColumns.join(', ')}.`,
      missingColumns,
    }
  }

  const headerByNormalised = new Map(headers.map((header) => [normaliseHeader(header), header]))

  const rows: ParsedRow[] = parsed.data
    .map((raw, index) => {
      const record = { rowNumber: index + 2 } as ParsedRow
      for (const column of TEMPLATE_COLUMNS) {
        const originalHeader = headerByNormalised.get(normaliseHeader(column))
        record[column] = originalHeader ? String(raw[originalHeader] ?? '').trim() : ''
      }
      return record
    })
    .filter((record) => TEMPLATE_COLUMNS.some((column) => record[column].length > 0))

  return { ok: true, rows }
}

function decodeBuffer(buffer: Buffer): string | null {
  const utf8 = buffer.toString('utf-8')
  if (!utf8.includes('�')) return utf8

  try {
    return new TextDecoder('windows-1252', { fatal: true }).decode(buffer)
  } catch {
    return null
  }
}
