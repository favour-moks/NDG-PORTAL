import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { createReferenceEdition } from './reference'

const hasDbUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDbUrl)('createReferenceEdition (integration)', () => {
  const sql = postgres(process.env.DATABASE_URL as string)

  afterAll(async () => {
    await sql.end()
  })

  it('creates an edition that is already closed and marked as reference', async () => {
    const editionId = await createReferenceEdition(sql, { name: 'Reference Test Edition', year: 9401 })

    try {
      const [edition] = await sql`
        select status, is_reference, closed_at from editions where id = ${editionId}
      `
      expect(edition.status).toBe('closed')
      expect(edition.is_reference).toBe(true)
      expect(edition.closed_at).not.toBeNull()
    } finally {
      await sql`delete from editions where id = ${editionId}`
    }
  })

  it('a match against a reference edition is never blocking, even within the same "active-like" scenario', async () => {
    // This is really exercising the trigger from 005_import_review.sql and
    // dedupe.ts together, using a reference edition created through this
    // module rather than by hand — a light end-to-end check that the two
    // pieces agree once wired together via createReferenceEdition.
    const referenceEditionId = await createReferenceEdition(sql, {
      name: 'Reference Test Historical',
      year: 9400,
    })

    try {
      const [category] = await sql`
        insert into categories (name, group_key, is_state_scoped)
        values ('Reference Test Category', 'participants', true) returning id
      `
      const [person] = await sql`
        insert into persons (full_name, normalised_name, nin_hash)
        values ('Reference Test Person', 'reference test person', 'reference-test-hash') returning id
      `
      const [participation] = await sql`
        insert into participations (edition_id, person_id, category_id)
        values (${referenceEditionId}, ${person.id}, ${category.id}) returning id
      `

      const [currentEdition] = await sql`
        insert into editions (name, year, status) values ('Reference Test Current', 9402, 'draft') returning id
      `
      const [review] = await sql`
        insert into duplicate_reviews (edition_id, participation_id, matched_person_id, matched_edition_id, match_type, is_blocking)
        values (${currentEdition.id}, ${participation.id}, ${person.id}, ${referenceEditionId}, 'identifier_exact', true)
        returning is_blocking
      `

      expect(review.is_blocking).toBe(false)
    } finally {
      await sql`delete from duplicate_reviews where matched_edition_id = ${referenceEditionId}`
      await sql`delete from participations where edition_id = ${referenceEditionId}`
      await sql`delete from persons where normalised_name = 'reference test person'`
      await sql`delete from categories where name = 'Reference Test Category'`
      await sql`delete from editions where id = ${referenceEditionId}`
      await sql`delete from editions where name = 'Reference Test Current'`
    }
  })
})
