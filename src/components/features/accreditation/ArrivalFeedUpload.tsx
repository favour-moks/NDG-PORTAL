'use client'

import { useRef, useState } from 'react'

type ArrivalImportResponse = {
  rowCount: number
  matched: number
  unmatched: number
}

export function ArrivalFeedUpload({ editionId }: { editionId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ArrivalImportResponse | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setIsUploading(true)

    try {
      const formData = new FormData(event.currentTarget)
      formData.set('editionId', editionId)

      const response = await fetch('/api/import/arrival', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'This file could not be imported.')
        return
      }

      setResult(data)
      formRef.current?.reset()
    } catch {
      setError('This file could not be uploaded. Check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="arrival-file">Arrival accreditation feed (.csv)</label>
          <br />
          <input id="arrival-file" name="file" type="file" accept=".csv" required />
        </div>
        <details>
          <summary>Column names don&apos;t match? Configure the mapping.</summary>
          <div>
            <label htmlFor="identifierColumn">Identifier column name</label>
            <br />
            <input id="identifierColumn" name="identifierColumn" placeholder="Identifier" />
          </div>
          <div>
            <label htmlFor="accountNumberColumn">Account number column name (optional fallback match)</label>
            <br />
            <input id="accountNumberColumn" name="accountNumberColumn" placeholder="Account Number" />
          </div>
        </details>
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Importing…' : 'Import feed'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {result ? (
        <p aria-live="polite">
          {result.matched} of {result.rowCount} matched and accredited. {result.unmatched} unmatched.
        </p>
      ) : null}
    </div>
  )
}
