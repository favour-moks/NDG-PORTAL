'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type EditionActionResult = { ok: true } | { ok: false; error: string }

// Editors may create and activate editions; only admins may close one
// (PRD § 9 role table: editor is "all except edition close and user role
// changes"). Draft -> active -> closed. Only one active edition at a time
// is enforced by the partial unique index from TASK-006 — activating a
// second one fails rather than silently closing the first, because
// closing is a deliberate, admin-only, irreversible action, not a side
// effect of someone else activating a new edition.
export async function createEdition(input: { name: string; year: number }): Promise<EditionActionResult> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .insert({ name: input.name, year: input.year, status: 'draft' })

  if (error) {
    return {
      ok: false,
      error: 'This edition could not be created. That name and year combination may already exist.',
    }
  }

  revalidatePath('/admin/editions')
  return { ok: true }
}

export async function activateEdition(editionId: string): Promise<EditionActionResult> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const { error } = await supabase.from('editions').update({ status: 'active' }).eq('id', editionId)

  if (error) {
    return {
      ok: false,
      error: 'This edition could not be activated. Another edition may already be active — close it first.',
    }
  }

  revalidatePath('/admin/editions')
  return { ok: true }
}

export async function closeEdition(editionId: string): Promise<EditionActionResult> {
  await requireRole(['admin'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('editions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', editionId)

  if (error) {
    return { ok: false, error: 'This edition could not be closed. Try again.' }
  }

  revalidatePath('/admin/editions')
  return { ok: true }
}
