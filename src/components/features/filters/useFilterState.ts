'use client'

import { useTransition } from 'react'
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import type { AccreditationFilter, PaymentStatusFilter } from '@/lib/query/participations'

// The URL is the single source of truth for list state — filters, and the
// pagination cursor, all live here. That's what makes the browser back
// button restore the previous view for free, and what makes a list URL
// shareable/bookmarkable with its exact filtered state intact.
//
// category isn't here — it's a route param ([category]), identifying
// *which page* this is rather than a refinement of it. state is a route
// param on the participants screens (/participants/[state]/[category])
// but a genuine filter on DRM (/drm/[category], which spans every state
// at once for one category) — harmless to carry on every screen since
// only DRM's FilterBar config ever exposes a control for it.
const filterParsers = {
  state: parseAsString,
  sport: parseAsString,
  committee: parseAsString,
  bank: parseAsString,
  accreditation: parseAsStringEnum<AccreditationFilter>(['all', 'accredited', 'not_accredited']).withDefault(
    'all'
  ),
  paymentStatus: parseAsStringEnum<PaymentStatusFilter>(['all', 'paid', 'in_progress', 'pending']).withDefault(
    'all'
  ),
  q: parseAsString,
  cursor: parseAsString,
}

export function useFilterState() {
  const [isPending, startTransition] = useTransition()

  // shallow: false is load-bearing — these pages fetch via a Server
  // Component reading `searchParams` (listParticipations can't run in the
  // browser: it needs the request's cookies for requireSession()), so a
  // filter change has to trigger an actual server round-trip, not just a
  // client-side URL update.
  const [state, setState] = useQueryStates(filterParsers, {
    history: 'push',
    shallow: false,
    startTransition,
  })

  // Any change to an actual filter has to restart pagination — a stale
  // cursor from the previous filter set doesn't correspond to a position
  // in the new, differently-ordered/differently-sized result set.
  function setFilter(partial: Partial<Omit<typeof state, 'cursor'>>) {
    return setState({ ...partial, cursor: null })
  }

  function setCursor(cursor: string | null) {
    return setState({ cursor })
  }

  function clearFilters() {
    return setState(null)
  }

  return { filters: state, setFilter, setCursor, clearFilters, isPending }
}

export type FilterState = ReturnType<typeof useFilterState>['filters']
