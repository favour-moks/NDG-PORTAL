'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { previewExclusions } from '@/lib/actions/disbursement'

type Filters = {
  editionId: string
  categoryId: string
  stateId?: string
  sportId?: string
  committeeId?: string
  bankId?: string
  q?: string
}

type FilterSummary = {
  editionName: string
  categoryName: string
  stateName?: string | null
  sportName?: string | null
  committeeName?: string | null
  bankName?: string | null
  q?: string
}

type ExclusionSummary = {
  totalConsidered: number
  totalPayable: number
  totalExcluded: number
  byReason: { code: string; message: string; count: number }[]
}

type DuplicateWarning = {
  message: string
  existingReference: string
  existingCount: number
  existingGeneratedAt: string
}

function summaryLine(filters: FilterSummary): string {
  const parts = [filters.editionName, filters.categoryName]
  if (filters.stateName) parts.push(filters.stateName)
  if (filters.sportName) parts.push(filters.sportName)
  if (filters.committeeName) parts.push(filters.committeeName)
  if (filters.bankName) parts.push(filters.bankName)
  if (filters.q) parts.push(`"${filters.q}"`)
  return parts.join(' → ')
}

// The magic moment (product-vision.md § 3 Magic Moment Design): one
// screen, one confirmation, filter to file in under fifteen seconds. The
// exclusion breakdown loads before the user can even see the reference
// field, so "45 payable, 12 excluded" is known before they commit to
// anything.
export function GenerateBatch({ filters, filterSummary }: { filters: Filters; filterSummary: FilterSummary }) {
  const router = useRouter()
  const [exclusions, setExclusions] = useState<ExclusionSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<DuplicateWarning | null>(null)

  useEffect(() => {
    let cancelled = false
    previewExclusions(filters)
      .then((summary) => {
        if (!cancelled) setExclusions(summary)
      })
      .catch(() => {
        if (!cancelled) setLoadError('The exclusion breakdown could not be loaded.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(force: boolean) {
    setError(null)
    setWarning(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/disbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, reference: reference.trim(), description: description.trim() || undefined, force }),
      })

      if (response.status === 409) {
        const data = await response.json()
        if (data.warning === 'duplicate_recent_batch') {
          setWarning(data)
          return
        }
        setError(data.error ?? 'This reference is already in use.')
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? 'The batch could not be generated.')
        return
      }

      const batchId = response.headers.get('X-Batch-Id')
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const filenameMatch = /filename="([^"]+)"/.exec(disposition)
      const filename = filenameMatch?.[1] ?? 'disbursement.csv'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      if (batchId) router.push(`/payments/${batchId}`)
    } catch {
      setError('The batch could not be generated. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section>
      <p>{summaryLine(filterSummary)}</p>

      {loadError ? <p role="alert">{loadError}</p> : null}

      {exclusions ? (
        <div aria-live="polite">
          <p>
            {exclusions.totalPayable} payable of {exclusions.totalConsidered} considered.
            {exclusions.totalExcluded > 0
              ? ` Excluded from this batch: ${exclusions.totalExcluded} people.`
              : ''}
          </p>
          {exclusions.byReason.length > 0 ? (
            <ul>
              {exclusions.byReason.map((reason) => (
                <li key={reason.code}>
                  {reason.count} {reason.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p role="status">Calculating exclusions…</p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
      >
        <label htmlFor="batch-reference">Reference</label>
        <br />
        <input
          id="batch-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          required
        />
        <br />
        <label htmlFor="batch-description">Description (optional)</label>
        <br />
        <input id="batch-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <br />
        <button type="submit" disabled={isSubmitting || !exclusions || exclusions.totalPayable === 0 || !reference.trim()}>
          {isSubmitting ? 'Generating…' : 'Generate and download'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {warning ? (
        <div role="alert">
          <p>{warning.message}</p>
          <button type="button" onClick={() => submit(true)} disabled={isSubmitting}>
            Generate anyway
          </button>
        </div>
      ) : null}
    </section>
  )
}
