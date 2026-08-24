'use client'

import { useState, useTransition } from 'react'
import { deleteRate, upsertRate } from '@/lib/actions/rates'
import { formatNaira } from '@/lib/format/money'

type Option = { id: string; name: string }
type Rate = { id: string; category_id: string; sport_id: string | null; amount: number }

export function RatesAdmin({
  editionId,
  rates,
  categories,
  sports,
}: {
  editionId: string
  rates: Rate[]
  categories: Option[]
  sports: Option[]
}) {
  const [categoryId, setCategoryId] = useState('')
  const [sportId, setSportId] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown category'
  const sportName = (id: string | null) => (id ? (sports.find((s) => s.id === id)?.name ?? 'Unknown sport') : 'All sports')

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsedAmount = Number(amount)
    if (!categoryId || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Choose a category and enter a non-negative amount.')
      return
    }
    startTransition(async () => {
      const result = await upsertRate({
        editionId,
        categoryId,
        sportId: sportId || null,
        amount: parsedAmount,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCategoryId('')
      setSportId('')
      setAmount('')
    })
  }

  function handleDelete(rateId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteRate(rateId)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div>
      <form onSubmit={handleSave}>
        <label htmlFor="rate-category">Category</label>
        <br />
        <select id="rate-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <br />
        <label htmlFor="rate-sport">Sport (optional — leave blank for a category-wide rate)</label>
        <br />
        <select id="rate-sport" value={sportId} onChange={(event) => setSportId(event.target.value)}>
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <br />
        <label htmlFor="rate-amount">Amount (NGN)</label>
        <br />
        <input
          id="rate-amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <br />
        <button type="submit" disabled={isPending}>
          Save rate
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Sport</th>
            <th scope="col">Amount</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id}>
              <td>{categoryName(rate.category_id)}</td>
              <td>{sportName(rate.sport_id)}</td>
              <td>{formatNaira(rate.amount)}</td>
              <td>
                <button type="button" onClick={() => handleDelete(rate.id)} disabled={isPending}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
