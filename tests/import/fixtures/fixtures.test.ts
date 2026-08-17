import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BankRecord } from '@/lib/domain/banks'
import { parseSpreadsheet } from '@/lib/import/parse'
import { validateRow } from '@/lib/import/validate'

// The 11 banks seeded in supabase/seed.sql, trimmed to what the fixtures use.
const banks: BankRecord[] = [
  { id: '000013', name: 'Guaranty Trust Bank', aliases: ['GTBANK', 'GTB'] },
  { id: '000012', name: 'Stanbic IBTC Bank', aliases: ['STANBIC IBTC BANK', 'STANBIC IBTC'] },
  { id: '000004', name: 'United Bank for Africa', aliases: ['UNITED BANK FOR AFRICA', 'UBA'] },
  { id: '000016', name: 'First Bank of Nigeria', aliases: ['FIRST BANK', 'FIRSTBANK'] },
  { id: '000003', name: 'First City Monument Bank', aliases: ['FCMB'] },
  { id: '000008', name: 'Polaris Bank', aliases: ['POLARIS BANK', 'POLARIS'] },
  { id: '000015', name: 'Zenith Bank', aliases: ['ZENITH BANK', 'ZENITH'] },
  { id: '000001', name: 'Sterling Bank', aliases: ['STERLING BANK', 'STERLING'] },
  { id: '000017', name: 'Wema Bank', aliases: ['WEMA BANK', 'WEMA'] },
  { id: '000007', name: 'Fidelity Bank', aliases: ['FIDELITY BANK', 'FIDELITY'] },
  { id: '000010', name: 'Ecobank Nigeria', aliases: ['ECOBANK', 'ECOBANK NIGERIA'] },
]

async function loadAndValidate(filename: string) {
  const buffer = readFileSync(new URL(`./${filename}`, import.meta.url))
  const parsed = await parseSpreadsheet(buffer, filename)
  if (!parsed.ok) return { parsed, accepted: 0, rejections: [] }

  const rejections = []
  let accepted = 0
  for (const row of parsed.rows) {
    const result = validateRow(row, banks)
    if (result.ok) accepted++
    else rejections.push(...result.rejections)
  }
  return { parsed, accepted, rejections }
}

describe('edo-coaches-real.xlsx (synthetic fixture)', () => {
  it('is the fixture of record: 45 rows, all accepted', async () => {
    const { parsed, accepted, rejections } = await loadAndValidate('edo-coaches-real.xlsx')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.rows).toHaveLength(45)
    expect(rejections).toEqual([])
    expect(accepted).toBe(45)
  })

  it('preserves at least 16 leading-zero account numbers', async () => {
    const { parsed } = await loadAndValidate('edo-coaches-real.xlsx')
    if (!parsed.ok) throw new Error('expected parse to succeed')
    const leadingZero = parsed.rows.filter((row) => row['Account Number'].startsWith('0'))
    expect(leadingZero.length).toBeGreaterThanOrEqual(16)
  })

  it('covers all 11 seeded bank spellings', async () => {
    const { parsed } = await loadAndValidate('edo-coaches-real.xlsx')
    if (!parsed.ok) throw new Error('expected parse to succeed')
    const distinctBankValues = new Set(parsed.rows.map((row) => row['Bank Name']))
    expect(distinctBankValues.size).toBe(11)
  })

  it('includes the Fidelity account trap: four accounts sharing a prefix that must not fuzzy-match', async () => {
    const { parsed } = await loadAndValidate('edo-coaches-real.xlsx')
    if (!parsed.ok) throw new Error('expected parse to succeed')
    const fidelityAccounts = parsed.rows
      .filter((row) => row['Bank Name'] === 'FIDELITY BANK')
      .map((row) => row['Account Number'])
    expect(fidelityAccounts).toHaveLength(4)
    expect(new Set(fidelityAccounts).size).toBe(4) // all genuinely distinct people
    for (const account of fidelityAccounts) {
      expect(account.slice(0, 5)).toBe(fidelityAccounts[0].slice(0, 5))
    }
  })
})

describe('edo-coaches-zeros-destroyed.xlsx (synthetic fixture)', () => {
  it('rejects every row that lost a leading zero, naming the digit count', async () => {
    const { rejections } = await loadAndValidate('edo-coaches-zeros-destroyed.xlsx')
    const accountRejections = rejections.filter((r) => r.field === 'Account Number')
    expect(accountRejections.length).toBeGreaterThanOrEqual(16)
    for (const rejection of accountRejections) {
      expect(rejection.reason).toContain('leading zeros')
    }
  })
})

describe('wrong-template.xlsx (synthetic fixture)', () => {
  it('is rejected before parsing, naming the missing columns', async () => {
    const { parsed } = await loadAndValidate('wrong-template.xlsx')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.missingColumns).toContain('Account Number')
      expect(parsed.missingColumns).toContain('Bank Name')
    }
  })
})
