import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAccess } from '@/lib/audit/log'

export type Role = 'admin' | 'editor' | 'viewer'

export type SessionProfile = {
  id: string
  email: string | null
  fullName: string
  role: Role
}

// Fetches the current user and their profile/role once. Server Components
// downstream should receive this as a prop rather than re-querying it.
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient()

  // getUser() verifies the JWT against Supabase Auth; getSession() does not
  // and must never be used for authorization decisions on the server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // A deactivated account keeps a valid Supabase Auth session (deactivation
  // is a user_profiles flag, not an Auth-level disable) — checking `active`
  // here, on every request, is what makes "deactivated user's live session
  // is invalidated on the next request" (TASK-077) actually true, rather
  // than only true for a fresh sign-in attempt.
  if (!profile.active) {
    await supabase.auth.signOut()
    return null
  }

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    role: profile.role as Role,
  }
}

export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile()
  if (!profile) redirect('/sign-in')
  return profile
}

export async function requireRole(allowed: Role[]): Promise<SessionProfile> {
  const profile = await requireSession()
  if (!allowed.includes(profile.role)) {
    // x-pathname is set by middleware.ts (updateSession()) on every
    // request — headers() itself has no route-path accessor.
    const headerList = await headers()
    const route = headerList.get('x-pathname') ?? 'unknown'
    await logAccess({ action: 'permission_denied', route })
    redirect('/access-denied')
  }
  return profile
}
