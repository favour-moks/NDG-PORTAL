import type { ISql, Sql } from 'postgres'
import { runDedupeChecks } from './dedupe'
import { parseSpreadsheet } from './parse'
import { IdentifierConflictError, persistRow, type ImportTargetOptions } from './persist'
import type { RejectionReason, ValidatedRow } from './validate'
import { validateRow } from './validate'

export type ImportRequest = {
  buffer: Buffer
  originalName: string
  filePath: string
  uploadedBy: string
} & ImportTargetOptions

export type ImportRunResult =
  | {
      ok: true
      importRunId: string
      rowCount: number
      accepted: number
      rejected: number
      rejections: RejectionReason[]
      duplicatesFlagged: number
    }
  | { ok: false; reason: string; missingColumns?: string[] }

// The whole-file transaction. FR-005: a file with one bad row writes
// nothing. Rows are validated first (against the current bank list); if
// any fail, or if an identifier conflict only detectable against the
// database turns up mid-transaction, everything rolls back and only a
// failure-status import_runs row is written, outside the aborted
// transaction, so the attempt is still visible in history.
export async function runImport(sql: Sql, request: ImportRequest): Promise<ImportRunResult> {
  const parseResult = await parseSpreadsheet(request.buffer, request.originalName)
  if (!parseResult.ok) return parseResult

  const banks = await sql<{ id: string; name: string; aliases: string[] }[]>`
    select id, name, aliases from banks where active
  `

  const rejections: RejectionReason[] = []
  const validatedRows: ValidatedRow[] = []
  for (const row of parseResult.rows) {
    const result = validateRow(row, banks)
    if (result.ok) {
      validatedRows.push(result.row)
    } else {
      rejections.push(...result.rejections)
    }
  }

  if (rejections.length > 0) {
    const importRunId = await writeImportRunRecord(sql, request, {
      rowCount: parseResult.rows.length,
      acceptedCount: validatedRows.length,
      rejections,
      status: 'failed',
    })
    return {
      ok: true,
      importRunId,
      rowCount: parseResult.rows.length,
      accepted: validatedRows.length,
      rejected: rejections.length,
      rejections,
      duplicatesFlagged: 0,
    }
  }

  try {
    let duplicatesFlagged = 0
    const importRunId = await sql.begin(async (tx) => {
      const seenPersonIds = new Set<string>()

      for (const row of validatedRows) {
        const outcome = await persistRow(tx, row, request, seenPersonIds)
        if (outcome.kind === 'duplicate_within_file') {
          duplicatesFlagged++
          continue
        }
        await runDedupeChecks(tx, {
          editionId: request.editionId,
          participationId: outcome.participationId,
          personId: outcome.personId,
          accountNumber: outcome.accountNumber,
          normalisedName: outcome.normalisedName,
        })
      }

      return writeImportRunRecord(tx, request, {
        rowCount: parseResult.rows.length,
        acceptedCount: validatedRows.length,
        rejections: [],
        status: 'completed',
      })
    })

    return {
      ok: true,
      importRunId,
      rowCount: parseResult.rows.length,
      accepted: validatedRows.length,
      rejected: 0,
      rejections: [],
      duplicatesFlagged,
    }
  } catch (error) {
    if (error instanceof IdentifierConflictError) {
      const lateRejection: RejectionReason = {
        row: error.rowNumber,
        field: 'BVN / NIN',
        value: '',
        reason: error.message,
      }
      const allRejections = [...rejections, lateRejection]
      const importRunId = await writeImportRunRecord(sql, request, {
        rowCount: parseResult.rows.length,
        acceptedCount: validatedRows.length - 1,
        rejections: allRejections,
        status: 'failed',
      })
      return {
        ok: true,
        importRunId,
        rowCount: parseResult.rows.length,
        accepted: validatedRows.length - 1,
        rejected: allRejections.length,
        rejections: allRejections,
        duplicatesFlagged: 0,
      }
    }
    throw error
  }
}

async function writeImportRunRecord(
  sql: ISql,
  request: ImportRequest,
  data: {
    rowCount: number
    acceptedCount: number
    rejections: RejectionReason[]
    status: 'completed' | 'failed'
  }
): Promise<string> {
  const [importRun] = await sql<{ id: string }[]>`
    insert into import_runs (
      edition_id, kind, category_id, state_id, file_path, original_name,
      row_count, accepted_count, rejected_count, rejections, status, uploaded_by
    ) values (
      ${request.editionId}, 'beneficiaries', ${request.categoryId}, ${request.stateId},
      ${request.filePath}, ${request.originalName},
      ${data.rowCount}, ${data.acceptedCount}, ${data.rejections.length},
      ${JSON.stringify(data.rejections)}, ${data.status}, ${request.uploadedBy}
    )
    returning id
  `
  return importRun.id
}
