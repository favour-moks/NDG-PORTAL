import { describe, expect, it } from 'vitest'
import { hashIdentifier, maskIdentifier, normaliseIdentifier } from './identifiers'

describe('normaliseIdentifier', () => {
  it('strips whitespace', () => {
    expect(normaliseIdentifier(' 1234 5678 901 ')).toBe('12345678901')
  })
})

describe('hashIdentifier', () => {
  it('is stable for the same identifier', () => {
    expect(hashIdentifier('12345678901')).toBe(hashIdentifier('12345678901'))
  })

  it('is stable regardless of surrounding whitespace', () => {
    expect(hashIdentifier('12345678901')).toBe(hashIdentifier(' 1234 5678 901 '))
  })

  it('differs for different identifiers', () => {
    expect(hashIdentifier('12345678901')).not.toBe(hashIdentifier('10987654321'))
  })

  it('produces a 64-character hex digest (SHA-256)', () => {
    expect(hashIdentifier('12345678901')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('maskIdentifier', () => {
  it('shows only the last 4 digits', () => {
    expect(maskIdentifier('12345678901')).toBe('•••••••8901')
  })

  it('never includes the plaintext value beyond the last 4 digits', () => {
    const masked = maskIdentifier('12345678901')
    expect(masked).not.toContain('1234567')
  })
})
