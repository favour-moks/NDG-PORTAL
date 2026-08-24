import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { tableFeaturesConfig } from '@/components/features/table/tableFeatures'
import { formatNaira } from '@/lib/format/money'
import type { ParticipationListRow } from '@/lib/query/participations'

const helper = createColumnHelper<typeof tableFeaturesConfig, ParticipationListRow>()

const dash = (value: string | null | undefined) => value ?? '—'

// Each column's TValue is collapsed to `unknown` here (a cast, not a
// weaker definition — `cell`/`header` above still see the real, narrow
// TValue) so screens can freely mix columns into one array. Without this,
// TS treats ColumnDef<..., string | null> and ColumnDef<..., boolean> as
// unrelated types and rejects a heterogeneous array of them.
type Column = ColumnDef<typeof tableFeaturesConfig, ParticipationListRow, unknown>

// One column per field, defined once so every screen (participants,
// personnel, DRM) composes the same cell rendering instead of
// re-implementing it — the set of columns shown still varies per screen,
// only how each individual column renders is shared.
export const participationColumn = {
  fullName: helper.accessor('full_name', { header: 'Name', cell: (info) => dash(info.getValue()) }) as Column,
  category: helper.accessor('category_name', {
    header: 'Category',
    cell: (info) => dash(info.getValue()),
  }) as Column,
  state: helper.accessor('state_name', { header: 'State', cell: (info) => dash(info.getValue()) }) as Column,
  sport: helper.accessor('sport_name', { header: 'Sport', cell: (info) => dash(info.getValue()) }) as Column,
  committee: helper.accessor('committee_name', {
    header: 'Committee',
    cell: (info) => dash(info.getValue()),
  }) as Column,
  bank: helper.accessor('bank_name', { header: 'Bank', cell: (info) => dash(info.getValue()) }) as Column,
  preGamesAccredited: helper.accessor('pre_games_accredited', {
    header: 'Pre-games accredited',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }) as Column,
  arrivalAccredited: helper.accessor('arrival_accredited', {
    header: 'Arrival accredited',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }) as Column,
  paymentStatus: helper.accessor('payment_status', {
    header: 'Payment status',
    cell: (info) => dash(info.getValue()),
  }) as Column,
  isPayable: helper.accessor('is_payable', {
    header: 'Payable',
    cell: (info) => (info.getValue() ? 'Payable' : 'Not payable'),
  }) as Column,
  accountName: helper.accessor('account_name', {
    header: 'Account name',
    cell: (info) => dash(info.getValue()),
  }) as Column,
  accountNumber: helper.accessor('account_number', {
    header: 'Account number',
    cell: (info) => dash(info.getValue()),
  }) as Column,
  entitlementAmount: helper.accessor('entitlement_amount', {
    header: 'Entitlement',
    cell: (info) => formatNaira(info.getValue()),
  }) as Column,
  amountPaid: helper.accessor('amount_paid', {
    header: 'Paid',
    cell: (info) => formatNaira(info.getValue()),
  }) as Column,
  balance: helper.accessor('balance', {
    header: 'Balance',
    cell: (info) => formatNaira(info.getValue()),
  }) as Column,
}

export type ParticipationColumnKey = keyof typeof participationColumn
