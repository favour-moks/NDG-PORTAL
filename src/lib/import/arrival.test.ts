import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { hashIdentifier } from '@/lib/domain/identifiers'
import { parseArrivalCsv, runArrivalImport } from './arrival'

describe('parseArrivalCsv', () => {
  it('parses rows using the default column mapping', () => {
    const csv = ['Identifier,Account Number', '12345678901,0011223344'].join('\n')
    const result = parseArrivalCsv(Buffer.from(csv, 'utf-8'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toEqual([{ rowNumber: 2, identifier: '12345678901', accountNumber: '0011223344' }])
    }
  })

  it('parses rows using a custom column mapping, since the real feed format is unknown', () => {
    const csv = ['BadgeID,BankAccount', '98765432109,0099988877'].join('\n')
    const result = parseArrivalCsv(Buffer.from(csv, 'utf-8'), {
      identifierColumn: 'BadgeID',
      accountNumberColumn: 'BankAccount',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toEqual([{ rowNumber: 2, identifier: '98765432109', accountNumber: '0099988877' }])
    }
  })

  it('rejects a file missing the configured identifier column', () => {
    const csv = ['SomeOtherColumn', 'x'].join('\n')
    const result = parseArrivalCsv(Buffer.from(csv, 'utf-8'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missingColumns).toContain('Identifier')
  })
})

// Integration test against the real database. runArrivalImport opens its
// own transaction (it's a top-level orchestrator, same as run.ts's
// runImport), so it can't be nested inside an outer sql.begin() the way
// dedupe.test.ts rolls back — a TransactionSql has no .begin() of its own.
// Fixtures are created directly and torn down manually instead.
const hasDbUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDbUrl)('runArrivalImport (integration)', () => {
  const sql = postgres(process.env.DATABASE_URL as string)

  afterAll(async () => {
    await sql.end()
  })

  it('marks the right people by identifier and by account number, and reports unmatched rows', async () => {
    const identifier = '12345678901'
    const uploaderId = randomUUID()
    let editionId: string | undefined

    try {
      // 'draft', not 'active' — this test doesn't need an active edition,
      // and 'active' is guarded by a global partial unique index that
      // would collide with any other test concurrently exercising one
      // (e.g. dedupe.test.ts), since Vitest runs test files in parallel.
      const [edition] = await sql`
        insert into editions (name, year, status) values ('Arrival Test Edition', 9301, 'draft') returning id
      `
      editionId = edition.id

      const [category] = await sql`
        insert into categories (name, group_key, is_state_scoped)
        values ('Arrival Test Athletes', 'participants', true) returning id
      `

      const [personByIdentifier] = await sql`
        insert into persons (full_name, normalised_name, nin_hash)
        values ('Arrival By Identifier', 'arrival by identifier', ${hashIdentifier(identifier)}) returning id
      `
      const [personByAccount] = await sql`
        insert into persons (full_name, normalised_name, nin_hash)
        values ('Arrival By Account', 'account arrival by', 'arrival-test-hash-account') returning id
      `

      const [partByIdentifier] = await sql`
        insert into participations (edition_id, person_id, category_id, account_number)
        values (${edition.id}, ${personByIdentifier.id}, ${category.id}, '0011112222') returning id
      `
      const [partByAccount] = await sql`
        insert into participations (edition_id, person_id, category_id, account_number)
        values (${edition.id}, ${personByAccount.id}, ${category.id}, '0033334444') returning id
      `

      await sql`
        insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        values (${uploaderId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'arrival-test-uploader@example.local', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}')
      `

      const csv = [
        'Identifier,Account Number',
        `${identifier},0000000000`, // matches by identifier
        ',0033334444', // matches by account number only
        '99999999999,9999999999', // matches nothing
      ].join('\n')

      const result = await runArrivalImport(sql, Buffer.from(csv, 'utf-8'), {
        editionId: edition.id,
        uploadedBy: uploaderId,
        originalName: 'arrival-test.csv',
        filePath: 'arrival/test/arrival-test.csv',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok result')
      expect(result.matched).toBe(2)
      expect(result.unmatched).toBe(1)
      expect(result.unmatchedRows[0].reason).toContain('No matching participation')
      // Never the raw identifier or account number in the unmatched report.
      expect(result.unmatchedRows[0].value).not.toBe('99999999999')

      const [updatedByIdentifier] = await sql`
        select arrival_accredited, arrival_source from participations where id = ${partByIdentifier.id}
      `
      expect(updatedByIdentifier.arrival_accredited).toBe(true)
      expect(updatedByIdentifier.arrival_source).toBe('biometric_feed')

      const [updatedByAccount] = await sql`
        select arrival_accredited from participations where id = ${partByAccount.id}
      `
      expect(updatedByAccount.arrival_accredited).toBe(true)
    } finally {
      if (editionId) {
        await sql`delete from import_runs where edition_id = ${editionId}`
        await sql`delete from participations where edition_id = ${editionId}`
        await sql`delete from categories where name = 'Arrival Test Athletes'`
        await sql`delete from persons where normalised_name in ('arrival by identifier', 'account arrival by')`
        await sql`delete from editions where id = ${editionId}`
      }
      await sql`delete from auth.users where id = ${uploaderId}`
    }
  }, 20000)
})
