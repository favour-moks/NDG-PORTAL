import { createHash } from 'node:crypto'

// BVN and NIN must never appear in logs, error messages, or client
// payloads (PRD § 2 Security Considerations). Callers of these functions
// must not console.log or throw errors containing the raw value.

// Digits only, no whitespace — the canonical form both the hash and the
// encrypted value are derived from.
export function normaliseIdentifier(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

// SHA-256 of the normalised identifier, for exact-match dedup without ever
// decrypting. Encryption happens separately, in SQL — see
// supabase/migrations/010_domain_functions.sql (encrypt_identifier).
export function hashIdentifier(raw: string): string {
  return createHash('sha256').update(normaliseIdentifier(raw)).digest('hex')
}

// "•••••••1234" — last 4 digits visible, everything before it masked.
// This is the only form of a BVN/NIN that may appear in a list or export;
// the full value is only ever returned by the logged reveal action.
export function maskIdentifier(raw: string): string {
  const digits = normaliseIdentifier(raw)
  const visible = digits.slice(-4)
  const hiddenCount = Math.max(digits.length - visible.length, 0)
  return '•'.repeat(hiddenCount) + visible
}
