import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { listCategories, listStates, listViewerStates } from '@/lib/query/reference'
import { createClient } from '@/lib/supabase/server'

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>
}) {
  const profile = await requireSession()
  const { edition: editionIdParam } = await searchParams
  const edition = await resolveEdition(editionIdParam)

  if (!edition) {
    return (
      <main>
        <h1>Participants</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }

  const categories = await listCategories('participants')
  const stateScopedCategories = categories.filter((c) => c.isStateScoped)
  const defaultCategoryId = stateScopedCategories[0]?.id

  if (!defaultCategoryId) {
    return (
      <main>
        <h1>Participants</h1>
        <p>No state-scoped participant categories are configured yet.</p>
      </main>
    )
  }

  // Viewers never see a state selector — RLS already scopes their data to
  // one state, so the selector would just be a list of one, and offering
  // a picker implies a choice that doesn't exist.
  if (profile.role === 'viewer') {
    const viewerStates = await listViewerStates(profile.id)
    if (viewerStates.length === 1) {
      redirect(`/participants/${viewerStates[0].id}/${defaultCategoryId}`)
    }
    if (viewerStates.length === 0) {
      return (
        <main>
          <h1>Participants</h1>
          <p>No state has been assigned to your account yet. Contact an admin.</p>
        </main>
      )
    }
    return (
      <main>
        <h1>Participants</h1>
        <ul>
          {viewerStates.map((state) => (
            <li key={state.id}>
              <Link href={`/participants/${state.id}/${defaultCategoryId}`}>{state.name}</Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  const supabase = await createClient()
  const states = await listStates()
  const counts = await Promise.all(
    states.map((state) =>
      supabase
        .from('participations')
        .select('*', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .eq('state_id', state.id)
        .then(({ count }) => [state.id, count ?? 0] as const)
    )
  )
  const countByState = new Map(counts)

  return (
    <main>
      <h1>Participants — {edition.name}</h1>
      <ul>
        {states.map((state) => (
          <li key={state.id}>
            <Link href={`/participants/${state.id}/${defaultCategoryId}`}>
              {state.name} ({countByState.get(state.id) ?? 0})
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
