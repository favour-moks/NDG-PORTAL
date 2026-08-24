import Link from 'next/link'
import { requireSession } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { createClient } from '@/lib/supabase/server'
import { getImportChecklist } from '@/lib/query/importChecklist'

// The editor home work queue (TASK-057, PRD § 8 Screen: Editor Home) —
// three panels of *outstanding work*, not analytics: uploads still
// missing, review items waiting on a decision, and the most recent
// disbursement batches. Every count here links through to the screen
// that resolves it.
export default async function HomePage() {
  const profile = await requireSession()

  if (profile.role === 'viewer') {
    return (
      <p>
        Welcome, {profile.fullName}. You have {profile.role} access.
      </p>
    )
  }

  const edition = await resolveEdition()
  const supabase = await createClient()

  if (!edition) {
    return (
      <main>
        <h1>Welcome, {profile.fullName}</h1>
        <p>No active edition yet. An admin needs to create and activate an edition before work can begin.</p>
      </main>
    )
  }

  const [checklist, { count: openReviewCount }, { data: recentBatches }] = await Promise.all([
    getImportChecklist(edition.id),
    supabase.from('duplicate_reviews').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase
      .from('payment_batches')
      .select('id, reference, record_count, total_amount, status, generated_at')
      .eq('edition_id', edition.id)
      .order('generated_at', { ascending: false })
      .limit(5),
  ])

  const totalRequiredUploads = checklist.states.length * checklist.categories.length
  const outstandingUploads = totalRequiredUploads - checklist.cellByKey.size

  return (
    <main>
      <h1>Welcome, {profile.fullName}</h1>
      <p>{edition.name}</p>

      <section>
        <h2>Outstanding uploads</h2>
        {totalRequiredUploads === 0 ? (
          <p>No state-scoped participant categories are configured yet.</p>
        ) : outstandingUploads === 0 ? (
          <p>Every state has uploaded every category.</p>
        ) : (
          <p>
            <Link href={`/imports/checklist?edition=${edition.id}`}>
              {outstandingUploads} of {totalRequiredUploads} state/category uploads still outstanding
            </Link>
          </p>
        )}
      </section>

      <section>
        <h2>Open review items</h2>
        {openReviewCount && openReviewCount > 0 ? (
          <p>
            <Link href="/review">{openReviewCount} record(s) waiting on a duplicate review decision</Link>
          </p>
        ) : (
          <p>No records need review.</p>
        )}
      </section>

      <section>
        <h2>Recent batches</h2>
        {recentBatches && recentBatches.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Records</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Generated</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.reference}</td>
                  <td>{batch.record_count}</td>
                  <td>{Number(batch.total_amount).toLocaleString()}</td>
                  <td>{batch.status}</td>
                  <td>{new Date(batch.generated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No disbursement batches generated yet.</p>
        )}
      </section>
    </main>
  )
}
