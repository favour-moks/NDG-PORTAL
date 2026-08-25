import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
// Service-role client: last_sign_in_at lives in auth.users, which
// PostgREST/supabase-js's RLS-scoped client can't read — this is one of
// admin.ts's explicitly permitted uses (Admin — Users screen).
import { createAdminClient } from '@/lib/supabase/admin'
import { listStates } from '@/lib/query/reference'
import { UsersAdmin } from './UsersAdmin'

export default async function AdminUsersPage() {
  const profile = await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const [{ data: profiles }, { data: stateAccess }, states] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, role, active, created_at')
      .order('full_name'),
    supabase.from('user_state_access').select('user_id, state_id'),
    listStates(),
  ])

  const stateNameById = new Map(states.map((s) => [s.id, s.name]))
  const stateNamesByUser = new Map<string, string[]>()
  for (const row of stateAccess ?? []) {
    const names = stateNamesByUser.get(row.user_id) ?? []
    const name = stateNameById.get(row.state_id)
    if (name) names.push(name)
    stateNamesByUser.set(row.user_id, names)
  }

  // Auth Admin API — last_sign_in_at isn't in user_profiles.
  const admin = createAdminClient()
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const lastSignInById = new Map(authUsers.users.map((u) => [u.id, u.last_sign_in_at ?? null]))

  const users = (profiles ?? []).map((p) => {
    const lastSignInAt = lastSignInById.get(p.id) ?? null
    return {
      id: p.id,
      fullName: p.full_name,
      role: p.role as 'admin' | 'editor' | 'viewer',
      active: p.active,
      stateNames: stateNamesByUser.get(p.id) ?? [],
      // Formatted here, once, server-side — not in the client component,
      // where the exact same new Date().toLocaleString() call can
      // legitimately produce a different string on the server (Node's
      // default locale/timezone) than on the client during hydration,
      // which React reports as a hydration mismatch.
      lastSignInDisplay: lastSignInAt ? new Date(lastSignInAt).toLocaleString() : 'Never',
    }
  })

  return (
    <main>
      <h1>Users</h1>
      <UsersAdmin users={users} states={states} isAdmin={profile.role === 'admin'} />
    </main>
  )
}
