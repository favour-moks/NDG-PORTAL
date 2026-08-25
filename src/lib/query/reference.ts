import { createClient } from '@/lib/supabase/server'

export type ReferenceOption = { id: string; name: string }

export type CategoryOption = ReferenceOption & {
  groupKey: string
  isStateScoped: boolean
  requiresSport: boolean
  requiresCommittee: boolean
  sortOrder: number
}

// A viewer's assigned state(s) — user_state_access is many-to-many in the
// schema, but in practice a viewer represents exactly one state. Callers
// handle 0 (no assignment yet) and >1 (edge case) explicitly rather than
// assuming the common case.
export async function listViewerStates(userId: string): Promise<ReferenceOption[]> {
  const supabase = await createClient()
  const { data: access } = await supabase
    .from('user_state_access')
    .select('state_id')
    .eq('user_id', userId)
  const stateIds = (access ?? []).map((row) => row.state_id)
  if (stateIds.length === 0) return []

  const { data: states } = await supabase.from('states').select('id, name').in('id', stateIds)
  return states ?? []
}

export async function listStates(): Promise<ReferenceOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('states')
    .select('id, name')
    .eq('active', true)
    .order('name')
  return data ?? []
}

export async function listCategories(groupKey: string): Promise<CategoryOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, group_key, is_state_scoped, requires_sport, requires_committee, sort_order')
    .eq('group_key', groupKey)
    .eq('active', true)
    .order('sort_order')
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    groupKey: c.group_key,
    isStateScoped: c.is_state_scoped,
    requiresSport: c.requires_sport,
    requiresCommittee: c.requires_committee,
    sortOrder: c.sort_order,
  }))
}

// Every active category regardless of group — the DRM index links to
// /drm/[category] for any of them, since state scoping (if any) is a
// filter chosen on that page, not a route dimension there.
export async function listAllCategories(): Promise<CategoryOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, group_key, is_state_scoped, requires_sport, requires_committee, sort_order')
    .eq('active', true)
    .order('sort_order')
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    groupKey: c.group_key,
    isStateScoped: c.is_state_scoped,
    requiresSport: c.requires_sport,
    requiresCommittee: c.requires_committee,
    sortOrder: c.sort_order,
  }))
}

export async function listSports(): Promise<ReferenceOption[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('sports').select('id, name').eq('active', true).order('name')
  return data ?? []
}

export async function listCommittees(editionId: string): Promise<ReferenceOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('committees')
    .select('id, name')
    .eq('active', true)
    .or(`edition_id.eq.${editionId},edition_id.is.null`)
    .order('name')
  return data ?? []
}

export async function listBanks(): Promise<ReferenceOption[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('banks').select('id, name').eq('active', true).order('name')
  return data ?? []
}
