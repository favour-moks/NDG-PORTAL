import ExcelJS from 'exceljs'
import { TEMPLATE_COLUMNS, type ParsedRow } from '@/lib/import/parse'
import type { RejectionReason } from '@/lib/import/validate'

// Re-emits only the rejected rows, in the original template format, with a
// trailing rejection_reason column — so the file can be corrected and
// re-uploaded directly. Account numbers keep numFmt '@' (text), the same
// reason the import parser reads every cell as text in the first place.
export async function buildCorrectionsWorkbook(
  rows: ParsedRow[],
  rejections: RejectionReason[]
): Promise<Buffer> {
  const reasonsByRow = new Map<number, string[]>()
  for (const rejection of rejections) {
    const list = reasonsByRow.get(rejection.row) ?? []
    list.push(`${rejection.field}: ${rejection.reason}`)
    reasonsByRow.set(rejection.row, list)
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Corrections')
  sheet.addRow([...TEMPLATE_COLUMNS, 'rejection_reason'])

  const accountColIndex = TEMPLATE_COLUMNS.indexOf('Account Number') + 1

  for (const row of rows) {
    const reasons = reasonsByRow.get(row.rowNumber)
    if (!reasons) continue

    const values = TEMPLATE_COLUMNS.map((column) => row[column])
    const excelRow = sheet.addRow([...values, reasons.join('; ')])
    const accountCell = excelRow.getCell(accountColIndex)
    accountCell.numFmt = '@'
    accountCell.value = row['Account Number']
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
