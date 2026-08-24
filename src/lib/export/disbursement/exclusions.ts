import type { Sql } from 'postgres'
import { computeEligibility, type EligibilityReasonCode } from '@/lib/domain/eligibility'
import type { DisbursementFilters } from './generate'

// 'missing_rate' isn't one of computeEligibility()'s four conditions —
// is_payable (the generated column) doesn't know whether a rate was ever
// configured, only accreditation and bank details. generateBatch() treats
// entitlement_amount is not null as an equally unconditional constraint
// alongside is_payable, so this summary has to bucket it the same way or
// the counts stop reconciling with what the batch actually includes.
export type DisbursementExclusionReasonCode = EligibilityReasonCode | 'missing_rate'

export type ExclusionReasonCount = { code: DisbursementExclusionReasonCode; message: string; count: number }

export type ExclusionSummary = {
  totalConsidered: number
  totalPayable: number
  totalExcluded: number
  byReason: ExclusionReasonCount[]
}

type ConsideredRow = {
  is_payable: boolean
  pre_games_accredited: boolean
  arrival_accredited: boolean
  requires_arrival_accreditation: boolean
  exclusion_reason: string | null
  account_number: string | null
  bank_id: string | null
  entitlement_amount: string | null
}

const REASON_MESSAGES: Record<DisbursementExclusionReasonCode, string> = {
  not_pre_games_accredited: 'have not completed pre-games accreditation',
  not_arrival_accredited: 'have not completed arrival accreditation',
  missing_bank_details: 'are missing bank details',
  withdrawn: 'were withdrawn',
  missing_rate: 'have no rate configured for this category',
}

// Same population the batch would draw from, minus the is_payable
// constraint, bucketed by why each excluded person isn't payable — "44
// have not completed arrival accreditation, 3 are missing bank details"
// (roadmap TASK-060). A person can fail more than one condition at once;
// each excluded person is counted under only their first-applicable
// reason (the order computeEligibility already returns them in), which is
// what makes the counts sum exactly to totalExcluded rather than
// over-counting.
export async function computeExclusionSummary(sql: Sql, filters: DisbursementFilters): Promise<ExclusionSummary> {
  const rows = await sql<ConsideredRow[]>`
    select
      p.is_payable, p.pre_games_accredited, p.arrival_accredited,
      p.requires_arrival_accreditation, p.exclusion_reason, p.account_number, p.bank_id,
      p.entitlement_amount
    from participations p
    join persons pe on pe.id = p.person_id
    where p.edition_id = ${filters.editionId}
      ${filters.categoryId ? sql`and p.category_id = ${filters.categoryId}` : sql``}
      ${filters.stateId ? sql`and p.state_id = ${filters.stateId}` : sql``}
      ${filters.sportId ? sql`and p.sport_id = ${filters.sportId}` : sql``}
      ${filters.committeeId ? sql`and p.committee_id = ${filters.committeeId}` : sql``}
      ${filters.bankId ? sql`and p.bank_id = ${filters.bankId}` : sql``}
      ${filters.q?.trim() ? sql`and pe.full_name ilike ${'%' + filters.q.trim() + '%'}` : sql``}
  `

  const counts = new Map<DisbursementExclusionReasonCode, number>()
  let totalPayable = 0

  for (const row of rows) {
    if (row.is_payable && row.entitlement_amount !== null) {
      totalPayable++
      continue
    }
    if (row.is_payable) {
      // Payable per accreditation/bank rules, but no rate resolved at
      // import time — generateBatch() excludes it too (entitlement_amount
      // is not null), so it must land here, not silently in totalPayable.
      counts.set('missing_rate', (counts.get('missing_rate') ?? 0) + 1)
      continue
    }
    const { reasons } = computeEligibility({
      preGamesAccredited: row.pre_games_accredited,
      arrivalAccredited: row.arrival_accredited,
      requiresArrivalAccreditation: row.requires_arrival_accreditation,
      exclusionReason: row.exclusion_reason,
      accountNumber: row.account_number,
      bankId: row.bank_id,
    })
    const primary = reasons[0]?.code
    if (primary) counts.set(primary, (counts.get(primary) ?? 0) + 1)
  }

  const totalExcluded = rows.length - totalPayable

  return {
    totalConsidered: rows.length,
    totalPayable,
    totalExcluded,
    byReason: Array.from(counts.entries())
      .map(([code, count]) => ({ code, message: REASON_MESSAGES[code], count }))
      .sort((a, b) => b.count - a.count),
  }
}
