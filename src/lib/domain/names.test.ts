import { describe, expect, it } from 'vitest'
import { normaliseName } from './names'

describe('normaliseName', () => {
  it('normalises ALL CAPS and title case to the same value', () => {
    expect(normaliseName('MADWEGWU JOSEPHINE NKECHI')).toBe(
      normaliseName('Josephine Nkechi Madwegwu')
    )
  })

  it('ignores word order', () => {
    expect(normaliseName('Chinedu Okafor')).toBe(normaliseName('Okafor Chinedu'))
  })

  it('strips accents', () => {
    expect(normaliseName('José García')).toBe(normaliseName('Jose Garcia'))
  })

  it('treats punctuation as a word separator, not as removed text', () => {
    expect(normaliseName("O'Brien-Smith")).toBe(normaliseName('O Brien Smith'))
  })

  it('collapses repeated whitespace', () => {
    expect(normaliseName('Ada   Obi')).toBe(normaliseName('Ada Obi'))
  })

  it('distinguishes genuinely different names', () => {
    expect(normaliseName('Ada Obi')).not.toBe(normaliseName('Ade Obi'))
  })
})
