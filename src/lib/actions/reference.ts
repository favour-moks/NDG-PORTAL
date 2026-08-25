'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type ReferenceActionResult = { ok: true } | { ok: false; error: string }

// The only five tables this screen may touch, and the only fields on
// each it may write — an allowlist on both axes, since `table` and
// `patch` both ultimately come from client input and this is the one
// place standing between that and an arbitrary write (FR-020).
const EDITABLE_FIELDS = {
  categories: ['name', 'group_key', 'is_state_scoped', 'requires_sport', 'requires_committee', 'sort_order', 'active'],
  committees: ['name', 'edition_id', 'active'],
  sports: ['name', 'active'],
  states: ['name', 'code', 'active'],
  banks: ['id', 'name', 'active'],
} as const

export type ReferenceTable = keyof typeof EDITABLE_FIELDS

function sanitize(table: ReferenceTable, values: Record<string, unknown>): Record<string, unknown> {
  const allowed: readonly string[] = EDITABLE_FIELDS[table]
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.includes(key)))
}

// Per FR-020: this screen is what makes the next edition an afternoon
// rather than a code change — adding a committee here must be visible in
// LOC filters immediately, with no deployment.
export async function createReferenceRow(
  table: ReferenceTable,
  values: Record<string, unknown>
): Promise<ReferenceActionResult> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()
  const { error } = await supabase.from(table).insert(sanitize(table, values) as never)

  if (error) {
    return { ok: false, error: `This ${table.slice(0, -1)} could not be created. The name may already exist.` }
  }

  revalidatePath('/admin/reference')
  return { ok: true }
}

export async function setReferenceRowActive(
  table: ReferenceTable,
  id: string,
  active: boolean
): Promise<ReferenceActionResult> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()
  const { error } = await supabase.from(table).update({ active } as never).eq('id', id)

  if (error) {
    return { ok: false, error: `This ${table.slice(0, -1)} could not be updated.` }
  }

  revalidatePath('/admin/reference')
  return { ok: true }
}
