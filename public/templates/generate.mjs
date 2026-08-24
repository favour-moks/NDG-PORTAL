// Regenerates public/templates/import-template.xlsx — the blank template
// offered from the Import screen's empty state. Run with:
//   node public/templates/generate.mjs
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'

const TEMPLATE_COLUMNS = ['Full Name', 'Account Name', 'Account Number', 'Bank Name', 'BVN', 'NIN']

const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('Import')
sheet.addRow(TEMPLATE_COLUMNS)
// Pre-format the Account Number column as text so anyone typing directly
// into the template doesn't lose leading zeros before it's even uploaded.
sheet.getColumn(TEMPLATE_COLUMNS.indexOf('Account Number') + 1).numFmt = '@'

const buffer = await workbook.xlsx.writeBuffer()
writeFileSync(new URL('./import-template.xlsx', import.meta.url), Buffer.from(buffer))
console.log('Wrote public/templates/import-template.xlsx')
