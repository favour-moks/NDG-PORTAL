import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { runImport } from '@/lib/import/run'
import { generateBatch, type DisbursementFilters } from '@/lib/export/disbursement/generate'
import { getDisbursementFormat } from '@/lib/export/disbursement/formats'
import { renderDisbursementFile } from '@/lib/export/disbursement/render'
import { applyPaymentResults, parseResultFile } from '@/lib/import/payment-results'

// This is the MVP's definition of done (product-roadmap.md, TASK-068): a
// full round trip on real historical data, not mocks — import the real
// Edo fixture, accredit it, filter to it, generate a disbursement file,
// verify leading zeros and institution codes survive byte-level, then
// reconcile a synthetic result file back onto the batch. Skips cleanly
// without DATABASE_URL (dedupe.test.ts's established pattern); the CI job
// that actually runs it (disbursement-e2e) provisions a local Supabase
// instance specifically so this never just skips silently there.
const hasDbUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDbUrl)('disbursement round trip (e2e)', () => {
  const sql = postgres(process.env.DATABASE_URL as string)

  afterAll(async () => {
    await sql.end()
  })

  it('imports, accredits, generates a payable batch, and reconciles a result file', { timeout: 90000 }, async () => {
    const uploaderId = randomUUID()
    let editionId: string | undefined

    try {
      // 'draft', not 'active' — see arrival.test.ts for why: the active
      // partial unique index would collide with any other test file
      // exercising an active edition concurrently.
      const [edition] = await sql`
        insert into editions (name, year, status) values ('E2E Disbursement Test Edition', 9302, 'draft') returning id
      `
      editionId = edition.id

      const [category] = await sql`
        insert into categories (name, group_key, is_state_scoped, requires_sport, requires_arrival_accreditation)
        values ('E2E Disbursement Test Coaches', 'participants', true, true, true) returning id
      `
      const [state] = await sql`
        insert into states (name, code) values ('E2E Disbursement Test State', 'E2D') returning id
      `
      const [sport] = await sql`select id from sports where name = 'Football'`

      // Rates are resolved at import time (persist.ts) and snapshotted
      // onto entitlement_amount — without one, is_payable can still be
      // true (it doesn't check for a rate) but generateBatch() correctly
      // excludes the row anyway, since it can't insert a payment with a
      // null amount. Configuring it here is what a real editor would do
      // via /admin/reference/rates before importing.
      await sql`
        insert into rates (edition_id, category_id, sport_id, amount)
        values (${edition.id}, ${category.id}, ${sport.id}, 75000)
      `

      await sql`
        insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        values (${uploaderId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'e2e-disbursement-uploader@example.local', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}')
      `

      // Real fixture, not synthetic — 45 rows, 16 with leading-zero account
      // numbers (tests/import/fixtures/README.md).
      const buffer = readFileSync('tests/import/fixtures/edo-coaches-real.xlsx')
      const importResult = await runImport(sql, {
        buffer,
        originalName: 'edo-coaches-real.xlsx',
        filePath: 'e2e/edo-coaches-real.xlsx',
        uploadedBy: uploaderId,
        editionId: edition.id,
        categoryId: category.id,
        stateId: state.id,
        sportId: sport.id,
        committeeId: null,
        requiresArrivalAccreditation: true,
        piiEncryptionKey: process.env.PII_ENCRYPTION_KEY as string,
      })

      expect(importResult.ok).toBe(true)
      if (!importResult.ok) throw new Error('expected import to succeed')
      expect(importResult.accepted).toBe(45)
      expect(importResult.rejected).toBe(0)

      // Accredit everyone the import just created — is_payable also needs
      // bank details, already present from the fixture.
      await sql`
        update participations
        set pre_games_accredited = true, arrival_accredited = true
        where edition_id = ${edition.id}
      `

      const [{ leadingZeroCount }] = await sql<{ leadingZeroCount: string }[]>`
        select count(*) as "leadingZeroCount" from participations
        where edition_id = ${edition.id} and account_number like '0%'
      `
      expect(Number(leadingZeroCount)).toBeGreaterThanOrEqual(16)

      const [{ payableCount }] = await sql<{ payableCount: string }[]>`
        select count(*) as "payableCount" from participations where edition_id = ${edition.id} and is_payable = true
      `
      expect(Number(payableCount)).toBe(45)

      const filters: DisbursementFilters = { editionId: edition.id, categoryId: category.id, stateId: state.id }
      const batchResult = await generateBatch(sql, {
        filters,
        reference: 'E2E-DISBURSEMENT-TEST',
        generatedBy: uploaderId,
      })

      expect(batchResult.ok).toBe(true)
      if (!batchResult.ok) throw new Error('expected batch generation to succeed')
      expect(batchResult.recordCount).toBe(45)
      expect(batchResult.rows).toHaveLength(45)

      // Byte-level file verification (TASK-068): leading zeros and
      // institution codes must survive into the actual rendered text, not
      // just the in-memory rows.
      const format = getDisbursementFormat('default')
      const fileContent = renderDisbursementFile(format, batchResult.rows, {
        batchId: batchResult.batchId,
        batchReference: batchResult.reference,
        generatedAt: new Date(),
      })

      const lines = fileContent.trim().split('\r\n')
      expect(lines).toHaveLength(46) // header + 45 rows
      expect(lines[0]).toBe(format.columns.join(','))

      const leadingZeroRows = batchResult.rows.filter((row) => row.accountNumber.startsWith('0'))
      expect(leadingZeroRows.length).toBeGreaterThanOrEqual(16)
      for (const row of leadingZeroRows.slice(0, 3)) {
        expect(fileContent).toContain(`,${row.accountNumber},`)
      }

      const institutionCodes = new Set(batchResult.rows.map((row) => row.bankId))
      for (const code of institutionCodes) {
        expect(code).toMatch(/^\d{6}$/)
        expect(fileContent).toContain(`,${code},`)
      }

      // Reconcile a synthetic result file: one clean match (by the
      // transaction id we minted), one deliberately unmatched reference.
      const matchedRow = batchResult.rows[0]
      const resultCsv = [
        'Reference,Account Number,Amount,Status',
        `${matchedRow.transactionId},${matchedRow.accountNumber},${matchedRow.amount.toFixed(2)},Paid`,
        `NOT-A-REAL-REFERENCE,9999999999,1.00,Paid`,
      ].join('\r\n')

      const parsed = await parseResultFile(Buffer.from(resultCsv, 'utf-8'), 'results.csv')
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) throw new Error('expected result file to parse')

      const summary = await applyPaymentResults(sql, batchResult.batchId, parsed.rows)
      expect(summary.paid).toBe(1)
      expect(summary.unmatched).toBe(1)
      expect(summary.exceptions.some((e) => e.kind === 'unmatched')).toBe(true)

      const [updatedPayment] = await sql`
        select status, paid_at from payments
        where batch_id = ${batchResult.batchId} and participation_id = ${matchedRow.participationId}
      `
      expect(updatedPayment.status).toBe('paid')
      expect(updatedPayment.paid_at).not.toBeNull()

      // Every other payment in the batch is untouched — statuses update
      // only within the target batch, and only for rows that actually
      // matched.
      const [{ stillPending }] = await sql<{ stillPending: string }[]>`
        select count(*) as "stillPending" from payments
        where batch_id = ${batchResult.batchId} and status = 'pending'
      `
      expect(Number(stillPending)).toBe(44)
    } finally {
      if (editionId) {
        await sql`delete from payments where batch_id in (select id from payment_batches where edition_id = ${editionId})`
        await sql`delete from payment_batches where edition_id = ${editionId}`
        await sql`delete from import_runs where edition_id = ${editionId}`
        // rates.category_id has no ON DELETE CASCADE — must go before the
        // category delete below, or that delete fails on the FK.
        await sql`delete from rates where edition_id = ${editionId}`
        const personIds = await sql`select distinct person_id from participations where edition_id = ${editionId}`
        await sql`delete from participations where edition_id = ${editionId}`
        if (personIds.length > 0) {
          await sql`delete from persons where id in ${sql(personIds.map((p) => p.person_id))}`
        }
        await sql`delete from categories where name = 'E2E Disbursement Test Coaches'`
        await sql`delete from states where name = 'E2E Disbursement Test State'`
        await sql`delete from editions where id = ${editionId}`
      }
      await sql`delete from auth.users where id = ${uploaderId}`
    }
  })
})
