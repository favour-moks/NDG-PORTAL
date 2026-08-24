import { defaultDisbursementFormat } from './default'
import type { DisbursementFormat } from '../types'

// Registering a new format here — and nowhere else — is what "switching
// format config changes output without code changes" (TASK-058 verify
// criterion) actually means once the real specification lands: add the
// new format file, register its id, done.
const disbursementFormats: Record<string, DisbursementFormat> = {
  default: defaultDisbursementFormat,
}

export function getDisbursementFormat(id: string): DisbursementFormat {
  const format = disbursementFormats[id]
  if (!format) {
    throw new Error(`Unknown disbursement format: ${id}`)
  }
  return format
}
