export type AccountNumberResult =
  | { ok: true; value: string }
  | { ok: false; reason: string }

// Account numbers must always be parsed as text upstream (parse.ts reads
// every spreadsheet cell as text) — this function never receives a number
// and never infers digits. An inferred account number could pay the wrong
// person, so short values are rejected, never padded.
export function validateAccountNumber(raw: string): AccountNumberResult {
  const value = raw.trim()

  if (value.length === 0) {
    return { ok: false, reason: 'Account number is missing.' }
  }

  if (!/^\d+$/.test(value)) {
    return {
      ok: false,
      reason: `Account number must contain only digits. Found "${value}".`,
    }
  }

  if (value.length < 10) {
    return {
      ok: false,
      reason: `Account number must be 10 digits. This value has ${value.length} — leading zeros are lost when Excel stores it as a number. Re-save the column as text and re-enter the value.`,
    }
  }

  if (value.length > 10) {
    return {
      ok: false,
      reason: `Account number must be 10 digits. This value has ${value.length}.`,
    }
  }

  return { ok: true, value }
}
