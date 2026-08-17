import { describe, expect, it } from 'vitest'
import type { BankRecord } from '@/lib/domain/banks'
import type { ParsedRow } from './parse'
import { validateRow } from './validate'

const banks: BankRecord[] = [
  { id: '000013', name: 'Guaranty Trust Bank', aliases: ['GTBANK', 'GTB'] },
]

function row(overrides: Partial<Record<string, string>> = {}): ParsedRow {
  return {
    rowNumber: 2,
    'Full Name': 'Ada Obi',
    'Account Name': 'ADA OBI',
    'Account Number': '0033558463',
    'Bank Name': 'GTBank',
    BVN: '',
    NIN: '12345678901',
    ...overrides,
  } as ParsedRow
}

describe('validateRow', () => {
  it('accepts a fully valid row', () => {
    const result = validateRow(row(), banks)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row.accountNumber).toBe('0033558463')
      expect(result.row.bankId).toBe('000013')
      expect(result.row.nin).toBe('12345678901')
      expect(result.row.bvn).toBeNull()
    }
  })

  it('rejects a missing full name', () => {
    const result = validateRow(row({ 'Full Name': '' }), banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rejections.some((r) => r.field === 'Full Name')).toBe(true)
    }
  })

  it('rejects a leading-zero-destroyed account number, naming the digit count', () => {
    const result = validateRow(row({ 'Account Number': '33558463' }), banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const reason = result.rejections.find((r) => r.field === 'Account Number')
      expect(reason?.reason).toContain('leading zeros')
    }
  })

  it('rejects an unresolved bank name', () => {
    const result = validateRow(row({ 'Bank Name': 'Not A Real Bank' }), banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rejections.some((r) => r.field === 'Bank Name')).toBe(true)
    }
  })

  it('rejects a row with neither BVN nor NIN', () => {
    const result = validateRow(row({ BVN: '', NIN: '' }), banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rejections.some((r) => r.field === 'BVN / NIN')).toBe(true)
    }
  })

  it('never includes the BVN/NIN value in a rejection', () => {
    const result = validateRow(row({ BVN: '123', NIN: '' }), banks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const bvnRejection = result.rejections.find((r) => r.field === 'BVN')
      expect(bvnRejection?.value).toBe('')
    }
  })

  it('accepts a row identified by BVN alone', () => {
    const result = validateRow(row({ BVN: '10987654321', NIN: '' }), banks)
    expect(result.ok).toBe(true)
  })

  it('collects multiple distinct rejections for one row', () => {
    const result = validateRow(
      row({ 'Full Name': '', 'Account Number': 'not-digits', BVN: '', NIN: '' }),
      banks
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rejections.length).toBeGreaterThanOrEqual(3)
    }
  })
})
