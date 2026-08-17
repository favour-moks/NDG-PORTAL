import { describe, expect, it } from 'vitest'
import { resolveBank, type BankRecord } from './banks'

const banks: BankRecord[] = [
  { id: '000013', name: 'Guaranty Trust Bank', aliases: ['GTBANK', 'GTB', 'GUARANTY TRUST BANK'] },
  { id: '000012', name: 'Stanbic IBTC Bank', aliases: ['STANBIC IBTC BANK', 'STANBIC IBTC', 'STANBIC'] },
  { id: '000004', name: 'United Bank for Africa', aliases: ['UNITED BANK FOR AFRICA', 'UBA'] },
]

describe('resolveBank', () => {
  it('matches the canonical name case-insensitively', () => {
    expect(resolveBank('guaranty trust bank', banks)).toEqual({ ok: true, bankId: '000013' })
  })

  it('matches an alias case-insensitively', () => {
    expect(resolveBank('gtbank', banks)).toEqual({ ok: true, bankId: '000013' })
  })

  it('matches all 11-style variants used in real import data', () => {
    expect(resolveBank('STANBIC IBTC BANK', banks)).toEqual({ ok: true, bankId: '000012' })
    expect(resolveBank('UNITED BANK FOR AFRICA', banks)).toEqual({ ok: true, bankId: '000004' })
  })

  it('rejects an unrecognised name, showing the value, never guessing', () => {
    const result = resolveBank('Totally Made Up Bank', banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('Totally Made Up Bank')
    }
  })

  it('rejects a missing value', () => {
    expect(resolveBank('  ', banks).ok).toBe(false)
  })
})
