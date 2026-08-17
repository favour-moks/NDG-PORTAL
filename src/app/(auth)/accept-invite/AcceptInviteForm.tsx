'use client'

import { useState, useTransition } from 'react'
import { setPassword } from '@/lib/actions/auth'

export function AcceptInviteForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await setPassword(formData)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit}>
      <div>
        <label htmlFor="password">Choose a password</label>
        <br />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Set password and continue'}
      </button>
    </form>
  )
}
