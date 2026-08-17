import { describe, expect, it } from 'vitest'
import { validateAccountNumber } from './nuban'

describe('validateAccountNumber', () => {
  it('accepts a 10-digit account number with leading zeros', () => {
    const result = validateAccountNumber('0033558463')
    expect(result).toEqual({ ok: true, value: '0033558463' })
  })

  it('rejects a short number and explains the leading-zero cause, never padding it', () => {
    const result = validateAccountNumber('33558463')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('8')
      expect(result.reason).toContain('leading zeros')
    }
  })

  it('rejects a number with more than 10 digits', () => {
    const result = validateAccountNumber('123456789012')
    expect(result.ok).toBe(false)
  })

  it('rejects non-digit characters', () => {
    const result = validateAccountNumber('003355846A')
    expect(result.ok).toBe(false)
  })

  it('rejects an empty value', () => {
    const result = validateAccountNumber('   ')
    expect(result.ok).toBe(false)
  })

  it('trims surrounding whitespace before validating', () => {
    const result = validateAccountNumber('  0033558463  ')
    expect(result).toEqual({ ok: true, value: '0033558463' })
  })
})
