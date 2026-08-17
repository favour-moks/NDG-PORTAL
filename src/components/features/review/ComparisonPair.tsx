'use client'

import { useState, useTransition } from 'react'
import { resolveReview } from '@/lib/actions/reviews'

// Nullable throughout to match participations_v's generated type (views
// report columns as nullable regardless of the underlying data), even
// though id/full_name/category_name won't actually be null for a row we
// found by id.
export type ParticipationSummary = {
  id: string | null
  full_name: string | null
  category_name: string | null
  state_name: string | null
  bank_name: string | null
  account_number: string | null
}

export function ComparisonPair({
  reviewId,
  matchType,
  similarityScore,
  isBlocking,
  current,
  matched,
  matchedEditionName,
  matchedEditionIsReference,
}: {
  reviewId: string
  matchType: string
  similarityScore: number | null
  isBlocking: boolean
  current: ParticipationSummary
  matched: ParticipationSummary | undefined
  matchedEditionName: string | undefined
  matchedEditionIsReference: boolean | undefined
}) {
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<{
    status: 'confirmed_duplicate' | 'dismissed'
    resolvedByMe: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleResolve(resolution: 'confirmed_duplicate' | 'dismissed') {
    setError(null)
    startTransition(async () => {
      const result = await resolveReview(reviewId, resolution, note)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOutcome({ status: result.status, resolvedByMe: result.resolvedByMe })
    })
  }

  if (outcome) {
    const label = outcome.status === 'confirmed_duplicate' ? 'a confirmed duplicate' : 'dismissed'
    return (
      <article>
        <p>
          {outcome.resolvedByMe
            ? `Marked as ${label}.`
            : `Already resolved by another editor as ${label}.`}
        </p>
      </article>
    )
  }

  return (
    <article>
      <p>
        Match type: {matchType}
        {similarityScore != null ? ` (${Math.round(similarityScore * 100)}% similar)` : ''}
        {' — '}
        {isBlocking ? 'blocks payment until resolved' : 'reference only, does not block payment'}
      </p>

      <div>
        <section>
          <h3>New record</h3>
          <p>{current.full_name ?? 'Unknown'}</p>
          <p>
            {current.category_name ?? 'Unknown category'} — {current.state_name ?? 'no state'}
          </p>
          <p>
            {current.bank_name ?? 'no bank'} {current.account_number ?? ''}
          </p>
        </section>

        <section>
          <h3>
            Matched record
            {matchedEditionName
              ? ` (${matchedEditionName}${matchedEditionIsReference ? ', reference' : ''})`
              : ''}
          </h3>
          {matched ? (
            <>
              <p>{matched.full_name ?? 'Unknown'}</p>
              <p>
                {matched.category_name ?? 'Unknown category'} — {matched.state_name ?? 'no state'}
              </p>
              <p>
                {matched.bank_name ?? 'no bank'} {matched.account_number ?? ''}
              </p>
            </>
          ) : (
            <p>Record no longer available.</p>
          )}
        </section>
      </div>

      <div>
        <label htmlFor={`note-${reviewId}`}>Note (optional)</label>
        <br />
        <textarea
          id={`note-${reviewId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={() => handleResolve('confirmed_duplicate')} disabled={isPending}>
        Confirm duplicate
      </button>
      <button type="button" onClick={() => handleResolve('dismissed')} disabled={isPending}>
        Dismiss
      </button>
    </article>
  )
}
