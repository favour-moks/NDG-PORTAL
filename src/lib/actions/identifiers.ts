'use server'

import postgres from 'postgres'
import { requireRole } from '@/lib/auth/guards'
import { logAccess } from '@/lib/audit/log'

export type RevealIdentifierResult =
  | { ok: true; bvn: string | null; nin: string | null }
  | { ok: false; error: string }

// Per FR-024: editors and admins only (both already see every person and
// every financial detail, so unlike viewers there's no additional
// per-record authorization to check beyond the role itself). Decrypts
// server-side and returns the value exactly once — the caller must not
// cache it. Every call is logged, matching the masked path in
// personDetail.ts, which is intentionally NOT logged as a reveal — only
// this, the actual unmasked return, is.
export async function revealIdentifier(personId: string): Promise<RevealIdentifierResult> {
  await requireRole(['admin', 'editor'])

  const sql = postgres(process.env.DATABASE_URL as string)
  try {
    const [person] = await sql<{ bvn_encrypted: Buffer | null; nin_encrypted: Buffer | null }[]>`
      select bvn_encrypted, nin_encrypted from persons where id = ${personId}
    `
    if (!person) return { ok: false, error: 'That person could not be found.' }

    const key = process.env.PII_ENCRYPTION_KEY as string
    const [decrypted] = await sql<{ bvn: string | null; nin: string | null }[]>`
      select
        ${person.bvn_encrypted ? sql`decrypt_identifier(bvn_encrypted, ${key})` : sql`null`} as bvn,
        ${person.nin_encrypted ? sql`decrypt_identifier(nin_encrypted, ${key})` : sql`null`} as nin
      from persons where id = ${personId}
    `

    await logAccess({ action: 'reveal_identifier', route: 'reveal-identifier', recordCount: 1 })

    return { ok: true, bvn: decrypted?.bvn ?? null, nin: decrypted?.nin ?? null }
  } finally {
    await sql.end()
  }
}
