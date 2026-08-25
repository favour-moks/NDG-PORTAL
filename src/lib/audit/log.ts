import { headers } from 'next/headers'
import { getSessionProfile } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

export type AccessLogAction =
  | 'list'
  | 'view_person'
  | 'export'
  | 'disbursement_generate'
  | 'reveal_identifier'
  | 'permission_denied'

// Per FR-018: every beneficiary read and every export writes user, role,
// route, action, edition, filters, record count and IP. This is the one
// place that assembly happens, so every call site gets IP capture and the
// same failure behaviour for free — a logging failure must never block
// the request it's describing, so every error here is swallowed, not
// thrown. Called from Server Components, Server Actions and Route
// Handlers alike; `headers()` and the RLS-scoped client both work in all
// three.
export async function logAccess(params: {
  action: AccessLogAction
  route: string
  editionId?: string | null
  filters?: Record<string, unknown> | null
  recordCount?: number | null
}): Promise<void> {
  try {
    const profile = await getSessionProfile()
    if (!profile) return

    const headerList = await headers()
    const ip =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      null

    const supabase = await createClient()
    await supabase.from('access_logs').insert({
      user_id: profile.id,
      role: profile.role,
      route: params.route,
      action: params.action,
      edition_id: params.editionId ?? null,
      // Filter objects are plain, JSON-serialisable data (ParticipationFilters
      // and friends) — the mismatch here is TS's Json type rejecting
      // Record<string, unknown> structurally, not an actual encoding risk.
      filters: (params.filters ?? null) as Json,
      record_count: params.recordCount ?? null,
      ip,
    })
  } catch {
    // Logging must never block the request it's describing.
  }
}
