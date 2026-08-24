import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { listParticipations, parseFiltersFromSearchParams } from '@/lib/query/participations'
import { listCategories, listCommittees, listSports } from '@/lib/query/reference'
import { ParticipationsExplorer } from '@/components/features/ParticipationsExplorer'
import { ParticipationDrawer } from '@/components/features/ParticipationDrawer'
import type { ParticipationColumnKey } from '@/components/features/participationColumns'
import type { FilterBarConfig } from '@/components/features/filters/FilterBar'
import { getPersonDetail } from '@/lib/query/personDetail'
import { hrefWithoutParam } from '@/lib/url'

// Personnel categories (LOC, MOC, tech leads, officials, ...) aren't
// state-scoped — participations here have state_id = null, which the
// viewer RLS policy hard-requires to be non-null. A viewer can never see
// a row on this screen no matter what, so it's editor/admin only rather
// than rendering an always-empty screen for viewers.
export default async function PersonnelListPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['admin', 'editor'])
  const { category: categoryId } = await params
  const rawSearchParams = await searchParams
  const editionIdParam = typeof rawSearchParams.edition === 'string' ? rawSearchParams.edition : undefined

  const edition = await resolveEdition(editionIdParam)
  if (!edition) {
    return (
      <main>
        <h1>Personnel</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }

  const categories = await listCategories('personnel')
  const category = categories.find((c) => c.id === categoryId)

  if (!category) {
    return (
      <main>
        <h1>Personnel</h1>
        <p>That category could not be found.</p>
      </main>
    )
  }

  const [sports, committees] = await Promise.all([
    category.requiresSport ? listSports() : Promise.resolve([]),
    category.requiresCommittee ? listCommittees(edition.id) : Promise.resolve([]),
  ])

  const filters = parseFiltersFromSearchParams(rawSearchParams, {
    editionId: edition.id,
    categoryId: category.id,
  })
  const cursor = typeof rawSearchParams.cursor === 'string' ? rawSearchParams.cursor : null
  const personId = typeof rawSearchParams.person === 'string' ? rawSearchParams.person : null
  const [page, personDetail] = await Promise.all([
    listParticipations(filters, cursor),
    personId ? getPersonDetail(personId) : Promise.resolve(null),
  ])

  const filterConfig: FilterBarConfig = {
    sportOptions: category.requiresSport ? sports : undefined,
    committeeOptions: category.requiresCommittee ? committees : undefined,
    showAccreditation: true,
    showPaymentStatus: true,
    showSearch: true,
  }

  const columnKeys: ParticipationColumnKey[] = [
    'fullName',
    ...(category.requiresSport ? (['sport'] as const) : []),
    ...(category.requiresCommittee ? (['committee'] as const) : []),
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
        {category.name} — {edition.name}
      </h1>

      {categories.length > 1 ? (
        <nav aria-label="Category">
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                {c.id === category.id ? (
                  <strong>{c.name}</strong>
                ) : (
                  <Link href={`/personnel/${c.id}`}>{c.name}</Link>
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
        exportParams={{ edition: edition.id, category: category.id }}
        caption={category.name}
        showGenerateBatch
      />

      {personDetail ? (
        <ParticipationDrawer person={personDetail} closeHref={hrefWithoutParam(rawSearchParams, 'person')} />
      ) : null}
    </main>
  )
}
