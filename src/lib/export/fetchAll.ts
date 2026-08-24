import { listParticipations } from '@/lib/query/participations'
import type { ParticipationFilters, ParticipationListRow } from '@/lib/query/participations'

const EXPORT_PAGE_SIZE = 1000

// Exports need the full filtered result set, not one UI page — paginated
// at supabase-js's soft row cap (1000) rather than the list's 50-row page
// size, to keep round-trips low while staying well within the export's
// 10s/20s budget at the ~3,000-row target. Runs through the exact same
// RLS-scoped client and filters as the list, which is what guarantees the
// export row count always matches the screen's totalCount.
export async function fetchAllParticipations(filters: ParticipationFilters): Promise<ParticipationListRow[]> {
  const rows: ParticipationListRow[] = []
  let cursor: string | null = null

  for (;;) {
    const page = await listParticipations(filters, cursor, EXPORT_PAGE_SIZE)
    rows.push(...page.rows)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return rows
}
