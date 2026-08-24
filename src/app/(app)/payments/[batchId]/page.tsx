import { requireRole } from '@/lib/auth/guards'
import { getBatchDetail } from '@/lib/query/payments'
import { formatNaira } from '@/lib/format/money'
import { ImportResults } from '@/components/features/payments/ImportResults'

export default async function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requireRole(['admin', 'editor'])
  const { batchId } = await params
  const batch = await getBatchDetail(batchId)

  if (!batch) {
    return (
      <main>
        <h1>Payments</h1>
        <p>That batch could not be found.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>{batch.reference}</h1>
      <p>
        {batch.recordCount} records · {formatNaira(batch.totalAmount)} · {batch.status} · generated{' '}
        {new Date(batch.generatedAt).toLocaleString()} by {batch.generatedByName}
      </p>
      {batch.description ? <p>{batch.description}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Bank</th>
            <th scope="col">Account number</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Failure reason</th>
          </tr>
        </thead>
        <tbody>
          {batch.payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.fullName}</td>
              <td>{payment.bankName}</td>
              <td>{payment.accountNumber}</td>
              <td>{formatNaira(payment.amount)}</td>
              <td>{payment.status}</td>
              <td>{payment.failureReason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ImportResults batchId={batch.id} />
    </main>
  )
}
