import { requireRole } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { listParticipations, parseFiltersFromSearchParams } from '@/lib/query/participations'
import { listBanks, listCommittees, listSports, listStates } from '@/lib/query/reference'
import { createClient } from '@/lib/supabase/server'
import { ParticipationsExplorer } from '@/components/features/ParticipationsExplorer'
import { ParticipationDrawer } from '@/components/features/ParticipationDrawer'
import type { ParticipationColumnKey } from '@/components/features/participationColumns'
import type { FilterBarConfig } from '@/components/features/filters/FilterBar'
import { getPersonDetail } from '@/lib/query/personDetail'
import { hrefWithoutParam } from '@/lib/url'

const DRM_DISCLAIMER = 'Any individual who is not accredited will not be paid.'

// DRM (Disbursement Record Manifest) surfaces the same account/bank
// detail as an export, for sign-off before a batch goes out — editor/
// admin only (TASK-055, architecture decision doc), and print-optimised
// rather than filtered-for-analysis: fixed columns, disclaimer on every
// page, no payment-amount columns (that's the reconciliation screen's
// job, Phase 4).
export default async function DrmListPage({
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
        <h1>DRM</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }

  const supabase = await createClient()
  const { data: category } = await supabase
    .from('categories')
    .select('id, name, is_state_scoped, requires_sport, requires_committee')
    .eq('id', categoryId)
    .maybeSingle()

  if (!category) {
    return (
      <main>
        <h1>DRM</h1>
        <p>That category could not be found.</p>
      </main>
    )
  }

  const [states, sports, committees, banks] = await Promise.all([
    category.is_state_scoped ? listStates() : Promise.resolve([]),
    category.requires_sport ? listSports() : Promise.resolve([]),
    category.requires_committee ? listCommittees(edition.id) : Promise.resolve([]),
    listBanks(),
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
    stateOptions: category.is_state_scoped ? states : undefined,
    sportOptions: category.requires_sport ? sports : undefined,
    committeeOptions: category.requires_committee ? committees : undefined,
    bankOptions: banks,
    showAccreditation: true,
    showPaymentStatus: false,
    showSearch: true,
  }

  const columnKeys: ParticipationColumnKey[] = [
    'fullName',
    'accountName',
    'accountNumber',
    'bank',
    ...(category.is_state_scoped ? (['state'] as const) : []),
    ...(category.requires_sport ? (['sport'] as const) : []),
    ...(category.requires_committee ? (['committee'] as const) : []),
    'arrivalAccredited',
  ]

  return (
    <main>
      <h1>
        DRM — {category.name} — {edition.name}
      </h1>

      <p>
        <strong>{DRM_DISCLAIMER}</strong>
      </p>

      <ParticipationsExplorer
        page={page}
        columnKeys={columnKeys}
        filterConfig={filterConfig}
        exportParams={{ edition: edition.id, category: category.id }}
        caption={`DRM — ${category.name}`}
        drm
      />

      {personDetail ? (
        <ParticipationDrawer person={personDetail} closeHref={hrefWithoutParam(rawSearchParams, 'person')} />
      ) : null}
    </main>
  )
}
