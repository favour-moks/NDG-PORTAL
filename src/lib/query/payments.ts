import { createClient } from '@/lib/supabase/server'

export type BatchSummary = {
  id: string
  reference: string
  description: string | null
  recordCount: number
  totalAmount: number
  status: string
  generatedAt: string
  generatedByName: string
}

// Batches, newest first (TASK-062). Paid-to-date and balance are computed
// straight from `payments` wherever they're shown (participations_v's
// amount_paid/balance columns, 007_views.sql/016_view_filter_columns.sql)
// — never stored on the participation, so two batches six weeks apart
// for the same person sum correctly without any special-case logic here.
export async function listBatches(editionId: string): Promise<BatchSummary[]> {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from('payment_batches')
    .select('id, reference, description, record_count, total_amount, status, generated_at, generated_by')
    .eq('edition_id', editionId)
    .order('generated_at', { ascending: false })

  if (!batches || batches.length === 0) return []

  const generatorIds = [...new Set(batches.map((b) => b.generated_by))]
  const { data: generators } = await supabase.from('user_profiles').select('id, full_name').in('id', generatorIds)
  const nameById = new Map((generators ?? []).map((g) => [g.id, g.full_name]))

  return batches.map((batch) => ({
    id: batch.id,
    reference: batch.reference,
    description: batch.description,
    recordCount: batch.record_count,
    totalAmount: Number(batch.total_amount),
    status: batch.status,
    generatedAt: batch.generated_at,
    generatedByName: nameById.get(batch.generated_by) ?? 'Unknown',
  }))
}

export type BatchPaymentRow = {
  id: string
  participationId: string
  fullName: string
  accountNumber: string
  bankName: string
  amount: number
  status: string
  partnerReference: string | null
  failureReason: string | null
  paidAt: string | null
}

export type BatchDetail = BatchSummary & {
  editionId: string
  payments: BatchPaymentRow[]
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  const supabase = await createClient()
  const { data: batch } = await supabase
    .from('payment_batches')
    .select('id, edition_id, reference, description, record_count, total_amount, status, generated_at, generated_by')
    .eq('id', batchId)
    .maybeSingle()

  if (!batch) return null

  const [{ data: generator }, { data: payments }] = await Promise.all([
    supabase.from('user_profiles').select('full_name').eq('id', batch.generated_by).maybeSingle(),
    supabase
      .from('payments')
      .select('id, participation_id, amount, account_number, bank_id, status, partner_reference, failure_reason, paid_at')
      .eq('batch_id', batchId),
  ])

  const participationIds = (payments ?? []).map((p) => p.participation_id)
  const bankIds = [...new Set((payments ?? []).map((p) => p.bank_id))]

  const [{ data: participations }, { data: banks }] = await Promise.all([
    participationIds.length > 0
      ? supabase.from('participations').select('id, person_id').in('id', participationIds)
      : Promise.resolve({ data: [] as { id: string; person_id: string }[] }),
    bankIds.length > 0
      ? supabase.from('banks').select('id, name').in('id', bankIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const personIdByParticipation = new Map((participations ?? []).map((p) => [p.id, p.person_id]))
  const personIds = [...new Set(Array.from(personIdByParticipation.values()))]
  const { data: persons } =
    personIds.length > 0
      ? await supabase.from('persons').select('id, full_name').in('id', personIds)
      : { data: [] as { id: string; full_name: string }[] }

  const nameByPerson = new Map((persons ?? []).map((p) => [p.id, p.full_name]))
  const bankNameById = new Map((banks ?? []).map((b) => [b.id, b.name]))

  return {
    id: batch.id,
    editionId: batch.edition_id,
    reference: batch.reference,
    description: batch.description,
    recordCount: batch.record_count,
    totalAmount: Number(batch.total_amount),
    status: batch.status,
    generatedAt: batch.generated_at,
    generatedByName: generator?.full_name ?? 'Unknown',
    payments: (payments ?? [])
      .map((p) => {
        const personId = personIdByParticipation.get(p.participation_id)
        return {
          id: p.id,
          participationId: p.participation_id,
          fullName: (personId && nameByPerson.get(personId)) ?? 'Unknown',
          accountNumber: p.account_number,
          bankName: bankNameById.get(p.bank_id) ?? p.bank_id,
          amount: Number(p.amount),
          status: p.status,
          partnerReference: p.partner_reference,
          failureReason: p.failure_reason,
          paidAt: p.paid_at,
        }
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  }
}
