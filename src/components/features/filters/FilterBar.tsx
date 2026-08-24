'use client'

import { useEffect, useState } from 'react'
import type { AccreditationFilter, PaymentStatusFilter } from '@/lib/query/participations'
import type { FilterState } from './useFilterState'

export type FilterOption = { id: string; name: string }

// Each screen shows only the filters that make sense for it (TASK-050:
// LOC gets committee, tech leads/officials get sport, MOC gets neither) —
// omitting a field from the config hides that control entirely rather
// than disabling it.
export type FilterBarConfig = {
  stateOptions?: FilterOption[]
  sportOptions?: FilterOption[]
  bankOptions?: FilterOption[]
  committeeOptions?: FilterOption[]
  showAccreditation?: boolean
  showPaymentStatus?: boolean
  showSearch?: boolean
}

type SetFilter = (partial: Partial<Omit<FilterState, 'cursor'>>) => unknown

export function FilterBar({
  filters,
  setFilter,
  config,
  resultCount,
  isPending,
}: {
  filters: FilterState
  setFilter: SetFilter
  config: FilterBarConfig
  resultCount: number
  isPending?: boolean
}) {
  // Free-text search is debounced locally before it reaches the URL —
  // every other filter here is a discrete select, so committing on
  // change is fine, but a name filter firing a server round-trip per
  // keystroke would make typing feel broken.
  const [queryDraft, setQueryDraft] = useState(filters.q ?? '')

  // Adjusted during render (not in an effect) so an external change to
  // filters.q — the browser back button, clearFilters() — is reflected
  // immediately without an extra render pass or an effect-lint violation.
  const [syncedQ, setSyncedQ] = useState(filters.q ?? '')
  if ((filters.q ?? '') !== syncedQ) {
    setSyncedQ(filters.q ?? '')
    setQueryDraft(filters.q ?? '')
  }

  useEffect(() => {
    const trimmed = queryDraft.trim()
    if (trimmed === (filters.q ?? '')) return
    const timer = setTimeout(() => {
      setFilter({ q: trimmed || null })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft])

  return (
    <div>
      <form onSubmit={(event) => event.preventDefault()}>
        {config.showSearch !== false && (
          <label>
            Name
            <br />
            <input
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              aria-label="Search by name"
            />
          </label>
        )}

        {config.stateOptions && (
          <label>
            State
            <br />
            <select
              value={filters.state ?? ''}
              onChange={(event) => setFilter({ state: event.target.value || null })}
              aria-label="State"
            >
              <option value="">All states</option>
              {config.stateOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {config.sportOptions && (
          <label>
            Sport
            <br />
            <select
              value={filters.sport ?? ''}
              onChange={(event) => setFilter({ sport: event.target.value || null })}
              aria-label="Sport"
            >
              <option value="">All sports</option>
              {config.sportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {config.committeeOptions && (
          <label>
            Committee
            <br />
            <select
              value={filters.committee ?? ''}
              onChange={(event) => setFilter({ committee: event.target.value || null })}
              aria-label="Committee"
            >
              <option value="">All committees</option>
              {config.committeeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {config.bankOptions && (
          <label>
            Bank
            <br />
            <select
              value={filters.bank ?? ''}
              onChange={(event) => setFilter({ bank: event.target.value || null })}
              aria-label="Bank"
            >
              <option value="">All banks</option>
              {config.bankOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {config.showAccreditation && (
          <label>
            Accreditation
            <br />
            <select
              value={filters.accreditation}
              onChange={(event) =>
                setFilter({ accreditation: event.target.value as AccreditationFilter })
              }
              aria-label="Accreditation status"
            >
              <option value="all">All</option>
              <option value="accredited">Accredited</option>
              <option value="not_accredited">Not accredited</option>
            </select>
          </label>
        )}

        {config.showPaymentStatus && (
          <label>
            Payment status
            <br />
            <select
              value={filters.paymentStatus}
              onChange={(event) =>
                setFilter({ paymentStatus: event.target.value as PaymentStatusFilter })
              }
              aria-label="Payment status"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="in_progress">In progress</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        )}
      </form>

      <p role="status" aria-live="polite">
        {isPending ? 'Updating…' : `${resultCount} ${resultCount === 1 ? 'record' : 'records'}`}
      </p>
    </div>
  )
}
