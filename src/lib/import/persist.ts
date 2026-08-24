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
  // Denormalised onto the participation at insert — is_payable is a
  // generated column and generated columns cannot join categories
  // (TASK-033, supabase/migrations/011_arrival_requirement.sql).
  requiresArrivalAccreditation: boolean
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
  | { kind: 'already_participating'; personId: string }

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
  options: ImportTargetOptions
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

  // Covers both cases uniformly: this person appearing twice in the same
  // file (participations.unique(edition_id, person_id) — a row inserted
  // earlier in this same transaction is visible to this SELECT, since a
  // transaction sees its own writes), and this person already having a
  // participation in this edition from an earlier import run entirely.
  // Both are "import once, flag once" (PRD § 11 Edge Cases > Import) — the
  // alternative is a raw unique-constraint violation surfacing as an
  // uncaught 500 instead of a clean outcome.
  const [existingParticipation] = await sql<{ id: string }[]>`
    select id from participations where edition_id = ${options.editionId} and person_id = ${personId}
  `
  if (existingParticipation) {
    return { kind: 'already_participating', personId }
  }

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
      account_name, account_number, bank_id, entitlement_amount,
      requires_arrival_accreditation
    ) values (
      ${options.editionId}, ${personId}, ${options.categoryId}, ${options.stateId},
      ${options.sportId}, ${options.committeeId},
      ${row.accountName}, ${row.accountNumber}, ${row.bankId},
      ${entitlement[0]?.amount ?? null},
      ${options.requiresArrivalAccreditation}
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
