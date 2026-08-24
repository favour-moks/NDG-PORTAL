import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseSpreadsheet, TEMPLATE_COLUMNS } from './parse'

async function buildWorkbookBuffer(
  rows: string[][],
  options: { accountNumberAsNumber?: boolean } = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRow([...TEMPLATE_COLUMNS])

  const accountNumberColIndex = TEMPLATE_COLUMNS.indexOf('Account Number') + 1

  for (const row of rows) {
    const addedRow = sheet.addRow(row)
    if (options.accountNumberAsNumber) {
      const cell = addedRow.getCell(accountNumberColIndex)
      cell.value = Number(cell.value)
    } else {
      const cell = addedRow.getCell(accountNumberColIndex)
      cell.numFmt = '@'
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe('parseSpreadsheet (xlsx)', () => {
  it('parses rows with the leading zero intact when the column is text-formatted', async () => {
    const buffer = await buildWorkbookBuffer([
      ['Ada Obi', 'ADA OBI', '0033558463', 'GTBank', '', '12345678901'],
    ])
    const result = await parseSpreadsheet(buffer, 'test.xlsx')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]['Account Number']).toBe('0033558463')
    }
  })

  it('reflects a lost leading zero when the account number was stored as a number', async () => {
    const buffer = await buildWorkbookBuffer(
      [['Ada Obi', 'ADA OBI', '0033558463', 'GTBank', '', '12345678901']],
      { accountNumberAsNumber: true }
    )
    const result = await parseSpreadsheet(buffer, 'test.xlsx')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // The zero is genuinely gone once Excel stores it as a number — parse.ts
      // must not try to recover it. Rejecting this is validate.ts's job.
      expect(result.rows[0]['Account Number']).toBe('33558463')
    }
  })

  it('skips fully blank rows', async () => {
    const buffer = await buildWorkbookBuffer([
      ['Ada Obi', 'ADA OBI', '0033558463', 'GTBank', '', '12345678901'],
      ['', '', '', '', '', ''],
    ])
    const result = await parseSpreadsheet(buffer, 'test.xlsx')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rows).toHaveLength(1)
  })

  it('rejects a workbook missing required columns, naming them', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sheet1')
    sheet.addRow(['Full Name', 'Account Number'])
    sheet.addRow(['Ada Obi', '0033558463'])
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await parseSpreadsheet(buffer, 'test.xlsx')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missingColumns).toContain('Account Name')
      expect(result.missingColumns).toContain('Bank Name')
    }
  })
})

describe('parseSpreadsheet (csv)', () => {
  it('parses a well-formed csv', async () => {
    const csv = [
      TEMPLATE_COLUMNS.join(','),
      'Ada Obi,ADA OBI,0033558463,GTBank,,12345678901',
    ].join('\n')
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf-8'), 'test.csv')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]['Account Number']).toBe('0033558463')
    }
  })

  it('rejects a csv missing required columns, naming them', async () => {
    const csv = ['Full Name,Account Number', 'Ada Obi,0033558463'].join('\n')
    const result = await parseSpreadsheet(Buffer.from(csv, 'utf-8'), 'test.csv')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missingColumns).toContain('Bank Name')
    }
  })
})
