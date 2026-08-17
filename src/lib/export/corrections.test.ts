import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { ParsedRow } from '@/lib/import/parse'
import type { RejectionReason } from '@/lib/import/validate'
import { buildCorrectionsWorkbook } from './corrections'

describe('buildCorrectionsWorkbook', () => {
  it('includes only rejected rows, with a combined reason and the leading zero intact', async () => {
    const rows: ParsedRow[] = [
      {
        rowNumber: 2,
        'Full Name': 'Ada Obi',
        'Account Name': 'ADA OBI',
        'Account Number': '0033558463',
        'Bank Name': 'GTBank',
        BVN: '',
        NIN: '', // rejected: neither identifier present
      },
      {
        rowNumber: 3,
        'Full Name': 'Chinedu Okafor',
        'Account Name': 'CHINEDU OKAFOR',
        'Account Number': '0011223344',
        'Bank Name': 'GTBank',
        BVN: '',
        NIN: '12345678901',
      },
    ] as ParsedRow[]

    const rejections: RejectionReason[] = [
      { row: 2, field: 'BVN / NIN', value: '', reason: 'At least one of BVN or NIN is required.' },
      { row: 2, field: 'Bank Name', value: 'GTBank', reason: 'placeholder second reason for row 2' },
    ]

    const buffer = await buildCorrectionsWorkbook(rows, rejections)

    const workbook = new ExcelJS.Workbook()
    // exceljs's bundled Buffer type predates @types/node's generic Buffer<T>
    // — a structural mismatch between library versions, not a real bug.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.worksheets[0]

    expect(sheet.rowCount).toBe(2) // header + one rejected row (row 3 excluded)

    const headerRow = sheet.getRow(1)
    expect(String(headerRow.getCell(7).text)).toBe('rejection_reason')

    const dataRow = sheet.getRow(2)
    expect(String(dataRow.getCell(1).text)).toBe('Ada Obi')
    expect(String(dataRow.getCell(3).text)).toBe('0033558463') // leading zero intact
    expect(String(dataRow.getCell(7).text)).toContain('BVN / NIN')
    expect(String(dataRow.getCell(7).text)).toContain('Bank Name')
  })
})
