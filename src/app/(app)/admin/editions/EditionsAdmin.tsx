'use client'

import { useState, useTransition } from 'react'
import { activateEdition, closeEdition, createEdition } from '@/lib/actions/editions'

export type EditionRow = {
  id: string
  name: string
  year: number
  status: string
  is_reference: boolean
  closed_at: string | null
}

export function EditionsAdmin({ editions, isAdmin }: { editions: EditionRow[]; isAdmin: boolean }) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsedYear = Number(year)
    if (!name.trim() || !Number.isInteger(parsedYear)) {
      setError('Enter a name and a valid year.')
      return
    }
    startTransition(async () => {
      const result = await createEdition({ name: name.trim(), year: parsedYear })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setName('')
      setYear('')
    })
  }

  function handleActivate(editionId: string) {
    setError(null)
    startTransition(async () => {
      const result = await activateEdition(editionId)
      if (!result.ok) setError(result.error)
    })
  }

  function handleClose(editionId: string) {
    setError(null)
    startTransition(async () => {
      const result = await closeEdition(editionId)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div>
      <form onSubmit={handleCreate}>
        <div>
          <label htmlFor="edition-name">Name</label>
          <br />
          <input
            id="edition-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="NDG 2027"
            required
          />
        </div>
        <div>
          <label htmlFor="edition-year">Year</label>
          <br />
          <input
            id="edition-year"
            type="number"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isPending}>
          Create edition (draft)
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Year</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {editions.map((edition) => (
            <tr key={edition.id}>
              <td>{edition.name}</td>
              <td>{edition.year}</td>
              <td>
                {edition.status}
                {edition.is_reference ? ' (reference)' : ''}
              </td>
              <td>
                {edition.status === 'draft' ? (
                  <button type="button" onClick={() => handleActivate(edition.id)} disabled={isPending}>
                    Activate
                  </button>
                ) : null}
                {edition.status === 'active' && isAdmin ? (
                  <button type="button" onClick={() => handleClose(edition.id)} disabled={isPending}>
                    Close (irreversible)
                  </button>
                ) : null}
                {edition.status === 'closed' ? 'Closed' : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
