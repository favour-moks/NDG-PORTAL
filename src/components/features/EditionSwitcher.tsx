'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type EditionOption = { id: string; name: string; status: string }

// Edition is part of the URL (the `edition` search param) so a scoped view
// is shareable. Editors get a full switcher across every edition; viewers
// get the same control since RLS scopes them by state, not edition — they
// see their state's history across every edition (Phase 0, 008_rls.sql),
// so browsing a previous edition is a legitimate, unrestricted action.
export function EditionSwitcher({
  editions,
  currentEditionId,
}: {
  editions: EditionOption[]
  currentEditionId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(editionId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('edition', editionId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <label>
      Edition
      <br />
      <select
        value={currentEditionId}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Edition"
      >
        {editions.map((edition) => (
          <option key={edition.id} value={edition.id}>
            {edition.name} ({edition.status})
          </option>
        ))}
      </select>
    </label>
  )
}
