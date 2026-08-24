import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { listParticipations, parseFiltersFromSearchParams } from '@/lib/query/participations'
import { listBanks, listCategories, listSports, listViewerStates } from '@/lib/query/reference'
import { createClient } from '@/lib/supabase/server'
import { ParticipationsExplorer } from '@/components/features/ParticipationsExplorer'
import { ParticipationDrawer } from '@/components/features/ParticipationDrawer'
import type { ParticipationColumnKey } from '@/components/features/participationColumns'
import type { FilterBarConfig } from '@/components/features/filters/FilterBar'
import { getPersonDetail } from '@/lib/query/personDetail'
import { hrefWithoutParam } from '@/lib/url'

export default async function ParticipantsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const profile = await requireSession()
  const { state: stateId, category: categoryId } = await params
  const rawSearchParams = await searchParams
  const editionIdParam = typeof rawSearchParams.edition === 'string' ? rawSearchParams.edition : undefined

  // A viewer only ever has one legitimate state URL — RLS would block the
  // underlying data either way, but redirecting avoids rendering a filter
  // bar and category tabs for a state they can't see anything in.
  if (profile.role === 'viewer') {
    const viewerStates = await listViewerStates(profile.id)
    if (!viewerStates.some((state) => state.id === stateId)) {
      redirect('/participants')
    }
  }

  const edition = await resolveEdition(editionIdParam)
  if (!edition) {
    return (
      <main>
        <h1>Participants</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }

  const supabase = await createClient()
  const [categories, sports, banks, { data: state }] = await Promise.all([
    listCategories('participants'),
    listSports(),
    listBanks(),
    supabase.from('states').select('id, name').eq('id', stateId).maybeSingle(),
  ])

  const stateScopedCategories = categories.filter((c) => c.isStateScoped)
  const category = stateScopedCategories.find((c) => c.id === categoryId)

  if (!state || !category) {
    return (
      <main>
        <h1>Participants</h1>
        <p>That state or category could not be found.</p>
      </main>
    )
  }

  const filters = parseFiltersFromSearchParams(rawSearchParams, {
    editionId: edition.id,
    categoryId: category.id,
    stateId: state.id,
  })
  const cursor = typeof rawSearchParams.cursor === 'string' ? rawSearchParams.cursor : null
  const personId = typeof rawSearchParams.person === 'string' ? rawSearchParams.person : null
  const [page, personDetail] = await Promise.all([
    listParticipations(filters, cursor),
    personId ? getPersonDetail(personId) : Promise.resolve(null),
  ])

  const filterConfig: FilterBarConfig = {
    sportOptions: category.requiresSport ? sports : undefined,
    bankOptions: banks,
    showAccreditation: true,
    showPaymentStatus: true,
    showSearch: true,
  }

  const isViewer = profile.role === 'viewer'
  const columnKeys: ParticipationColumnKey[] = isViewer
    ? ['fullName', 'sport', 'bank', 'arrivalAccredited', 'paymentStatus']
    : [
        'fullName',
        'sport',
        'bank',
        'accountNumber',
        'arrivalAccredited',
        'paymentStatus',
        'isPayable',
        'entitlementAmount',
        'amountPaid',
        'balance',
      ]

  return (
    <main>
      <h1>
        {state.name} — {category.name} — {edition.name}
      </h1>

      {stateScopedCategories.length > 1 ? (
        <nav aria-label="Category">
          <ul>
            {stateScopedCategories.map((c) => (
              <li key={c.id}>
                {c.id === category.id ? (
                  <strong>{c.name}</strong>
                ) : (
                  <Link href={`/participants/${state.id}/${c.id}`}>{c.name}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <ParticipationsExplorer
        page={page}
        columnKeys={columnKeys}
        filterConfig={filterConfig}
        exportParams={{ edition: edition.id, category: category.id, state: state.id }}
        caption={`${state.name} — ${category.name}`}
        showGenerateBatch={!isViewer}
      />

      {personDetail ? (
        <ParticipationDrawer person={personDetail} closeHref={hrefWithoutParam(rawSearchParams, 'person')} />
      ) : null}
    </main>
  )
}
