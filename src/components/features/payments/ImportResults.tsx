'use client'

import { useRef, useState } from 'react'

type ResultException =
  | { rowNumber: number; kind: 'unmatched'; reference: string; accountNumber: string }
  | { rowNumber: number; kind: 'ambiguous'; reference: string; accountNumber: string; candidateCount: number }
  | { rowNumber: number; kind: 'unrecognized_status'; reference: string; status: string }

type ImportResultsSummary = {
  matched: number
  paid: number
  failed: number
  unmatched: number
  ambiguous: number
  exceptions: ResultException[]
}

function describeException(exception: ResultException): string {
  switch (exception.kind) {
    case 'unmatched':
      return `Row ${exception.rowNumber}: no payment matches reference "${exception.reference}" or account ${exception.accountNumber}.`
    case 'ambiguous':
      return `Row ${exception.rowNumber}: matches ${exception.candidateCount} payments — needs manual resolution.`
    case 'unrecognized_status':
      return `Row ${exception.rowNumber}: status "${exception.status}" was not recognised as paid or failed.`
  }
}

export function ImportResults({ batchId }: { batchId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportResultsSummary | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSummary(null)
    setIsUploading(true)

    try {
      const formData = new FormData(event.currentTarget)
      formData.set('batchId', batchId)

      const response = await fetch('/api/disbursement/results', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'This file could not be imported.')
        return
      }

      setSummary(data)
      formRef.current?.reset()
    } catch {
      setError('This file could not be uploaded. Check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section>
      <h2>Upload results</h2>
      <form ref={formRef} onSubmit={handleSubmit}>
        <label htmlFor="results-file">Result file (.xlsx or .csv)</label>
        <br />
        <input id="results-file" name="file" type="file" accept=".xlsx,.csv" required />
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Importing…' : 'Import results'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {summary ? (
        <div aria-live="polite">
          <p>
            {summary.matched + summary.exceptions.length} payment results imported. {summary.paid} successful,{' '}
            {summary.failed} failed, {summary.unmatched} unmatched.
            {summary.exceptions.length > 0
              ? ` Review the ${summary.exceptions.length} exception${summary.exceptions.length === 1 ? '' : 's'}.`
              : ''}
          </p>
          {summary.exceptions.length > 0 ? (
            <ul>
              {summary.exceptions.map((exception, index) => (
                <li key={index}>{describeException(exception)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
