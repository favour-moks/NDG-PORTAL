// unaccent + lowercase + strip punctuation, split into tokens, sort
// alphabetically, rejoin — so "MADWEGWU JOSEPHINE NKECHI" and
// "Josephine Nkechi Madwegwu" normalise identically. Mirrored in SQL in
// 010_domain_functions.sql (normalise_name()) so the database and the
// application always agree; if you change the logic here, change it there.
const DIACRITIC_MARK = /\p{Diacritic}/gu

export function normaliseName(fullName: string): string {
  const unaccented = fullName.normalize('NFD').replace(DIACRITIC_MARK, '')

  const tokens = unaccented
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)

  tokens.sort()

  return tokens.join(' ')
}
