'use client'

import { useRef, useState } from 'react'
import { RejectionTable, type Rejection } from './RejectionTable'

type Option = { id: string; name: string }
type Category = Option & {
  is_state_scoped: boolean
  requires_sport: boolean
  requires_committee: boolean
}

type ImportResult = {
  importRunId: string
  rowCount: number
  accepted: number
  rejected: number
  rejections: Rejection[]
  duplicatesFlagged: number
}

export function FileDrop({
  editionId,
  categories,
  states,
  sports,
  committees,
}: {
  editionId: string
  categories: Category[]
  states: Option[]
  sports: Option[]
  committees: Option[]
}) {
  const [categoryId, setCategoryId] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showSlowNotice, setShowSlowNotice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const category = categories.find((c) => c.id === categoryId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setIsUploading(true)

    // Progress feedback after 3 seconds, per the Import screen's Loading
    // state (PRD § 8).
    const slowTimer = setTimeout(() => setShowSlowNotice(true), 3000)

    try {
      const formData = new FormData(event.currentTarget)
      formData.set('editionId', editionId)

      const response = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'This file could not be imported.')
        return
      }

      setResult(data)
      if (data.rejected === 0) formRef.current?.reset()
    } catch {
      setError('This file could not be uploaded. Check your connection and try again.')
    } finally {
      clearTimeout(slowTimer)
      setShowSlowNotice(false)
      setIsUploading(false)
    }
  }

  return (
    <section>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="categoryId">Category</label>
          <br />
          <select
            id="categoryId"
            name="categoryId"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {category?.is_state_scoped ? (
          <div>
            <label htmlFor="stateId">State</label>
            <br />
            <select id="stateId" name="stateId" required>
              <option value="">Select a state</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {category?.requires_sport ? (
          <div>
            <label htmlFor="sportId">Sport</label>
            <br />
            <select id="sportId" name="sportId" required>
              <option value="">Select a sport</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {category?.requires_committee ? (
          <div>
            <label htmlFor="committeeId">Committee</label>
            <br />
            <select id="committeeId" name="committeeId" required>
              <option value="">Select a committee</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="file">File (.xlsx or .csv)</label>
          <br />
          <input id="file" name="file" type="file" accept=".xlsx,.csv" required />
        </div>

        <button type="submit" disabled={isUploading || !categoryId}>
          {isUploading ? 'Importing…' : 'Import'}
        </button>
      </form>

      {isUploading && showSlowNotice ? (
        <p role="status">Still working — larger files can take a little while.</p>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      {result ? (
        <div aria-live="polite">
          <p>
            {result.accepted} of {result.rowCount} records{' '}
            {result.rejected > 0 ? 'ready to import' : 'imported'}.
            {result.rejected > 0 ? ` ${result.rejected} rejected.` : ''}
            {result.duplicatesFlagged > 0
              ? ` ${result.duplicatesFlagged} duplicate${result.duplicatesFlagged === 1 ? '' : 's'} within the file, imported once.`
              : ''}
          </p>
          {result.rejected > 0 ? (
            <>
              <RejectionTable rejections={result.rejections} />
              <a href={`/api/import/corrections?importRunId=${result.importRunId}`}>
                Download rejected rows to correct and re-upload
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      <p>
        <a href="/templates/import-template.xlsx">Download the import template</a>
      </p>
    </section>
  )
}
