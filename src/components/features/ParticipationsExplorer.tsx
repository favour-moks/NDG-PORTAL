'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/features/table/DataTable'
import { tableFeaturesConfig } from '@/components/features/table/tableFeatures'
import { participationColumn, type ParticipationColumnKey } from '@/components/features/participationColumns'
import { FilterBar, type FilterBarConfig } from '@/components/features/filters/FilterBar'
import { useFilterState } from '@/components/features/filters/useFilterState'
import type { ParticipationListRow, ParticipationsPage } from '@/lib/query/participations'

const viewColumnHelper = createColumnHelper<typeof tableFeaturesConfig, ParticipationListRow>()

// The fixed dimensions for this screen (edition/category/state) — never
// user-editable filters, so they're baked into the export links but never
// touched by FilterBar or useFilterState.
export type FixedExportParams = {
  edition: string
  category: string
  state?: string
}

export function ParticipationsExplorer({
  page,
  columnKeys,
  filterConfig,
  exportParams,
  caption,
  drm,
  showGenerateBatch,
}: {
  page: ParticipationsPage
  // Column keys, not column defs: column defs carry render functions
  // (`cell`), and Server Component props can't cross into a Client
  // Component as functions (RSC serialization boundary) — passing plain
  // string keys and resolving them to participationColumn entries here,
  // inside the client tree, is what a Server Component page can actually
  // hand this component.
  columnKeys: ParticipationColumnKey[]
  filterConfig: FilterBarConfig
  exportParams: FixedExportParams
  caption?: string
  drm?: boolean
  // Viewers never generate batches (payment_batches/payments RLS blocks
  // them outright) — callers decide whether this link renders at all
  // rather than this component knowing about roles.
  showGenerateBatch?: boolean
}) {
  const { filters, setFilter, setCursor, isPending } = useFilterState()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const columns = useMemo(() => columnKeys.map((key) => participationColumn[key]), [columnKeys])

  // A dedicated "Detail" column (not a click-anywhere row) so the drawer
  // trigger is a real, keyboard-reachable link — it opens the same page
  // with ?person=<id> added, which the Server Component page reads to
  // fetch and render ParticipationDrawer alongside this list.
  const viewColumn = useMemo(
    () =>
      viewColumnHelper.display({
        id: 'view',
        header: 'Detail',
        cell: (info) => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('person', info.row.original.id)
          return <Link href={`${pathname}?${params.toString()}`}>View</Link>
        },
      }),
    [pathname, searchParams]
  )

  const allColumns = useMemo(() => [...columns, viewColumn], [columns, viewColumn])

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('edition', exportParams.edition)
    params.set('category', exportParams.category)
    if (exportParams.state) params.set('state', exportParams.state)
    else if (filters.state) params.set('state', filters.state)
    if (filters.sport) params.set('sport', filters.sport)
    if (filters.committee) params.set('committee', filters.committee)
    if (filters.bank) params.set('bank', filters.bank)
    if (filters.accreditation !== 'all') params.set('accreditation', filters.accreditation)
    if (filters.paymentStatus !== 'all') params.set('paymentStatus', filters.paymentStatus)
    if (filters.q) params.set('q', filters.q)
    if (drm) params.set('drm', '1')
    return params
  }, [exportParams, filters, drm])

  return (
    <div>
      <FilterBar
        filters={filters}
        setFilter={setFilter}
        config={filterConfig}
        resultCount={page.totalCount}
        isPending={isPending}
      />

      <DataTable columns={allColumns} data={page.rows} caption={caption} />

      {/* Going backward is the browser's back button — the URL (and its
          cursor) is the only state, so history navigation already
          restores the previous page for free. */}
      {page.nextCursor ? (
        <nav aria-label="Pagination">
          <button type="button" onClick={() => setCursor(page.nextCursor)} disabled={isPending}>
            Next page
          </button>
        </nav>
      ) : null}

      <p>
        <a href={`/api/export?${exportQuery.toString()}&format=xlsx`}>Export Excel</a>
        {' · '}
        <a href={`/api/export?${exportQuery.toString()}&format=pdf`}>Export PDF</a>
        {showGenerateBatch ? (
          <>
            {' · '}
            <Link href={`/payments/generate?${exportQuery.toString()}`}>Generate disbursement batch</Link>
          </>
        ) : null}
      </p>
    </div>
  )
}
