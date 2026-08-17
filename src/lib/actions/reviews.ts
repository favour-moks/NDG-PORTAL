'use server'

import { revalidatePath } from 'next/cache'
import postgres from 'postgres'
import { requireRole } from '@/lib/auth/guards'

export type ResolveReviewResult =
  | { ok: true; status: 'confirmed_duplicate' | 'dismissed'; resolvedByMe: boolean }
  | { ok: false; error: string }

// Direct postgres.js connection, not the user-scoped supabase-js client:
// confirming a duplicate touches duplicate_reviews AND participations
// together, and that must be one atomic write, not two independent RLS-
// checked calls that could partially apply. The role check below is the
// access control this bypasses RLS for.
export async function resolveReview(
  reviewId: string,
  resolution: 'confirmed_duplicate' | 'dismissed',
  note: string
): Promise<ResolveReviewResult> {
  const profile = await requireRole(['admin', 'editor'])
  const sql = postgres(process.env.DATABASE_URL as string)

  try {
    const result = await sql.begin(async (tx) => {
      // Conditional on status = 'open': this is what makes concurrent
      // resolution safe. If two editors submit at once, exactly one UPDATE
      // matches a row; the other sees zero rows updated below and reports
      // the existing outcome instead of erroring.
      const [updated] = await tx<{ id: string; status: string; participation_id: string }[]>`
        update duplicate_reviews
        set status = ${resolution}, resolved_by = ${profile.id}, resolved_at = now(), resolution_note = ${note}
        where id = ${reviewId} and status = 'open'
        returning id, status, participation_id
      `

      if (updated) {
        if (resolution === 'confirmed_duplicate') {
          // Withdraws the newer participation (the one this import created).
          // Never deletes.
          await tx`
            update participations
            set exclusion_reason = ${`Duplicate — ${note || 'confirmed in review queue'}`}
            where id = ${updated.participation_id}
          `
        }
        return {
          ok: true as const,
          status: updated.status as 'confirmed_duplicate' | 'dismissed',
          resolvedByMe: true,
        }
      }

      const [existing] = await tx<{ status: string }[]>`
        select status from duplicate_reviews where id = ${reviewId}
      `
      if (!existing || existing.status === 'open') {
        return { ok: false as const, error: 'This review could not be found.' }
      }
      return {
        ok: true as const,
        status: existing.status as 'confirmed_duplicate' | 'dismissed',
        resolvedByMe: false,
      }
    })

    revalidatePath('/review')
    return result
  } finally {
    await sql.end()
  }
}
