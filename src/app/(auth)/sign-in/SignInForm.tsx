'use client'

import { useState, useTransition } from 'react'
import { signIn } from '@/lib/actions/auth'

export function SignInForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signIn(formData)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit}>
      <div>
        <label htmlFor="email">Email address</label>
        <br />
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <br />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
