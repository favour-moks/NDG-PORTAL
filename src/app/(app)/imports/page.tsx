import { requireRole } from '@/lib/auth/guards'
import { EditionSwitcher } from '@/components/features/EditionSwitcher'
import { resolveEdition } from '@/lib/edition/context'
import { createClient } from '@/lib/supabase/server'
import { FileDrop } from '@/components/features/import/FileDrop'

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>
}) {
  await requireRole(['admin', 'editor'])
  const { edition: editionIdParam } = await searchParams
  const supabase = await createClient()

  const [edition, { data: allEditions }] = await Promise.all([
    resolveEdition(editionIdParam),
    supabase.from('editions').select('id, name, status').order('year', { ascending: false }),
  ])

  if (!edition) {
    return (
      <main>
        <h1>Import</h1>
        <p>No active edition yet. An admin needs to create and activate an edition before imports can begin.</p>
      </main>
    )
  }

  const [{ data: categories }, { data: states }, { data: sports }, { data: committees }, { data: importRuns }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id, name, is_state_scoped, requires_sport, requires_committee')
        .eq('active', true)
        .order('sort_order'),
      supabase.from('states').select('id, name').eq('active', true).order('name'),
      supabase.from('sports').select('id, name').eq('active', true).order('name'),
      supabase.from('committees').select('id, name').eq('active', true).order('name'),
      supabase
        .from('import_runs')
        .select('id, original_name, kind, row_count, accepted_count, rejected_count, status, created_at')
        .eq('edition_id', edition.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  return (
    <main>
      <h1>Import — {edition.name}</h1>

      {allEditions && allEditions.length > 1 ? (
        <EditionSwitcher editions={allEditions} currentEditionId={edition.id} />
      ) : null}

      {edition.isReference ? (
        <p>
          This is a reference edition — advisory only. Records imported here raise non-blocking review
          items against the active edition and never gate anyone&apos;s eligibility.
        </p>
      ) : null}

      <FileDrop
        editionId={edition.id}
        categories={categories ?? []}
        states={states ?? []}
        sports={sports ?? []}
        committees={committees ?? []}
      />

      <h2>Import history</h2>
      {importRuns && importRuns.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Kind</th>
              <th scope="col">Rows</th>
              <th scope="col">Accepted</th>
              <th scope="col">Rejected</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {importRuns.map((run) => (
              <tr key={run.id}>
                <td>{run.original_name}</td>
                <td>{run.kind}</td>
                <td>{run.row_count}</td>
                <td>{run.accepted_count}</td>
                <td>{run.rejected_count}</td>
                <td>{run.status}</td>
                <td>{new Date(run.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No imports yet. Upload a pre-games list to begin.</p>
      )}
    </main>
  )
}
