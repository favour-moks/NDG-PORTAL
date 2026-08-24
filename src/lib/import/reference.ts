import type { ISql } from 'postgres'

export type CreateReferenceEditionOptions = {
  name: string
  year: number
}

// Reference editions are historical data, imported for warning purposes
// only — they raise non-blocking review items and never gate eligibility
// (enforced by the trigger in 005_import_review.sql and dedupe.ts's
// blocking logic, not by anything here). They're created already closed:
// historical data doesn't move through draft/active like a live edition.
//
// There is deliberately no separate import pipeline for reference data —
// runImport() (src/lib/import/run.ts) works unchanged once the target
// edition has is_reference = true. Schema constraints (valid account
// format, an identifier required) apply regardless of is_reference;
// relaxing them for "historical data is scattered and unreliable" would
// need a real schema change, not a code path here.
export async function createReferenceEdition(
  sql: ISql,
  options: CreateReferenceEditionOptions
): Promise<string> {
  const [edition] = await sql<{ id: string }[]>`
    insert into editions (name, year, status, is_reference, closed_at)
    values (${options.name}, ${options.year}, 'closed', true, now())
    returning id
  `
  return edition.id
}
