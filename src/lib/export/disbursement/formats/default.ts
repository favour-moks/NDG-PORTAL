import type { DisbursementFormat } from '../types'

// Based on the observed vendor export columns (roadmap Phase 4, TASK-058)
// — TransID, BatchID, Reference, VendorCode, VendorName, VendorAcctNumber,
// Amount, Remarks, VendorBankName. Replace this the moment the partner's
// real specification arrives; nothing outside this file should need to
// change (see formats/index.ts for how a format is selected).
export const defaultDisbursementFormat: DisbursementFormat = {
  id: 'default',
  version: '1.0.0',
  delimiter: ',',
  fileExtension: 'csv',
  contentType: 'text/csv',
  columns: [
    'TransID',
    'BatchID',
    'Reference',
    'VendorCode',
    'VendorName',
    'VendorAcctNumber',
    'Amount',
    'Remarks',
    'VendorBankName',
  ],
  mapRow: (row, index, ctx) => [
    row.transactionId,
    ctx.batchId,
    ctx.batchReference,
    row.bankId,
    row.accountName ?? row.fullName,
    row.accountNumber,
    row.amount.toFixed(2),
    row.fullName,
    row.bankName,
  ],
}
