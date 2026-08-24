// The payment partner's real file specification is an open question (PRD
// § 14 Q1) — this whole module exists so that landing the real spec is a
// config change, not a rewrite (roadmap Phase 4 blocker note). Every field
// here is deliberately generic: a format is "a header row and a row
// mapper," nothing vendor-specific leaks outside formats/*.

// One payable participation, resolved and ready to render — never a raw
// DB row, so formats can't accidentally reach past what was actually
// snapshotted into the batch.
//
// transactionId is generated once, by generateBatch() itself (not by a
// format's mapRow), and stored on the corresponding payments row as
// partner_reference at the same time — that's what makes "match on
// partner_reference first" (TASK-064) possible at all: it's the one
// identifier both sides of the round trip are guaranteed to have, since
// we mint it and the partner's result file is expected to echo it back.
export type BatchRow = {
  participationId: string
  transactionId: string
  fullName: string
  accountName: string | null
  accountNumber: string
  bankId: string
  bankName: string
  amount: number
}

export type DisbursementContext = {
  batchId: string
  batchReference: string
  generatedAt: Date
}

export type DisbursementFormat = {
  id: string
  version: string
  delimiter: string
  fileExtension: string
  contentType: string
  columns: string[]
  // Returns values in column order, as strings — account numbers and
  // institution codes must never be handed back as numbers, the same
  // leading-zero hazard that numFmt '@' guards against in the Excel
  // export (src/lib/export/xlsx.ts).
  mapRow: (row: BatchRow, index: number, ctx: DisbursementContext) => string[]
}
