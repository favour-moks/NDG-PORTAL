import { createClient } from '@/lib/supabase/server'

export type ChecklistCell = { uploadedAt: string; uploaderName: string }

export type ImportChecklist = {
  states: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  cellByKey: Map<string, ChecklistCell>
}

// State × state-scoped-category grid, derived entirely from import_runs —
// no separate bookkeeping table (FR-023). Shared by the checklist screen
// (TASK-056, full grid) and the home work queue (TASK-057, just a count)
// so "uploaded" means the same thing in both places: the most recent
// *completed* beneficiaries run for that (state, category) pair.
export async function getImportChecklist(editionId: string): Promise<ImportChecklist> {
  const supabase = await createClient()
  const [{ data: states }, { data: categories }, { data: runs }] = await Promise.all([
    supabase.from('states').select('id, name').eq('active', true).order('name'),
    supabase
      .from('categories')
      .select('id, name')
      .eq('group_key', 'participants')
      .eq('is_state_scoped', true)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('import_runs')
      .select('state_id, category_id, uploaded_by, created_at')
      .eq('edition_id', editionId)
      .eq('kind', 'beneficiaries')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
  ])

  const uploaderIds = [...new Set((runs ?? []).map((r) => r.uploaded_by))]
  const { data: uploaders } =
    uploaderIds.length > 0
      ? await supabase.from('user_profiles').select('id, full_name').in('id', uploaderIds)
      : { data: [] as { id: string; full_name: string }[] }
  const uploaderNameById = new Map((uploaders ?? []).map((u) => [u.id, u.full_name]))

  // runs is already newest-first, so the first entry seen per (state,
  // category) pair is the one that counts — later duplicates are ignored.
  const cellByKey = new Map<string, ChecklistCell>()
  for (const run of runs ?? []) {
    if (!run.state_id || !run.category_id) continue
    const key = `${run.state_id}:${run.category_id}`
    if (cellByKey.has(key)) continue
    cellByKey.set(key, {
      uploadedAt: run.created_at,
      uploaderName: uploaderNameById.get(run.uploaded_by) ?? 'Unknown',
    })
  }

  return { states: states ?? [], categories: categories ?? [], cellByKey }
}
