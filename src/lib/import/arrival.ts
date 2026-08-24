import Papa from 'papaparse'
import type { Sql } from 'postgres'
import { hashIdentifier, maskIdentifier } from '@/lib/domain/identifiers'
import type { RejectionReason } from './validate'

// The real biometric feed format is unknown (PRD § 14 question 2), so the
// column names are configurable rather than fixed. identifierColumn holds
// either a BVN or a NIN — hashIdentifier() matching against both
// persons.bvn_hash and persons.nin_hash means the mapping doesn't need to
// say which.
export type ArrivalColumnMapping = {
  identifierColumn: string
  accountNumberColumn?: string
}

export const DEFAULT_ARRIVAL_MAPPING: ArrivalColumnMapping = {
  identifierColumn: 'Identifier',
  accountNumberColumn: 'Account Number',
}

export type ArrivalRow = { rowNumber: number; identifier: string; accountNumber: string }

export type ArrivalParseResult =
  | { ok: true; rows: ArrivalRow[] }
  | { ok: false; reason: string; missingColumns?: string[] }

export function parseArrivalCsv(
  buffer: Buffer,
  mapping: ArrivalColumnMapping = DEFAULT_ARRIVAL_MAPPING
): ArrivalParseResult {
  const text = buffer.toString('utf-8')
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })

  const headers = parsed.meta.fields ?? []
  const missingColumns: string[] = []
  if (!headers.includes(mapping.identifierColumn)) missingColumns.push(mapping.identifierColumn)
  if (mapping.accountNumberColumn && !headers.includes(mapping.accountNumberColumn)) {
    missingColumns.push(mapping.accountNumberColumn)
  }
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This file does not match the expected format. Missing columns: ${missingColumns.join(', ')}.`,
      missingColumns,
    }
  }

  const rows: ArrivalRow[] = parsed.data
    .map((raw, index) => ({
      rowNumber: index + 2,
      identifier: String(raw[mapping.identifierColumn] ?? '').trim(),
      accountNumber: mapping.accountNumberColumn
        ? String(raw[mapping.accountNumberColumn] ?? '').trim()
        : '',
    }))
    .filter((row) => row.identifier.length > 0 || row.accountNumber.length > 0)

  return { ok: true, rows }
}

export type ArrivalImportOptions = {
  editionId: string
  uploadedBy: string
  originalName: string
  filePath: string
  mapping?: ArrivalColumnMapping
}

export type ArrivalImportResult =
  | {
      ok: true
      importRunId: string
      rowCount: number
      matched: number
      unmatched: number
      unmatchedRows: RejectionReason[]
    }
  | { ok: false; reason: string; missingColumns?: string[] }

// Matches on identifier hash first, then account number — both scoped to
// the target edition. Unmatched rows are reported, never guessed: this is
// exactly where the current manual process loses records, and the point
// of this importer is to not repeat that. Partial success is expected and
// fine here (unlike the beneficiary import's FR-005 all-or-nothing rule):
// this only ever flips accreditation flags on participations that already
// exist, never creates a person or a payable record.
export async function runArrivalImport(
  sql: Sql,
  buffer: Buffer,
  options: ArrivalImportOptions
): Promise<ArrivalImportResult> {
  const parseResult = parseArrivalCsv(buffer, options.mapping ?? DEFAULT_ARRIVAL_MAPPING)
  if (!parseResult.ok) return parseResult

  const unmatchedRows: RejectionReason[] = []
  let matched = 0

  const importRunId = await sql.begin(async (tx) => {
    for (const row of parseResult.rows) {
      let participationId: string | null = null

      if (row.identifier) {
        const hash = hashIdentifier(row.identifier)
        const [match] = await tx<{ id: string }[]>`
          select p.id from participations p
          join persons pe on pe.id = p.person_id
          where p.edition_id = ${options.editionId}
            and (pe.bvn_hash = ${hash} or pe.nin_hash = ${hash})
          limit 1
        `
        if (match) participationId = match.id
      }

      if (!participationId && row.accountNumber) {
        const [match] = await tx<{ id: string }[]>`
          select id from participations
          where edition_id = ${options.editionId} and account_number = ${row.accountNumber}
          limit 1
        `
        if (match) participationId = match.id
      }

      if (participationId) {
        await tx`
          update participations
          set arrival_accredited = true, arrival_accredited_at = now(), arrival_source = 'biometric_feed'
          where id = ${participationId}
        `
        matched++
      } else {
        unmatchedRows.push({
          row: row.rowNumber,
          field: 'Identifier',
          // Never the raw identifier — masked, same as everywhere else it
          // might be displayed.
          value: row.identifier ? maskIdentifier(row.identifier) : row.accountNumber,
          reason: 'No matching participation found in this edition.',
        })
      }
    }

    const [importRun] = await tx<{ id: string }[]>`
      insert into import_runs (
        edition_id, kind, file_path, original_name,
        row_count, accepted_count, rejected_count, rejections, status, uploaded_by
      ) values (
        ${options.editionId}, 'arrival_accreditation', ${options.filePath}, ${options.originalName},
        ${parseResult.rows.length}, ${matched}, ${unmatchedRows.length},
        ${JSON.stringify(unmatchedRows)}, 'completed', ${options.uploadedBy}
      )
      returning id
    `
    return importRun.id
  })

  return {
    ok: true,
    importRunId,
    rowCount: parseResult.rows.length,
    matched,
    unmatched: unmatchedRows.length,
    unmatchedRows,
  }
}
