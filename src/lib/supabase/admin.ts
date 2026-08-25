import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client. RLS DOES NOT APPLY — every row is visible and writable.
//
// Permitted uses ONLY:
//   - Sending user invites (auth.admin.inviteUserByEmail)
//   - Import writes (server-side, after validation)
//   - Export/disbursement file generation (bypassing the 1,000-row default cap)
//   - Reference-data seeding
//   - Admin — Users screen: last sign-in (auth.admin.listUsers) and account
//     deletion as a compensating action when inviteUser()'s profile write fails
//
// Every call site that imports this file must carry a comment explaining why
// it needs to bypass RLS. Never import this from a Client Component or expose
// SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
