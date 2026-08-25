'use server'

import { revalidatePath } from 'next/cache'
import { requireRole, type Role } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
// Service-role client: inviteUserByEmail() and deleting a user are Auth
// Admin API calls with no user-scoped equivalent — this is one of
// admin.ts's explicitly permitted uses (sending invites).
import { createAdminClient } from '@/lib/supabase/admin'

export type UserActionResult = { ok: true } | { ok: false; error: string }

// Per FR-019/the Auth Flow (prd.md § 9): no password is ever generated or
// emailed — inviteUserByEmail() sends a link, the invitee sets their own
// password on accept-invite. user_profiles and user_state_access can't
// share a real transaction with the Auth Admin API call (it's a separate
// service), so a profile-write failure after a successful invite is
// compensated by deleting the just-created auth user rather than leaving
// a half-provisioned account with no profile.
export async function inviteUser(input: {
  email: string
  fullName: string
  role: Role
  stateIds?: string[]
  categoryIds?: string[]
}): Promise<UserActionResult> {
  // Editors may invite (Auth Flow step 1); only admins change an
  // existing user's role or deactivate them (role table, prd.md § 9).
  await requireRole(['admin', 'editor'])

  if (!input.email.trim() || !input.fullName.trim()) {
    return { ok: false, error: 'Enter an email address and a full name.' }
  }
  if (input.role === 'viewer' && (!input.stateIds || input.stateIds.length === 0)) {
    return { ok: false, error: 'Assign at least one state to a viewer.' }
  }

  const admin = createAdminClient()
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email.trim(),
    { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite` }
  )

  if (inviteError || !invited.user) {
    return { ok: false, error: 'This invite could not be sent. Check the email address.' }
  }

  const userId = invited.user.id
  const supabase = await createClient()

  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({ id: userId, full_name: input.fullName.trim(), role: input.role })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { ok: false, error: 'This invite could not be completed. Try again.' }
  }

  if (input.stateIds && input.stateIds.length > 0) {
    await supabase
      .from('user_state_access')
      .insert(input.stateIds.map((stateId) => ({ user_id: userId, state_id: stateId })))
  }
  if (input.categoryIds && input.categoryIds.length > 0) {
    await supabase
      .from('user_category_access')
      .insert(input.categoryIds.map((categoryId) => ({ user_id: userId, category_id: categoryId })))
  }

  revalidatePath('/admin/users')
  return { ok: true }
}

// Admin only. The account keeps existing (and could be reactivated) —
// this flips the flag getSessionProfile() checks on every request, which
// is what makes a live session stop working on its next request rather
// than only on the next sign-in (TASK-077).
export async function deactivateUser(userId: string): Promise<UserActionResult> {
  await requireRole(['admin'])
  const supabase = await createClient()

  const { error } = await supabase.from('user_profiles').update({ active: false }).eq('id', userId)
  if (error) return { ok: false, error: 'This user could not be deactivated.' }

  revalidatePath('/admin/users')
  return { ok: true }
}

export async function reactivateUser(userId: string): Promise<UserActionResult> {
  await requireRole(['admin'])
  const supabase = await createClient()

  const { error } = await supabase.from('user_profiles').update({ active: true }).eq('id', userId)
  if (error) return { ok: false, error: 'This user could not be reactivated.' }

  revalidatePath('/admin/users')
  return { ok: true }
}
