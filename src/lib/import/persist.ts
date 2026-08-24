import type { ISql } from 'postgres'
import { hashIdentifier, normaliseIdentifier } from '@/lib/domain/identifiers'
import { normaliseName } from '@/lib/domain/names'
import type { ValidatedRow } from './validate'

export type ImportTargetOptions = {
  editionId: string
  categoryId: string
  stateId: string | null
  sportId: string | null
  committeeId: string | null
  piiEncryptionKey: string
}

export type PersistRowOutcome =
  | {
      kind: 'created'
      participationId: string
      personId: string
      normalisedName: string
      accountNumber: string
    }
  | { kind: 'duplicate_within_file'; personId: string }

// Thrown when a row's BVN and NIN resolve to two different existing people.
// duplicate_reviews.participation_id is NOT NULL — a review row can only
// attach to a participation that was actually created, and this row isn't
// being created at all, so there's no review row to raise. Throwing aborts
// the whole import transaction instead (run.ts catches this and reports it
// as a rejection with the rest), which is consistent with the "if any row
// fails validation, nothing is written" rule (FR-005) — this is exactly
// that failure, just one only detectable against the database.
export class IdentifierConflictError extends Error {
  rowNumber: number
  constructor(rowNumber: number) {
    super(
      `Row ${rowNumber}: BVN and NIN match two different existing people. This needs manual review before the file can be re-uploaded.`
    )
    this.rowNumber = rowNumber
  }
}

// Matches an existing person by bvn_hash then nin_hash, or creates a new
// one. If both identifiers are present and point at two DIFFERENT existing
// people, the row is not imported — that ambiguity is for a human to
// resolve, never a guess (TASK-026).
export async function persistRow(
  sql: ISql,
  row: ValidatedRow,
  options: ImportTargetOptions,
  seenPersonIds: Set<string>
): Promise<PersistRowOutcome> {
  const bvnHash = row.bvn ? hashIdentifier(row.bvn) : null
  const ninHash = row.nin ? hashIdentifier(row.nin) : null

  const matches = await sql<{ id: string }[]>`
    select distinct id from persons
    where (${bvnHash}::text is not null and bvn_hash = ${bvnHash})
       or (${ninHash}::text is not null and nin_hash = ${ninHash})
  `

  if (matches.length > 1) {
    throw new IdentifierConflictError(row.rowNumber)
  }

  const normalised = normaliseName(row.fullName)
  let personId: string

  if (matches.length === 1) {
    personId = matches[0].id
  } else {
    const key = options.piiEncryptionKey
    const [created] = await sql<{ id: string }[]>`
      insert into persons (
        full_name, normalised_name,
        bvn_encrypted, bvn_hash,
        nin_encrypted, nin_hash
      ) values (
        ${row.fullName}, ${normalised},
        ${row.bvn ? sql`encrypt_identifier(${normaliseIdentifier(row.bvn)}, ${key})` : null}, ${bvnHash},
        ${row.nin ? sql`encrypt_identifier(${normaliseIdentifier(row.nin)}, ${key})` : null}, ${ninHash}
      )
      returning id
    `
    personId = created.id
  }

  if (seenPersonIds.has(personId)) {
    // Same person appears twice in this file — import once, flag once
    // (PRD § 11 Edge Cases > Import). No second participation is created.
    return { kind: 'duplicate_within_file', personId }
  }
  seenPersonIds.add(personId)

  const entitlement = await sql<{ amount: string }[]>`
    select amount from rates
    where edition_id = ${options.editionId}
      and category_id = ${options.categoryId}
      and (sport_id = ${options.sportId} or sport_id is null)
    order by sport_id nulls last
    limit 1
  `

  const [participation] = await sql<{ id: string }[]>`
    insert into participations (
      edition_id, person_id, category_id, state_id, sport_id, committee_id,
      account_name, account_number, bank_id, entitlement_amount
    ) values (
      ${options.editionId}, ${personId}, ${options.categoryId}, ${options.stateId},
      ${options.sportId}, ${options.committeeId},
      ${row.accountName}, ${row.accountNumber}, ${row.bankId},
      ${entitlement[0]?.amount ?? null}
    )
    returning id
  `

  return {
    kind: 'created',
    participationId: participation.id,
    personId,
    normalisedName: normalised,
    accountNumber: row.accountNumber,
  }
}
