// Mirrors the is_payable generated column exactly (supabase/migrations/
// 003_people.sql, amended by 011_arrival_requirement.sql) — this is what
// makes "eligibility is computed" legible to a sceptical payment lead: the
// same four conditions, phrased as reasons instead of a boolean. If the
// database formula changes, this must change with it.
export type EligibilityInput = {
  preGamesAccredited: boolean
  arrivalAccredited: boolean
  requiresArrivalAccreditation: boolean
  exclusionReason: string | null
  accountNumber: string | null
  bankId: string | null
}

export type EligibilityReasonCode =
  | 'not_pre_games_accredited'
  | 'not_arrival_accredited'
  | 'missing_bank_details'
  | 'withdrawn'

export type EligibilityReason = { code: EligibilityReasonCode; message: string }

export type EligibilityResult = {
  payable: boolean
  reasons: EligibilityReason[]
}

export function computeEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: EligibilityReason[] = []

  if (!input.preGamesAccredited) {
    reasons.push({ code: 'not_pre_games_accredited', message: 'Not pre-games accredited' })
  }
  if (input.requiresArrivalAccreditation && !input.arrivalAccredited) {
    reasons.push({ code: 'not_arrival_accredited', message: 'Not arrival accredited' })
  }
  if (!input.accountNumber || !input.bankId) {
    reasons.push({ code: 'missing_bank_details', message: 'Missing bank details' })
  }
  if (input.exclusionReason) {
    reasons.push({ code: 'withdrawn', message: `Withdrawn — ${input.exclusionReason}` })
  }

  return { payable: reasons.length === 0, reasons }
}
