import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

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
  if (!allowed.includes(profile.role)) redirect('/')
  return profile
}
