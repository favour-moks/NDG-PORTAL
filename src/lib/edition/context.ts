import { createClient } from '@/lib/supabase/server'

export type EditionContext = {
  id: string
  name: string
  status: string
  isReference: boolean
}

// Resolves the edition a page should scope its data to: the `edition`
// search param when present (so a specific view is shareable by URL),
// otherwise the active edition. Returns null if neither resolves to a
// real edition — callers show an appropriate empty state.
export async function resolveEdition(editionIdParam?: string): Promise<EditionContext | null> {
  const supabase = await createClient()

  if (editionIdParam) {
    const { data } = await supabase
      .from('editions')
      .select('id, name, status, is_reference')
      .eq('id', editionIdParam)
      .maybeSingle()
    if (data) {
      return { id: data.id, name: data.name, status: data.status, isReference: data.is_reference }
    }
  }

  const { data } = await supabase
    .from('editions')
    .select('id, name, status, is_reference')
    .eq('status', 'active')
    .maybeSingle()

  return data ? { id: data.id, name: data.name, status: data.status, isReference: data.is_reference } : null
}
