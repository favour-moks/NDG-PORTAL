import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import type { Sql } from 'postgres'

// The payment partner's result-file format is unknown (PRD § 14 Q1, same
// open question as the disbursement file itself) — these are the columns
// we'd expect back given what the default disbursement format sends out
// (Reference echoes our TransID). Adjust here the moment a real result
// file is seen; the matching logic below doesn't change.
const REQUIRED_COLUMNS = ['Reference', 'Account Number', 'Amount', 'Status'] as const
const FAILURE_REASON_COLUMN = 'Failure Reason'

export type ResultRow = {
  rowNumber: number
  reference: string
  accountNumber: string
  amount: number
  status: string
  failureReason: string | null
}

export type ParseResultFileResult =
  | { ok: true; rows: ResultRow[] }
  | { ok: false; reason: string; missingColumns?: string[] }

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase()
}

export async function parseResultFile(buffer: Buffer, filename: string): Promise<ParseResultFileResult> {
  return filename.toLowerCase().endsWith('.csv') ? parseCsv(buffer) : parseXlsx(buffer)
}

async function parseXlsx(buffer: Buffer): Promise<ParseResultFileResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    )
  } catch {
    return { ok: false, reason: 'This file could not be read as an Excel spreadsheet.' }
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { ok: false, reason: 'The spreadsheet has no worksheet to import.' }
  }

  const colIndex = new Map<string, number>()
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    colIndex.set(normaliseHeader(String(cell.text ?? '').trim()), colNumber)
  })

  const missingColumns = REQUIRED_COLUMNS.filter((c) => !colIndex.has(normaliseHeader(c)))
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This file does not match the expected result format. Missing columns: ${missingColumns.join(', ')}.`,
      missingColumns,
    }
  }

  const rows: ResultRow[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (column: string): string => {
      const idx = colIndex.get(normaliseHeader(column))
      return idx ? String(row.getCell(idx).text ?? '').trim() : ''
    }
    const reference = get('Reference')
    const accountNumber = get('Account Number')
    const amountText = get('Amount')
    const status = get('Status')
    if (!reference && !accountNumber && !amountText && !status) return
    rows.push({
      rowNumber,
      reference,
      accountNumber,
      amount: Number(amountText.replace(/,/g, '')) || 0,
      status,
      failureReason: get(FAILURE_REASON_COLUMN) || null,
    })
  })

  return { ok: true, rows }
}

function parseCsv(buffer: Buffer): ParseResultFileResult {
  const text = buffer.toString('utf-8')
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  const headers = parsed.meta.fields ?? []

  const missingColumns = REQUIRED_COLUMNS.filter(
    (c) => !headers.some((h) => normaliseHeader(h) === normaliseHeader(c))
  )
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This file does not match the expected result format. Missing columns: ${missingColumns.join(', ')}.`,
      missingColumns,
    }
  }

  const headerByNormalised = new Map(headers.map((h) => [normaliseHeader(h), h]))
  const rows: ResultRow[] = parsed.data
    .map((raw, index) => {
      const get = (column: string): string => {
        const original = headerByNormalised.get(normaliseHeader(column))
        return original ? String(raw[original] ?? '').trim() : ''
      }
      const amountText = get('Amount')
      return {
        rowNumber: index + 2,
        reference: get('Reference'),
        accountNumber: get('Account Number'),
        amount: Number(amountText.replace(/,/g, '')) || 0,
        status: get('Status'),
        failureReason: get(FAILURE_REASON_COLUMN) || null,
      }
    })
    .filter((row) => row.reference || row.accountNumber || row.status)

  return { ok: true, rows }
}

function mapStatus(rawStatus: string): 'paid' | 'failed' | null {
  const normalised = rawStatus.trim().toLowerCase()
  if (['paid', 'successful', 'success'].includes(normalised)) return 'paid'
  if (['failed', 'failure', 'rejected', 'unsuccessful', 'declined'].includes(normalised)) return 'failed'
  return null
}

export type ResultException =
  | { rowNumber: number; kind: 'unmatched'; reference: string; accountNumber: string }
  | { rowNumber: number; kind: 'ambiguous'; reference: string; accountNumber: string; candidateCount: number }
  | { rowNumber: number; kind: 'unrecognized_status'; reference: string; status: string }

export type ApplyResultsSummary = {
  matched: number
  paid: number
  failed: number
  unmatched: number
  ambiguous: number
  exceptions: ResultException[]
}

type PaymentCandidate = { id: string }

// Match on partner_reference first — the transaction id we minted at
// generation time (generateBatch(), stored on payments.partner_reference)
// and expect the file to echo back — then fall back to account_number +
// amount, both scoped to this batch only (TASK-065: "statuses update only
// within the target batch"). A row matching nothing is reported, never
// guessed; a row matching more than one payment is reported as ambiguous
// and neither is touched — this is exactly the failure mode the current
// manual process loses records to (roadmap TASK-064).
export async function applyPaymentResults(
  sql: Sql,
  batchId: string,
  rows: ResultRow[]
): Promise<ApplyResultsSummary> {
  const exceptions: ResultException[] = []
  let paid = 0
  let failed = 0

  for (const row of rows) {
    const newStatus = mapStatus(row.status)
    if (!newStatus) {
      exceptions.push({ rowNumber: row.rowNumber, kind: 'unrecognized_status', reference: row.reference, status: row.status })
      continue
    }

    let candidates: PaymentCandidate[] = []
    if (row.reference) {
      candidates = await sql<PaymentCandidate[]>`
        select id from payments where batch_id = ${batchId} and partner_reference = ${row.reference}
      `
    }
    if (candidates.length === 0 && row.accountNumber) {
      candidates = await sql<PaymentCandidate[]>`
        select id from payments
        where batch_id = ${batchId} and account_number = ${row.accountNumber} and amount = ${row.amount}
      `
    }

    if (candidates.length === 0) {
      exceptions.push({
        rowNumber: row.rowNumber,
        kind: 'unmatched',
        reference: row.reference,
        accountNumber: row.accountNumber,
      })
      continue
    }
    if (candidates.length > 1) {
      exceptions.push({
        rowNumber: row.rowNumber,
        kind: 'ambiguous',
        reference: row.reference,
        accountNumber: row.accountNumber,
        candidateCount: candidates.length,
      })
      continue
    }

    await sql`
      update payments
      set status = ${newStatus}, failure_reason = ${newStatus === 'failed' ? row.failureReason : null},
          paid_at = ${newStatus === 'paid' ? sql`now()` : null}
      where id = ${candidates[0].id}
    `
    if (newStatus === 'paid') paid++
    else failed++
  }

  return {
    matched: paid + failed,
    paid,
    failed,
    unmatched: exceptions.filter((e) => e.kind === 'unmatched').length,
    ambiguous: exceptions.filter((e) => e.kind === 'ambiguous').length,
    exceptions,
  }
}
