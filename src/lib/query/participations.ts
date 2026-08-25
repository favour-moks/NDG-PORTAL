import { requireSession } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { logAccess } from '@/lib/audit/log'
import { applyKeysetCursor, decodeCursor, encodeCursor } from './keyset'

const PAGE_SIZE = 50

export type PaymentStatusFilter = 'all' | 'paid' | 'in_progress' | 'pending'
export type AccreditationFilter = 'all' | 'accredited' | 'not_accredited'

export type ParticipationFilters = {
  editionId: string
  categoryId?: string
  stateId?: string
  sportId?: string
  committeeId?: string
  bankId?: string
  accreditation?: AccreditationFilter
  paymentStatus?: PaymentStatusFilter
  payable?: boolean
  q?: string
}

// The row shape is the union of both views' columns — callers narrow by
// checking which fields are present (editor-only fields are simply absent
// for a viewer, never present-but-empty, since the query never selects
// them for that role in the first place).
export type ParticipationListRow = {
  id: string
  full_name: string | null
  category_name: string | null
  state_name: string | null
  sport_name: string | null
  bank_name: string | null
  bank_id: string | null
  pre_games_accredited: boolean | null
  arrival_accredited: boolean | null
  is_payable: boolean | null
  payment_status: string | null
  committee_name?: string | null
  account_name?: string | null
  account_number?: string | null
  amount_paid?: number | null
  balance?: number | null
  entitlement_amount?: number | null
}

export type ParticipationsPage = {
  rows: ParticipationListRow[]
  nextCursor: string | null
  totalCount: number
}

// Mirrors the keys nuqs's useFilterState manages client-side (category is
// always a route param, never a filter; state is a route param on the
// participants screens but a genuine ?state= filter on DRM, which spans
// every state for one category — fixed.stateId wins when a screen pins
// it). Reading them here as plain strings — rather than importing nuqs's
// parsers into a Server Component — is deliberate: this is the one place
// a page needs to turn ?sport=x&accreditation=y into the object
// listParticipations expects, and plain string parsing needs no client
// boundary.
export function parseFiltersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  fixed: { editionId: string; categoryId?: string; stateId?: string; committeeId?: string }
): ParticipationFilters {
  const get = (key: string): string | undefined => {
    const value = searchParams[key]
    return Array.isArray(value) ? value[0] : value
  }

  return {
    editionId: fixed.editionId,
    categoryId: fixed.categoryId,
    stateId: fixed.stateId ?? get('state'),
    committeeId: fixed.committeeId ?? get('committee'),
    sportId: get('sport'),
    bankId: get('bank'),
    accreditation: (get('accreditation') as AccreditationFilter) || undefined,
    paymentStatus: (get('paymentStatus') as PaymentStatusFilter) || undefined,
    q: get('q'),
  }
}

const EDITOR_COLUMNS =
  'id, full_name, category_name, state_name, sport_name, bank_name, bank_id, pre_games_accredited, arrival_accredited, is_payable, payment_status, committee_name, account_name, account_number, amount_paid, balance, entitlement_amount'
const VIEWER_COLUMNS =
  'id, full_name, category_name, state_name, sport_name, bank_name, bank_id, pre_games_accredited, arrival_accredited, is_payable, payment_status'

