import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { applyPaymentResults, parseResultFile } from './payment-results'

describe('parseResultFile', () => {
  it('parses rows and coerces amount to a number', async () => {
    const csv = ['Reference,Account Number,Amount,Status', 'REF-0001,0011223344,75000.00,Paid'].join('\n')
    const result = await parseResultFile(Buffer.from(csv, 'utf-8'), 'results.csv')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toEqual([
        { rowNumber: 2, reference: 'REF-0001', accountNumber: '0011223344', amount: 75000, status: 'Paid', failureReason: null },
      ])
    }
  })

  it('rejects a file missing a required column', async () => {
    const csv = ['Reference,Amount,Status', 'REF-0001,75000,Paid'].join('\n')
    const result = await parseResultFile(Buffer.from(csv, 'utf-8'), 'results.csv')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missingColumns).toContain('Account Number')
  })
})

// Integration test: matching reads real payments rows, so this needs the
// database pg_trgm-style tests already use (dedupe.test.ts). Skips
// cleanly without DATABASE_URL.
const hasDbUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDbUrl)('applyPaymentResults (integration)', () => {
  const sql = postgres(process.env.DATABASE_URL as string)

  afterAll(async () => {
    await sql.end()
  })

  it(
    'reports one unmatched and one ambiguous row, and never touches either payment',
    { timeout: 20000 },
    async () => {
      const generatorId = randomUUID()
      let editionId: string | undefined
      let batchId: string | undefined

      try {
        const [edition] = await sql`
          insert into editions (name, year, status) values ('Payment Results Test Edition', 9303, 'draft') returning id
        `
        editionId = edition.id

        const [category] = await sql`
          insert into categories (name, group_key, is_state_scoped)
          values ('Payment Results Test Category', 'participants', false) returning id
        `
        const [personA] = await sql`
          insert into persons (full_name, normalised_name, nin_hash)
          values ('Payment Results Person A', 'a payment person results', 'pay-results-test-hash-a') returning id
        `
        const [personB] = await sql`
          insert into persons (full_name, normalised_name, nin_hash)
          values ('Payment Results Person B', 'b payment person results', 'pay-results-test-hash-b') returning id
        `
        const [bank] = await sql`select id from banks limit 1`

        const [partA] = await sql`
          insert into participations (edition_id, person_id, category_id, account_number, bank_id, entitlement_amount)
          values (${edition.id}, ${personA.id}, ${category.id}, '0011112222', ${bank.id}, 50000) returning id
        `
        const [partB] = await sql`
          insert into participations (edition_id, person_id, category_id, account_number, bank_id, entitlement_amount)
          values (${edition.id}, ${personB.id}, ${category.id}, '0011112222', ${bank.id}, 50000) returning id
        `

        await sql`
          insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
          values (${generatorId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                  'payment-results-test-generator@example.local', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}')
        `

        const [batch] = await sql`
          insert into payment_batches (edition_id, reference, filter_json, generated_by, total_amount, record_count)
          values (${edition.id}, 'PAY-RESULTS-TEST-BATCH', '{}'::jsonb, ${generatorId}, 100000, 2) returning id
        `
        batchId = batch.id

        // Same account_number + amount on both — a result row referencing
        // neither's partner_reference and matching on account+amount alone
        // is genuinely ambiguous between them.
        await sql`
          insert into payments (batch_id, participation_id, amount, account_number, bank_id, status, partner_reference)
          values (${batch.id}, ${partA.id}, 50000, '0011112222', ${bank.id}, 'pending', 'PAY-RESULTS-TEST-BATCH-0001')
        `
        await sql`
          insert into payments (batch_id, participation_id, amount, account_number, bank_id, status, partner_reference)
          values (${batch.id}, ${partB.id}, 50000, '0011112222', ${bank.id}, 'pending', 'PAY-RESULTS-TEST-BATCH-0002')
        `

        const csv = [
          'Reference,Account Number,Amount,Status',
          'THIS-REFERENCE-DOES-NOT-EXIST,9999999999,1.00,Paid', // unmatched
          ',0011112222,50000.00,Paid', // ambiguous: no reference, matches both by account+amount
        ].join('\n')

        const parsed = await parseResultFile(Buffer.from(csv, 'utf-8'), 'results.csv')
        expect(parsed.ok).toBe(true)
        if (!parsed.ok) throw new Error('expected parse to succeed')

        const summary = await applyPaymentResults(sql, batch.id, parsed.rows)

        expect(summary.unmatched).toBe(1)
        expect(summary.ambiguous).toBe(1)
        expect(summary.matched).toBe(0)
        expect(summary.exceptions).toHaveLength(2)
        expect(summary.exceptions.map((e) => e.kind).sort()).toEqual(['ambiguous', 'unmatched'])

        // Neither payment was touched — an ambiguous or unmatched row is
        // never auto-assigned.
        const rows = await sql`select status from payments where batch_id = ${batch.id} order by participation_id`
        expect(rows.every((r) => r.status === 'pending')).toBe(true)
      } finally {
        if (batchId) await sql`delete from payments where batch_id = ${batchId}`
        if (editionId) {
          await sql`delete from payment_batches where edition_id = ${editionId}`
          await sql`delete from participations where edition_id = ${editionId}`
          await sql`delete from persons where normalised_name in ('a payment person results', 'b payment person results')`
          await sql`delete from categories where name = 'Payment Results Test Category'`
          await sql`delete from editions where id = ${editionId}`
        }
        await sql`delete from auth.users where id = ${generatorId}`
      }
    }
  )
})
