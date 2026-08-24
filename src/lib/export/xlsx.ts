import ExcelJS from 'exceljs'
import type { Role } from '@/lib/auth/guards'
import type { ParticipationListRow } from '@/lib/query/participations'

type Column = {
  header: string
  key: string
  width: number
  numFmt?: string
  get: (row: ParticipationListRow) => string | number
}

const yesNo = (value: boolean | null | undefined) => (value ? 'Yes' : 'No')
const dash = (value: string | null | undefined) => value ?? ''

const BASE_COLUMNS: Column[] = [
  { header: 'Name', key: 'full_name', width: 28, get: (r) => dash(r.full_name) },
  { header: 'Category', key: 'category_name', width: 18, get: (r) => dash(r.category_name) },
  { header: 'State', key: 'state_name', width: 14, get: (r) => dash(r.state_name) },
  { header: 'Sport', key: 'sport_name', width: 16, get: (r) => dash(r.sport_name) },
  { header: 'Committee', key: 'committee_name', width: 18, get: (r) => dash(r.committee_name) },
  { header: 'Bank', key: 'bank_name', width: 22, get: (r) => dash(r.bank_name) },
  {
    header: 'Arrival accredited',
    key: 'arrival_accredited',
    width: 16,
    get: (r) => yesNo(r.arrival_accredited),
  },
  { header: 'Payment status', key: 'payment_status', width: 16, get: (r) => dash(r.payment_status) },
]

const EDITOR_ONLY_COLUMNS: Column[] = [
  // '@' forces Excel to store this as text rather than a number — without
  // it, Excel silently drops the leading zeros from a 10-digit account
  // number the moment the file is opened.
  {
    header: 'Account number',
    key: 'account_number',
    width: 16,
    numFmt: '@',
    get: (r) => dash(r.account_number),
  },
  { header: 'Payable', key: 'is_payable', width: 12, get: (r) => (r.is_payable ? 'Payable' : 'Not payable') },
  {
    header: 'Entitlement (NGN)',
    key: 'entitlement_amount',
    width: 18,
    numFmt: '#,##0.00',
    get: (r) => r.entitlement_amount ?? 0,
  },
  { header: 'Paid (NGN)', key: 'amount_paid', width: 16, numFmt: '#,##0.00', get: (r) => r.amount_paid ?? 0 },
  { header: 'Balance (NGN)', key: 'balance', width: 16, numFmt: '#,##0.00', get: (r) => r.balance ?? 0 },
]

// DRM's print set (TASK-055) is fixed and deliberately narrower than the
// general editor export — name, account name/number, bank, state, sport,
// committee, accreditation status — no payment amounts, since the DRM is
// a disbursement sign-off document, not a reconciliation report.
const DRM_COLUMNS: Column[] = [
  { header: 'Name', key: 'full_name', width: 28, get: (r) => dash(r.full_name) },
  { header: 'Account name', key: 'account_name', width: 28, get: (r) => dash(r.account_name) },
  {
    header: 'Account number',
    key: 'account_number',
    width: 16,
    numFmt: '@',
    get: (r) => dash(r.account_number),
  },
  { header: 'Bank', key: 'bank_name', width: 22, get: (r) => dash(r.bank_name) },
  { header: 'State', key: 'state_name', width: 14, get: (r) => dash(r.state_name) },
  { header: 'Sport', key: 'sport_name', width: 16, get: (r) => dash(r.sport_name) },
  { header: 'Committee', key: 'committee_name', width: 18, get: (r) => dash(r.committee_name) },
  {
    header: 'Accreditation status',
    key: 'arrival_accredited',
    width: 18,
    get: (r) => yesNo(r.arrival_accredited),
  },
]

export async function buildParticipationsWorkbook(
  rows: ParticipationListRow[],
  role: Role,
  sheetName: string,
  variant: 'standard' | 'drm' = 'standard'
): Promise<ExcelJS.Buffer> {
  const columns =
    variant === 'drm' ? DRM_COLUMNS : role === 'viewer' ? BASE_COLUMNS : [...BASE_COLUMNS, ...EDITOR_ONLY_COLUMNS]

  const workbook = new ExcelJS.Workbook()
  // Excel hard-caps worksheet names at 31 characters.
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Export')
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }))

  for (const column of columns) {
    if (column.numFmt) {
      sheet.getColumn(column.key).numFmt = column.numFmt
    }
  }

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((column) => [column.key, column.get(row)])))
  }

  return workbook.xlsx.writeBuffer()
}
