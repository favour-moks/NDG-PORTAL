'use server'

import postgres from 'postgres'
import { requireRole } from '@/lib/auth/guards'
import { computeExclusionSummary, type ExclusionSummary } from '@/lib/export/disbursement/exclusions'
import type { DisbursementFilters } from '@/lib/export/disbursement/generate'

// A read, so it's a server action rather than the /api/disbursement route
// handler — that route is reserved for the actual file-streaming
// generation step (API philosophy, prd.md § 4). This is what
// GenerateBatch.tsx calls to show the exclusion breakdown *before* the
// user commits to a reference and confirms.
export async function previewExclusions(filters: DisbursementFilters): Promise<ExclusionSummary> {
  await requireRole(['admin', 'editor'])
  const sql = postgres(process.env.DATABASE_URL as string)
  try {
    return await computeExclusionSummary(sql, filters)
  } finally {
    await sql.end()
  }
}
