import type { Sql } from 'postgres'
import type { BatchRow } from './types'

export type DisbursementFilters = {
  editionId: string
  categoryId?: string
  stateId?: string
  sportId?: string
  committeeId?: string
  bankId?: string
  q?: string
}

export type GenerateBatchParams = {
  filters: DisbursementFilters
  reference: string
  description?: string
  generatedBy: string
  // Set once the caller has already seen and dismissed the
  // duplicate-recent-batch warning below — "may proceed deliberately"
  // (PRD § 11 Edge Cases > Eligibility & Disbursement).
  force?: boolean
}

export type GenerateBatchResult =
  | { ok: true; batchId: string; reference: string; recordCount: number; totalAmount: number; rows: BatchRow[] }
  | {
      ok: false
      reason: 'duplicate_recent_batch'
      existingReference: string
      existingCount: number
      existingGeneratedAt: string
    }
  | { ok: false; reason: 'no_payable_rows' }
  | { ok: false; reason: 'duplicate_reference' }

type PayableRow = {
  participation_id: string
  full_name: string
  account_name: string | null
  account_number: string
  bank_id: string
  bank_name: string
  entitlement_amount: string
}

// The whole thing is one transaction: the payable population is selected,
// the batch and its pending payments are written, all inside it — so a
// concurrent accreditation change or a second generation from the same
// filter can't interleave with this one. Runs on a direct postgres.js
// connection (bypasses RLS) for the same reason resolveReview() does
// (src/lib/actions/reviews.ts): the role check happens in the caller
// before this is ever invoked, and a multi-table atomic write isn't
// expressible through the RLS-scoped supabase-js client.
export async function generateBatch(sql: Sql, params: GenerateBatchParams): Promise<GenerateBatchResult> {
  try {
    return await sql.begin(async (tx) => {
      if (!params.force) {
        const [recent] = await tx<{ reference: string; record_count: number; generated_at: string }[]>`
          select reference, record_count, generated_at
          from payment_batches
          where edition_id = ${params.filters.editionId}
            and filter_json = ${tx.json(params.filters)}
            and generated_at > now() - interval '1 hour'
          order by generated_at desc
          limit 1
        `
        if (recent) {
          return {
            ok: false,
            reason: 'duplicate_recent_batch',
            existingReference: recent.reference,
            existingCount: recent.record_count,
            existingGeneratedAt: recent.generated_at,
          }
        }
      }

      // is_payable = true is unconditional here — there is no parameter
      // that can relax it (TASK-059). entitlement_amount is not null is a
      // second, equally unconditional constraint: is_payable (the
      // generated column, 003_people.sql) only encodes accreditation and
      // bank-detail conditions, not whether a rate was ever configured
      // for this category/sport/edition (TASK-067) — without this, a
      // payable-but-unrated participation would reach the insert below
      // and violate payments.amount's NOT NULL constraint. Every other
      // dimension is optional, matching the same filter shape the
      // participants list uses.
      const rows = await tx<PayableRow[]>`
        select
          p.id as participation_id, pe.full_name, p.account_name, p.account_number,
          p.bank_id, b.name as bank_name, p.entitlement_amount
        from participations p
        join persons pe on pe.id = p.person_id
        join banks b on b.id = p.bank_id
        where p.edition_id = ${params.filters.editionId}
          and p.is_payable = true
          and p.entitlement_amount is not null
          ${params.filters.categoryId ? tx`and p.category_id = ${params.filters.categoryId}` : tx``}
          ${params.filters.stateId ? tx`and p.state_id = ${params.filters.stateId}` : tx``}
          ${params.filters.sportId ? tx`and p.sport_id = ${params.filters.sportId}` : tx``}
          ${params.filters.committeeId ? tx`and p.committee_id = ${params.filters.committeeId}` : tx``}
          ${params.filters.bankId ? tx`and p.bank_id = ${params.filters.bankId}` : tx``}
          ${params.filters.q?.trim() ? tx`and pe.full_name ilike ${'%' + params.filters.q.trim() + '%'}` : tx``}
        order by pe.full_name, p.id
      `

      if (rows.length === 0) {
        return { ok: false, reason: 'no_payable_rows' }
      }

      const totalAmount = rows.reduce((sum, row) => sum + Number(row.entitlement_amount), 0)

      const [batch] = await tx<{ id: string }[]>`
        insert into payment_batches (
          edition_id, reference, description, filter_json, generated_by, total_amount, record_count
        ) values (
          ${params.filters.editionId}, ${params.reference}, ${params.description ?? null},
          ${tx.json(params.filters)}, ${params.generatedBy}, ${totalAmount}, ${rows.length}
        )
        returning id
      `

      // Minted once, here, per row — and stored as partner_reference
      // immediately, before the file is even rendered. This is the
      // identifier the result-file matcher (payment-results.ts) looks
      // for first; the file just needs to carry the same value back out.
      const transactionIdByParticipation = new Map(
        rows.map((row, index) => [
          row.participation_id,
          `${params.reference}-${String(index + 1).padStart(4, '0')}`,
        ])
      )

      for (const row of rows) {
        const transactionId = transactionIdByParticipation.get(row.participation_id) as string
        await tx`
          insert into payments (batch_id, participation_id, amount, account_number, bank_id, status, partner_reference)
          values (
            ${batch.id}, ${row.participation_id}, ${row.entitlement_amount},
            ${row.account_number}, ${row.bank_id}, 'pending', ${transactionId}
          )
        `
      }

      return {
        ok: true,
        batchId: batch.id,
        reference: params.reference,
        recordCount: rows.length,
        totalAmount,
        rows: rows.map((row) => ({
          participationId: row.participation_id,
          transactionId: transactionIdByParticipation.get(row.participation_id) as string,
          fullName: row.full_name,
          accountName: row.account_name,
          accountNumber: row.account_number,
          bankId: row.bank_id,
          bankName: row.bank_name,
          amount: Number(row.entitlement_amount),
        })),
      }
    })
  } catch (error) {
    // 23505 = unique_violation, on payment_batches(edition_id, reference).
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return { ok: false, reason: 'duplicate_reference' }
    }
    throw error
  }
}
