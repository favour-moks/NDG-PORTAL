import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { runDedupeChecks } from './dedupe'

// Runs against the real database — pg_trgm's similarity() is exactly the
// thing under test, and mocking it would just re-encode the assumption
// being tested. Skips cleanly if DATABASE_URL isn't available (e.g. a CI
// job that hasn't been given it).
const hasDbUrl = Boolean(process.env.DATABASE_URL)

class RollbackForTest extends Error {}

describe.skipIf(!hasDbUrl)('runDedupeChecks (integration)', () => {
  const sql = postgres(process.env.DATABASE_URL as string)

  afterAll(async () => {
    await sql.end()
  })

  it('flags an exact account match as blocking (same edition) and a name match against a reference edition as non-blocking', async () => {
    // Remote pooled connection (Frankfurt) — a dozen round trips easily
    // exceeds vitest's 5s default.
    await sql
      .begin(async (tx) => {
        const [activeEdition] = await tx`
          insert into editions (name, year, status) values ('Dedupe Test Active', 9101, 'active') returning id
        `
        const [referenceEdition] = await tx`
          insert into editions (name, year, status, is_reference)
          values ('Dedupe Test Reference', 9100, 'closed', true) returning id
        `
        const [state] = await tx`
          insert into states (name, code) values ('Dedupe Test State', 'DTS') returning id
        `
        const [category] = await tx`
          insert into categories (name, group_key, is_state_scoped)
          values ('Dedupe Test Athletes', 'participants', true) returning id
        `

        const [personNew] = await tx`
          insert into persons (full_name, normalised_name, nin_hash)
          values ('Ada Obi', 'ada obi', 'dedupe-test-hash-new') returning id
        `
        const [personSameAccount] = await tx`
          insert into persons (full_name, normalised_name, nin_hash)
          values ('Chinedu Okoro', 'chinedu okoro', 'dedupe-test-hash-account') returning id
        `
        const [personSameNameRef] = await tx`
          insert into persons (full_name, normalised_name, nin_hash)
          values ('Ada Obi', 'ada obi', 'dedupe-test-hash-nameref') returning id
        `

        await tx`
          insert into participations (edition_id, person_id, category_id, state_id, account_number)
          values (${activeEdition.id}, ${personSameAccount.id}, ${category.id}, ${state.id}, '0011122233')
        `
        await tx`
          insert into participations (edition_id, person_id, category_id, state_id, account_number)
          values (${referenceEdition.id}, ${personSameNameRef.id}, ${category.id}, ${state.id}, '0099988877')
        `

        const [newParticipation] = await tx`
          insert into participations (edition_id, person_id, category_id, state_id, account_number)
          values (${activeEdition.id}, ${personNew.id}, ${category.id}, ${state.id}, '0011122233')
          returning id
        `

        const result = await runDedupeChecks(tx, {
          editionId: activeEdition.id,
          participationId: newParticipation.id,
          personId: personNew.id,
          accountNumber: '0011122233',
          normalisedName: 'ada obi',
        })

        expect(result.reviewsCreated).toBe(2)

        const reviews = await tx`
          select match_type, is_blocking from duplicate_reviews
          where participation_id = ${newParticipation.id}
        `

        const accountReview = reviews.find((r) => r.match_type === 'account_exact')
        expect(accountReview?.is_blocking).toBe(true)

        const nameReview = reviews.find((r) => r.match_type === 'name_similar')
        expect(nameReview?.is_blocking).toBe(false)

        throw new RollbackForTest('test complete, discard fixtures')
      })
      .catch((error: unknown) => {
        if (!(error instanceof RollbackForTest)) throw error
      })
  }, 20000)
})
