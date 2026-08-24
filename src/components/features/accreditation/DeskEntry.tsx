'use client'

import { useState, useTransition } from 'react'
import {
  searchParticipants,
  setArrivalAccreditation,
  type ParticipantSearchResult,
} from '@/lib/actions/accreditation'
import { EligibilityBadge } from '@/components/features/EligibilityBadge'

export function DeskEntry({ editionId }: { editionId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ParticipantSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const data = await searchParticipants(editionId, query)
      setResults(data)
      setHasSearched(true)
    })
  }

  function handleAccredit(participationId: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await setArrivalAccreditation(participationId, true)
      if (result.ok) {
        setResults((prev) =>
          prev.map((row) => (row.id === participationId ? { ...row, arrivalAccredited: true } : row))
        )
        setMessage('Accredited.')
      } else {
        setMessage(result.error)
      }
    })
  }

  return (
    <section>
      <h2>Desk entry</h2>
      <form onSubmit={handleSearch}>
        <label htmlFor="desk-search">Search by name or 11-digit BVN/NIN</label>
        <br />
        <input
          id="desk-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={2}
          required
        />
        <button type="submit" disabled={isPending}>
          Search
        </button>
      </form>

      {message ? <p role="status">{message}</p> : null}

      {hasSearched && results.length === 0 ? (
        <p>No matches found. Check the spelling or identifier.</p>
      ) : null}

      {results.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">State</th>
              <th scope="col">Eligibility</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td>{row.categoryName}</td>
                <td>{row.stateName ?? '—'}</td>
                <td>
                  <EligibilityBadge
                    participation={{
                      preGamesAccredited: row.preGamesAccredited,
                      arrivalAccredited: row.arrivalAccredited,
                      requiresArrivalAccreditation: row.requiresArrivalAccreditation,
                      exclusionReason: row.exclusionReason,
                      accountNumber: row.accountNumber,
                      bankId: row.bankId,
                    }}
                  />
                </td>
                <td>
                  {row.arrivalAccredited ? (
                    'Already accredited'
                  ) : (
                    <button type="button" onClick={() => handleAccredit(row.id)} disabled={isPending}>
                      Mark accredited
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