// One function, one shape: { filters, cursor } -> { rows, nextCursor,
// totalCount }. The view is chosen from the session role, never from a
// parameter — a viewer must never be able to request participations_v
// (RLS would still scope the rows correctly, but the view is what hides
// the money columns, and that choice can't be client-influenced).
// totalCount is computed from this exact same filtered query (via
// count: 'exact', head: true, which returns a row count without actually
// fetching rows, so it isn't subject to the 1,000-row default cap) —
// that's what guarantees list count and export count always agree.
export async function listParticipations(
  filters: ParticipationFilters,
  cursorParam: string | null,
  pageSize: number = PAGE_SIZE,
  // fetchAllParticipations() (exports) calls this in a loop purely to
  // page through rows it already logs once as a single 'export' row —
  // without this, one export would also emit a 'list' row per 1,000-row
  // page it paginated through, which is log noise, not a second read.
  skipAudit = false
): Promise<ParticipationsPage> {
  const profile = await requireSession()
  const supabase = await createClient()
  const isViewer = profile.role === 'viewer'
  const viewName = isViewer ? 'participations_viewer_v' : 'participations_v'
  const columns = isViewer ? VIEWER_COLUMNS : EDITOR_COLUMNS

  // supabase-js's generated filter-builder type constrains .eq()'s column
  // argument to a literal union per table/view, which makes a genuinely
  // generic "apply these filters" helper impossible to type cleanly. This
  // narrow structural type covers exactly the methods used below and is
  // applied once at the boundary, rather than fighting the generated
  // types throughout — the runtime behaviour (a normal PostgREST query
  // builder) is unaffected either way.
  type FilterQuery = {
    eq: (column: string, value: unknown) => FilterQuery
    ilike: (column: string, pattern: string) => FilterQuery
    or: (filters: string) => FilterQuery
    order: (column: string, options?: { ascending?: boolean }) => FilterQuery
    limit: (count: number) => FilterQuery
    then: PromiseLike<{ data: unknown; error: unknown; count: number | null }>['then']
  }

  function applyFilters(query: FilterQuery): FilterQuery {
    let q = query.eq('edition_id', filters.editionId)
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId)
    if (filters.stateId) q = q.eq('state_id', filters.stateId)
    if (filters.sportId) q = q.eq('sport_id', filters.sportId)
    if (filters.committeeId) q = q.eq('committee_id', filters.committeeId)
    if (filters.bankId) q = q.eq('bank_id', filters.bankId)
    if (filters.accreditation === 'accredited') q = q.eq('arrival_accredited', true)
    if (filters.accreditation === 'not_accredited') q = q.eq('arrival_accredited', false)
    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      const label =
        filters.paymentStatus === 'paid'
          ? 'Paid'
          : filters.paymentStatus === 'in_progress'
            ? 'In Progress'
            : 'Pending'
      q = q.eq('payment_status', label)
    }
    if (typeof filters.payable === 'boolean') q = q.eq('is_payable', filters.payable)
    if (filters.q?.trim()) q = q.ilike('full_name', `%${filters.q.trim()}%`)
    return q
  }

  const countQuery = applyFilters(
    supabase.from(viewName).select('id', { count: 'exact', head: true }) as unknown as FilterQuery
  )
  const { count } = await countQuery

  const cursor = decodeCursor(cursorParam)
  const dataQuery = applyKeysetCursor(
    applyFilters(supabase.from(viewName).select(columns) as unknown as FilterQuery),
    cursor
  )
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .limit(pageSize)

  const { data, error } = await dataQuery
  if (error) {
    throw new Error('This list could not be loaded.')
  }

  const rows = (data ?? []) as unknown as ParticipationListRow[]
  const last = rows[rows.length - 1]
  const nextCursor =
    rows.length === pageSize && last?.full_name
      ? encodeCursor({ name: last.full_name, id: last.id })
      : null

  // FR-018: every beneficiary read is logged, not just exports — this is
  // the query every participants/personnel/DRM list ultimately goes
  // through, so logging it here covers all of them at once. Awaited (not
  // fire-and-forget): logAccess() already swallows its own errors so it
  // can't fail this request, but an un-awaited insert can be dropped
  // outright when a serverless function suspends right after returning.
  if (!skipAudit) {
    await logAccess({
      action: 'list',
      route: 'participations',
      editionId: filters.editionId,
      filters: filters as unknown as Record<string, unknown>,
      recordCount: count ?? 0,
    })
  }

  return { rows, nextCursor, totalCount: count ?? 0 }
}
