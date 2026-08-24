import type { BatchRow, DisbursementContext, DisbursementFormat } from './types'

function escapeField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// CRLF line endings — the common expectation for a file a bank or payment
// processor ingests. Every field is escaped defensively (delimiter, quote,
// newline) even though most won't need it; a beneficiary name with a comma
// shouldn't be able to shift every column after it.
export function renderDisbursementFile(
  format: DisbursementFormat,
  rows: BatchRow[],
  ctx: DisbursementContext
): string {
  const lines = [format.columns.map((c) => escapeField(c, format.delimiter)).join(format.delimiter)]

  rows.forEach((row, index) => {
    const values = format.mapRow(row, index, ctx)
    lines.push(values.map((v) => escapeField(v, format.delimiter)).join(format.delimiter))
  })

  return lines.join('\r\n') + '\r\n'
}
