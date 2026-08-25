import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildParticipationsWorkbook } from '@/lib/export/xlsx'
import { buildParticipationsPdf, selectPdfColumns } from '@/lib/export/pdf'
import type { ParticipationListRow } from '@/lib/query/participations'

// FR-013 / TASK-071: a viewer's export must never carry a monetary
// column, regardless of format. The DB-level guarantee lives in
// supabase/tests/rls_viewer.sql (information_schema assertion on
// participations_viewer_v, which needs a live Postgres and only runs in
// CI); this is the same guarantee at the export-building layer, which is
// pure enough to test without a database.
const MONEY_TERMS = ['entitlement', 'paid', 'balance', 'amount']

const sampleRow: ParticipationListRow = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Test Person',
  category_name: 'Athletes',
  state_name: 'Delta',
  sport_name: 'Basketball',
  bank_name: 'Test Bank',
  bank_id: '000013',
  pre_games_accredited: true,
  arrival_accredited: true,
  is_payable: true,
  payment_status: 'Paid',
  account_number: '0011223344',
  amount_paid: 5000,
  balance: 0,
  entitlement_amount: 5000,
}

describe('viewer exports carry no financial column', () => {
  it('xlsx: viewer workbook headers contain no money term; editor workbook does', async () => {
    const viewerBuffer = await buildParticipationsWorkbook([sampleRow], 'viewer', 'Test')
    const editorBuffer = await buildParticipationsWorkbook([sampleRow], 'editor', 'Test')

    const viewerWorkbook = new ExcelJS.Workbook()
    await viewerWorkbook.xlsx.load(viewerBuffer)
    const viewerHeaders = (viewerWorkbook.worksheets[0].getRow(1).values as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.toLowerCase())

    expect(viewerHeaders.some((h) => MONEY_TERMS.some((term) => h.includes(term)))).toBe(false)
    // Account number is not a money figure, but is still an editor-only
    // column — confirms the viewer sheet is genuinely narrower, not just
    // missing money-named columns by coincidence.
    expect(viewerHeaders.some((h) => h.includes('account'))).toBe(false)

    const editorWorkbook = new ExcelJS.Workbook()
    await editorWorkbook.xlsx.load(editorBuffer)
    const editorHeaders = (editorWorkbook.worksheets[0].getRow(1).values as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.toLowerCase())

    expect(editorHeaders.some((h) => h.includes('entitlement'))).toBe(true)
    expect(editorHeaders.some((h) => h.includes('paid'))).toBe(true)
    expect(editorHeaders.some((h) => h.includes('balance'))).toBe(true)
  })

  it('pdf: the viewer column set carries no money header, and generation succeeds for both roles', async () => {
    const viewerHeaders = selectPdfColumns('viewer').map((c) => c.header.toLowerCase())
    const editorHeaders = selectPdfColumns('editor').map((c) => c.header.toLowerCase())

    expect(viewerHeaders.some((h) => MONEY_TERMS.some((term) => h.includes(term)))).toBe(false)
    expect(viewerHeaders.some((h) => h.includes('account'))).toBe(false)
    expect(editorHeaders.some((h) => h.includes('entitlement'))).toBe(true)

    // Buffer parsing aside (react-pdf's content-stream encoding makes
    // substring search unreliable — see selectPdfColumns' comment),
    // generation itself must still succeed for a viewer without throwing.
    const viewerBuffer = await buildParticipationsPdf([sampleRow], 'viewer', 'Test')
    expect(viewerBuffer.byteLength).toBeGreaterThan(0)
  })
})
