import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { resolveEdition } from '@/lib/edition/context'
import {
  CategoriesTab,
  CommitteesTab,
  SportsTab,
  StatesTab,
  BanksTab,
} from './ReferenceAdmin'

const TABS = ['categories', 'committees', 'sports', 'states', 'banks'] as const
type Tab = (typeof TABS)[number]

function isTab(value: string | undefined): value is Tab {
  return TABS.includes(value as Tab)
}

// Per FR-020: tabbed inline editing for categories, committees, sports,
// states and banks — this screen is what makes the next edition an
// afternoon rather than a code change (roadmap TASK-076), so it's treated
// as load-bearing, not admin filler.
export default async function ReferenceAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireRole(['admin', 'editor'])
  const { tab: tabParam } = await searchParams
  const tab: Tab = isTab(tabParam) ? tabParam : 'categories'

  const supabase = await createClient()
  const edition = await resolveEdition(undefined)

  return (
    <main>
      <h1>Reference data</h1>
      <nav aria-label="Reference data section">
        <ul>
          {TABS.map((t) => (
            <li key={t}>
              {t === tab ? <strong>{t}</strong> : <Link href={`/admin/reference?tab=${t}`}>{t}</Link>}
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'categories' ? (
        <CategoriesTabLoader supabase={supabase} />
      ) : tab === 'committees' ? (
        <CommitteesTabLoader supabase={supabase} editionId={edition?.id ?? null} />
      ) : tab === 'sports' ? (
        <SportsTabLoader supabase={supabase} />
      ) : tab === 'states' ? (
        <StatesTabLoader supabase={supabase} />
      ) : (
        <BanksTabLoader supabase={supabase} />
      )}
    </main>
  )
}

// Small server-side loaders kept in this file (not the client component
// module) so the data fetch stays a Server Component concern — the
// exported *Tab components in ReferenceAdmin.tsx are client-side and only
// ever receive already-fetched rows as props.
async function CategoriesTabLoader({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase
    .from('categories')
    .select('id, name, group_key, is_state_scoped, requires_sport, requires_committee, sort_order, active')
    .order('sort_order')
  return <CategoriesTab categories={data ?? []} />
}

async function CommitteesTabLoader({
  supabase,
  editionId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  editionId: string | null
}) {
  const { data } = await supabase.from('committees').select('id, name, edition_id, active').order('name')
  return <CommitteesTab committees={data ?? []} editionId={editionId} />
}

async function SportsTabLoader({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from('sports').select('id, name, active').order('name')
  return <SportsTab sports={data ?? []} />
}

async function StatesTabLoader({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from('states').select('id, name, code, active').order('name')
  return <StatesTab states={data ?? []} />
}

async function BanksTabLoader({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from('banks').select('id, name, active').order('name')
  return <BanksTab banks={data ?? []} />
}
