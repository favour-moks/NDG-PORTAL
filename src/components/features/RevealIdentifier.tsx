'use client'

import { useState, useTransition } from 'react'
import { revealIdentifier } from '@/lib/actions/identifiers'

// Editors only (the caller decides whether to render this at all — see
// ParticipationDrawer's canReveal prop); the server action re-checks the
// role independently, so this is defence in depth, not the only gate.
export function RevealIdentifier({ personId }: { personId: string }) {
  const [revealed, setRevealed] = useState<{ bvn: string | null; nin: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReveal() {
    setError(null)
    startTransition(async () => {
      const result = await revealIdentifier(personId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRevealed({ bvn: result.bvn, nin: result.nin })
    })
  }

  if (revealed) {
    return (
      <div role="alert">
        <p>BVN: {revealed.bvn ?? '—'}</p>
        <p>NIN: {revealed.nin ?? '—'}</p>
        <p>This reveal has been logged. Do not share this value outside resolving this specific dispute.</p>
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={handleReveal} disabled={isPending}>
        {isPending ? 'Revealing…' : 'Reveal full identifier'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
