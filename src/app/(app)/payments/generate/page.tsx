import { requireRole } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { createClient } from '@/lib/supabase/server'
import { GenerateBatch } from '@/components/features/payments/GenerateBatch'

export default async function GenerateBatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['admin', 'editor'])
  const raw = await searchParams
  const get = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : undefined)

  const editionIdParam = get('edition')
  const categoryId = get('category')
  const stateId = get('state')
  const sportId = get('sport')
  const committeeId = get('committee')
  const bankId = get('bank')
  const q = get('q')

  const edition = await resolveEdition(editionIdParam)
  if (!edition) {
    return (
      <main>
        <h1>Generate disbursement batch</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }
  if (!categoryId) {
    return (
      <main>
        <h1>Generate disbursement batch</h1>
        <p>A category filter is required — start from a participants or personnel list.</p>
      </main>
    )
  }

  const supabase = await createClient()
  const [{ data: category }, { data: state }, { data: sport }, { data: committee }, { data: bank }] =
    await Promise.all([
      supabase.from('categories').select('name').eq('id', categoryId).maybeSingle(),
      stateId ? supabase.from('states').select('name').eq('id', stateId).maybeSingle() : Promise.resolve({ data: null }),
      sportId ? supabase.from('sports').select('name').eq('id', sportId).maybeSingle() : Promise.resolve({ data: null }),
      committeeId
        ? supabase.from('committees').select('name').eq('id', committeeId).maybeSingle()
        : Promise.resolve({ data: null }),
      bankId ? supabase.from('banks').select('name').eq('id', bankId).maybeSingle() : Promise.resolve({ data: null }),
    ])

  if (!category) {
    return (
      <main>
        <h1>Generate disbursement batch</h1>
        <p>That category could not be found.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Generate disbursement batch</h1>
      <GenerateBatch
        filters={{ editionId: edition.id, categoryId, stateId, sportId, committeeId, bankId, q }}
        filterSummary={{
          editionName: edition.name,
          categoryName: category.name,
          stateName: state?.name,
          sportName: sport?.name,
          committeeName: committee?.name,
          bankName: bank?.name,
          q,
        }}
      />
    </main>
  )
}
