'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type RateActionResult = { ok: true } | { ok: false; error: string }

// Rates are read ONCE, at import time (src/lib/import/persist.ts resolves
// and snapshots entitlement_amount onto the participation there) — never
// looked up live when a payment is made. That's what makes "changing a
// rate must not alter historical payments" (FR-021) true by construction:
// editing here can only affect participations imported after the edit.
export async function upsertRate(input: {
  editionId: string
  categoryId: string
  sportId: string | null
  amount: number
}): Promise<RateActionResult> {
  await requireRole(['admin', 'editor'])
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' }
  }

  const supabase = await createClient()

  // Not a plain .upsert({...}, { onConflict }) — the unique constraint is
  // (edition_id, category_id, sport_id), and Postgres never treats two
  // NULLs as conflicting, so ON CONFLICT silently misses every
  // category-wide rate (sport_id null) and inserts a duplicate instead of
  // updating. Matching sport_id explicitly with .is()/.eq() first avoids
  // that.
  let existingQuery = supabase
    .from('rates')
    .select('id')
    .eq('edition_id', input.editionId)
    .eq('category_id', input.categoryId)
  existingQuery = input.sportId === null ? existingQuery.is('sport_id', null) : existingQuery.eq('sport_id', input.sportId)
  const { data: existing } = await existingQuery.maybeSingle()

  const { error } = existing
    ? await supabase.from('rates').update({ amount: input.amount }).eq('id', existing.id)
    : await supabase.from('rates').insert({
        edition_id: input.editionId,
        category_id: input.categoryId,
        sport_id: input.sportId,
        amount: input.amount,
      })

  if (error) {
    return { ok: false, error: 'This rate could not be saved.' }
  }

  revalidatePath('/admin/reference/rates')
  return { ok: true }
}

export async function deleteRate(rateId: string): Promise<RateActionResult> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()
  const { error } = await supabase.from('rates').delete().eq('id', rateId)

  if (error) {
    return { ok: false, error: 'This rate could not be removed.' }
  }

  revalidatePath('/admin/reference/rates')
  return { ok: true }
}
