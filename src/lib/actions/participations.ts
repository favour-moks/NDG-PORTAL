'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type WithdrawResult = { ok: true } | { ok: false; error: string }

// Sets exclusion_reason; is_payable recomputes to false automatically
// (it's a generated column). Never deletes — the record stays visible in
// the full list with its reason. RLS's closed-edition restrictive policy
// (008_rls.sql) already rejects this against a closed edition with no
// extra code needed here.
export async function withdrawParticipation(
  participationId: string,
  reason: string
): Promise<WithdrawResult> {
  const profile = await requireRole(['admin', 'editor'])

  const trimmedReason = reason.trim()
  if (!trimmedReason) {
    return { ok: false, error: 'A reason is required to withdraw a participation.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('participations')
    .update({
      exclusion_reason: trimmedReason,
      excluded_by: profile.id,
      excluded_at: new Date().toISOString(),
    })
    .eq('id', participationId)

  if (error) {
    return {
      ok: false,
      error: 'This participation could not be withdrawn. The edition may be closed, or try again.',
    }
  }

  revalidatePath('/participants')
  return { ok: true }
}
