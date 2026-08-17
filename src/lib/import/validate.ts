import { z } from 'zod'
import { resolveBank, type BankRecord } from '@/lib/domain/banks'
import { validateAccountNumber } from '@/lib/domain/nuban'
import type { ParsedRow } from './parse'

export type RejectionReason = {
  row: number
  field: string
  value: string
  reason: string
}

export type ValidatedRow = {
  rowNumber: number
  fullName: string
  accountName: string
  accountNumber: string
  bankId: string
  bvn: string | null
  nin: string | null
}

export type RowValidationResult =
  | { ok: true; row: ValidatedRow }
  | { ok: false; rejections: RejectionReason[] }

const RequiredFieldsSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  accountName: z.string().trim().min(1, 'Account name is required.'),
})

const IDENTIFIER_PATTERN = /^\d{11}$/

// BVN/NIN are validated here but their raw value is never placed in a
// RejectionReason — identifiers must never appear in error messages, per
// PRD § 2 Security Considerations.
export function validateRow(row: ParsedRow, banks: BankRecord[]): RowValidationResult {
  const rejections: RejectionReason[] = []

  const requiredFields = RequiredFieldsSchema.safeParse({
    fullName: row['Full Name'],
    accountName: row['Account Name'],
  })
  if (!requiredFields.success) {
    for (const issue of requiredFields.error.issues) {
      const field = issue.path[0] === 'fullName' ? 'Full Name' : 'Account Name'
      rejections.push({ row: row.rowNumber, field, value: row[field], reason: issue.message })
    }
  }

  const accountNumberResult = validateAccountNumber(row['Account Number'])
  if (!accountNumberResult.ok) {
    rejections.push({
      row: row.rowNumber,
      field: 'Account Number',
      value: row['Account Number'],
      reason: accountNumberResult.reason,
    })
  }

  const bankResult = resolveBank(row['Bank Name'], banks)
  if (!bankResult.ok) {
    rejections.push({
      row: row.rowNumber,
      field: 'Bank Name',
      value: row['Bank Name'],
      reason: bankResult.reason,
    })
  }

  const bvn = row['BVN']?.trim() ?? ''
  const nin = row['NIN']?.trim() ?? ''

  if (!bvn && !nin) {
    rejections.push({
      row: row.rowNumber,
      field: 'BVN / NIN',
      value: '',
      reason: 'At least one of BVN or NIN is required.',
    })
  }
  if (bvn && !IDENTIFIER_PATTERN.test(bvn)) {
    rejections.push({ row: row.rowNumber, field: 'BVN', value: '', reason: 'BVN must be 11 digits.' })
  }
  if (nin && !IDENTIFIER_PATTERN.test(nin)) {
    rejections.push({ row: row.rowNumber, field: 'NIN', value: '', reason: 'NIN must be 11 digits.' })
  }

  if (!requiredFields.success || !accountNumberResult.ok || !bankResult.ok || rejections.length > 0) {
    return { ok: false, rejections }
  }

  return {
    ok: true,
    row: {
      rowNumber: row.rowNumber,
      fullName: requiredFields.data.fullName,
      accountName: requiredFields.data.accountName,
      accountNumber: accountNumberResult.value,
      bankId: bankResult.bankId,
      bvn: bvn || null,
      nin: nin || null,
    },
  }
}
