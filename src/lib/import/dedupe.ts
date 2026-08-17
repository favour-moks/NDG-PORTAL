import type { ISql } from 'postgres'

export const DEFAULT_NAME_SIMILARITY_THRESHOLD = 0.45

export type DedupeInput = {
  editionId: string
  participationId: string
  personId: string
  accountNumber: string
  normalisedName: string
}

type MatchRow = { participation_id: string; person_id: string; edition_id: string }

// Three passes: exact identifier hash (handled separately in persist.ts,
// since it changes whether a row is imported at all, not just flagged),
// exact account match, and trigram name similarity. Account numbers are
// NEVER fuzzy-matched — the trap in the fixture data is that several
// accounts share their first five digits and differ only in the last
// three; those are different people, and similarity() is only ever run
// against normalised_name.
export async function runDedupeChecks(
  sql: ISql,
  input: DedupeInput,
  threshold = DEFAULT_NAME_SIMILARITY_THRESHOLD
): Promise<{ reviewsCreated: number }> {
  let reviewsCreated = 0

  const accountMatches = await sql<MatchRow[]>`
    select p.id as participation_id, p.person_id, p.edition_id
    from participations p
    where p.account_number = ${input.accountNumber}
      and p.id != ${input.participationId}
  `
  for (const match of accountMatches) {
    await insertReview(sql, input, match, 'account_exact')
    reviewsCreated++
  }

  const nameMatches = await sql<(MatchRow & { score: number })[]>`
    select p.id as participation_id, p.person_id, p.edition_id,
           similarity(pe.normalised_name, ${input.normalisedName}) as score
    from participations p
    join persons pe on pe.id = p.person_id
    where p.person_id != ${input.personId}
      and similarity(pe.normalised_name, ${input.normalisedName}) >= ${threshold}
    order by score desc
  `
  for (const match of nameMatches) {
    await insertReview(sql, input, match, 'name_similar', match.score)
    reviewsCreated++
  }

  return { reviewsCreated }
}

async function insertReview(
  sql: ISql,
  input: DedupeInput,
  match: MatchRow,
  matchType: 'account_exact' | 'name_similar',
  score?: number
) {
  // A starting value only — the trigger in 005_import_review.sql forces
  // this false whenever matched_edition_id.is_reference is true, regardless
  // of what's supplied here. Same-edition matches are the ones that should
  // block; matches against a different, non-reference edition are the
  // ordinary case of a returning person and are left non-blocking too.
  const isBlocking = match.edition_id === input.editionId

  await sql`
    insert into duplicate_reviews (
      edition_id, participation_id, matched_person_id, matched_edition_id,
      match_type, similarity_score, is_blocking
    ) values (
      ${input.editionId}, ${input.participationId}, ${match.person_id}, ${match.edition_id},
      ${matchType}, ${score ?? null}, ${isBlocking}
    )
  `
}
