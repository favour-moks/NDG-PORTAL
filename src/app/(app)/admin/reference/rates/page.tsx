import { requireRole } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { createClient } from '@/lib/supabase/server'
import { EditionSwitcher } from '@/components/features/EditionSwitcher'
import { RatesAdmin } from './RatesAdmin'

export default async function RatesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>
}) {
  await requireRole(['admin', 'editor'])
  const { edition: editionIdParam } = await searchParams
  const supabase = await createClient()

  const [edition, { data: allEditions }] = await Promise.all([
    resolveEdition(editionIdParam),
    supabase.from('editions').select('id, name, status').order('year', { ascending: false }),
  ])

  if (!edition) {
    return (
      <main>
        <h1>Rates</h1>
        <p>No active edition yet. An admin needs to create and activate an edition first.</p>
      </main>
    )
  }

  const [{ data: rates }, { data: categories }, { data: sports }] = await Promise.all([
    supabase.from('rates').select('id, category_id, sport_id, amount').eq('edition_id', edition.id),
    supabase.from('categories').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('sports').select('id, name').eq('active', true).order('name'),
  ])

  return (
    <main>
      <h1>Rates — {edition.name}</h1>
      <p>Entitlement is resolved from these rates at import time and snapshotted onto each participation — changing a rate here never alters an already-imported entitlement.</p>

      {allEditions && allEditions.length > 1 ? (
        <EditionSwitcher editions={allEditions} currentEditionId={edition.id} />
      ) : null}

      <RatesAdmin
        editionId={edition.id}
        rates={(rates ?? []).map((r) => ({ ...r, amount: Number(r.amount) }))}
        categories={categories ?? []}
        sports={sports ?? []}
      />
    </main>
  )
}
