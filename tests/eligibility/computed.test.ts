import { describe, expect, it } from 'vitest'
import { computeEligibility, type EligibilityInput } from '@/lib/domain/eligibility'

function base(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    preGamesAccredited: true,
    arrivalAccredited: true,
    requiresArrivalAccreditation: true,
    exclusionReason: null,
    accountNumber: '0033558463',
    bankId: '000013',
    ...overrides,
  }
}

describe('computeEligibility', () => {
  it('is payable when every condition is met', () => {
    expect(computeEligibility(base())).toEqual({ payable: true, reasons: [] })
  })

  it('is not payable without pre-games accreditation', () => {
    const result = computeEligibility(base({ preGamesAccredited: false }))
    expect(result.payable).toBe(false)
    expect(result.reasons.map((r) => r.code)).toContain('not_pre_games_accredited')
  })

  it('is not payable without arrival accreditation when required', () => {
    const result = computeEligibility(base({ arrivalAccredited: false, requiresArrivalAccreditation: true }))
    expect(result.payable).toBe(false)
    expect(result.reasons.map((r) => r.code)).toContain('not_arrival_accredited')
  })

  it('is payable without arrival accreditation when the category does not require it (LOC)', () => {
    const result = computeEligibility(base({ arrivalAccredited: false, requiresArrivalAccreditation: false }))
    expect(result.payable).toBe(true)
    expect(result.reasons).toEqual([])
  })

  it('is not payable without an account number', () => {
    const result = computeEligibility(base({ accountNumber: null }))
    expect(result.payable).toBe(false)
    expect(result.reasons.map((r) => r.code)).toContain('missing_bank_details')
  })

  it('is not payable without a bank', () => {
    const result = computeEligibility(base({ bankId: null }))
    expect(result.payable).toBe(false)
    expect(result.reasons.map((r) => r.code)).toContain('missing_bank_details')
  })

  it('is not payable when withdrawn, and names the reason given', () => {
    const result = computeEligibility(base({ exclusionReason: 'Duplicate of another record' }))
    expect(result.payable).toBe(false)
    const withdrawn = result.reasons.find((r) => r.code === 'withdrawn')
    expect(withdrawn?.message).toContain('Duplicate of another record')
  })

  it('reports every unmet condition independently, not just the first', () => {
    const result = computeEligibility(
      base({ preGamesAccredited: false, arrivalAccredited: false, accountNumber: null, exclusionReason: 'test' })
    )
    expect(result.reasons.map((r) => r.code).sort()).toEqual(
      ['missing_bank_details', 'not_arrival_accredited', 'not_pre_games_accredited', 'withdrawn'].sort()
    )
  })
})
