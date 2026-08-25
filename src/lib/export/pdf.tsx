import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatNaira } from '@/lib/format/money'
import type { Role } from '@/lib/auth/guards'
import type { ParticipationListRow } from '@/lib/query/participations'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 12, marginBottom: 4 },
  disclaimer: { fontSize: 7, color: '#555555', marginBottom: 8 },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    fontSize: 7,
    color: '#555555',
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingVertical: 3,
    marginBottom: 2,
  },
  headerCell: { flexGrow: 1, flexBasis: 0, fontFamily: 'Helvetica-Bold', paddingHorizontal: 2 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingVertical: 2 },
  cell: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 2 },
})

type PdfColumn = { header: string; get: (row: ParticipationListRow) => string }

const yesNo = (value: boolean | null | undefined) => (value ? 'Yes' : 'No')
const dash = (value: string | null | undefined) => value ?? '—'

const BASE_COLUMNS: PdfColumn[] = [
  { header: 'Name', get: (r) => dash(r.full_name) },
  { header: 'Category', get: (r) => dash(r.category_name) },
  { header: 'State', get: (r) => dash(r.state_name) },
  { header: 'Sport', get: (r) => dash(r.sport_name) },
  { header: 'Bank', get: (r) => dash(r.bank_name) },
  { header: 'Accredited', get: (r) => yesNo(r.arrival_accredited) },
  { header: 'Status', get: (r) => dash(r.payment_status) },
]

const EDITOR_ONLY_COLUMNS: PdfColumn[] = [
  { header: 'Account no.', get: (r) => dash(r.account_number) },
  { header: 'Entitlement', get: (r) => formatNaira(r.entitlement_amount) },
  { header: 'Paid', get: (r) => formatNaira(r.amount_paid) },
  { header: 'Balance', get: (r) => formatNaira(r.balance) },
]

// DRM's fixed print set (TASK-055): name, account name/number, bank,
// state, sport, committee, accreditation status — no payment amounts.
const DRM_COLUMNS: PdfColumn[] = [
  { header: 'Name', get: (r) => dash(r.full_name) },
  { header: 'Account name', get: (r) => dash(r.account_name) },
  { header: 'Account number', get: (r) => dash(r.account_number) },
  { header: 'Bank', get: (r) => dash(r.bank_name) },
  { header: 'State', get: (r) => dash(r.state_name) },
  { header: 'Sport', get: (r) => dash(r.sport_name) },
  { header: 'Committee', get: (r) => dash(r.committee_name) },
  { header: 'Accreditation status', get: (r) => yesNo(r.arrival_accredited) },
]

// Pulled out of buildParticipationsPdf so the role-based column decision
// — the actual thing that keeps money out of a viewer's export — can be
// asserted directly in a test without parsing a compiled PDF buffer,
// which react-pdf's font/content-stream encoding makes an unreliable
// thing to substring-search (see tests/rls/viewer-financial.test.ts).
export function selectPdfColumns(role: Role, variant: 'standard' | 'drm' = 'standard'): PdfColumn[] {
  return variant === 'drm' ? DRM_COLUMNS : role === 'viewer' ? BASE_COLUMNS : [...BASE_COLUMNS, ...EDITOR_ONLY_COLUMNS]
}

// A single <Page> that overflows auto-splits into multiple rendered PDF
// pages; elements marked `fixed` (the title, disclaimer, header row, and
// page-number footer) repeat on every one of those pages for free — this
// is what satisfies "disclaimer on every page" (TASK-055) without any
// manual pagination bookkeeping.
export async function buildParticipationsPdf(
  rows: ParticipationListRow[],
  role: Role,
  title: string,
  disclaimer?: string,
  variant: 'standard' | 'drm' = 'standard'
): Promise<Buffer> {
  const columns = selectPdfColumns(role, variant)

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Text style={styles.title} fixed>
          {title}
        </Text>
        {disclaimer ? (
          <Text style={styles.disclaimer} fixed>
            {disclaimer}
          </Text>
        ) : null}

        <View style={styles.headerRow} fixed>
          {columns.map((column) => (
            <Text key={column.header} style={styles.headerCell}>
              {column.header}
            </Text>
          ))}
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            {columns.map((column) => (
              <Text key={column.header} style={styles.cell}>
                {column.get(row)}
              </Text>
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
