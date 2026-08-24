export type BankRecord = {
  id: string
  name: string
  aliases: string[]
}

export type BankResolution = { ok: true; bankId: string } | { ok: false; reason: string }

// Case-insensitive match against the canonical name or any alias. An
// unresolved name is rejected showing the value that didn't match — never
// guessed, because a wrong institution code sends money to the wrong bank.
export function resolveBank(rawName: string, banks: BankRecord[]): BankResolution {
  const value = rawName.trim()

  if (value.length === 0) {
    return { ok: false, reason: 'Bank name is missing.' }
  }

  const normalised = value.toUpperCase()
  const match = banks.find(
    (bank) =>
      bank.name.toUpperCase() === normalised ||
      bank.aliases.some((alias) => alias.toUpperCase() === normalised)
  )

  if (!match) {
    return {
      ok: false,
      reason: `Bank name "${value}" is not recognised. Check the spelling, or add it as an alias in reference data.`,
    }
  }

  return { ok: true, bankId: match.id }
}
