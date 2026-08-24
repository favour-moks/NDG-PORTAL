import { requireRole } from '@/lib/auth/guards'
import { EditionSwitcher } from '@/components/features/EditionSwitcher'
import { resolveEdition } from '@/lib/edition/context'
import { createClient } from '@/lib/supabase/server'
import { ArrivalFeedUpload } from '@/components/features/accreditation/ArrivalFeedUpload'
import { DeskEntry } from '@/components/features/accreditation/DeskEntry'

export default async function AccreditationPage({
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
        <h1>Accreditation</h1>
        <p>No active edition yet. An admin needs to create and activate an edition before accreditation can begin.</p>
      </main>
    )
  }

  const [{ count: preGamesCount }, { count: arrivalCount }, { count: totalCount }, { data: feedRuns }] =
    await Promise.all([
      supabase
        .from('participations')
        .select('*', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .eq('pre_games_accredited', true),
      supabase
        .from('participations')
        .select('*', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .eq('arrival_accredited', true),
      supabase
        .from('participations')
        .select('*', { count: 'exact', head: true })
        .eq('edition_id', edition.id),
      supabase
        .from('import_runs')
        .select('id, original_name, row_count, accepted_count, rejected_count, status, created_at')
        .eq('edition_id', edition.id)
        .eq('kind', 'arrival_accreditation')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  const notAccreditedCount = (totalCount ?? 0) - (arrivalCount ?? 0)

  return (
    <main>
      <h1>Accreditation — {edition.name}</h1>

      {allEditions && allEditions.length > 1 ? (
        <EditionSwitcher editions={allEditions} currentEditionId={edition.id} />
      ) : null}

      <section>
        <h2>Counts</h2>
        <p>Pre-games accredited: {preGamesCount ?? 0}</p>
        <p>Arrival accredited: {arrivalCount ?? 0}</p>
        <p>Not arrival accredited: {notAccreditedCount}</p>
      </section>

      <section>
        <h2>Arrival accreditation feed</h2>
        <ArrivalFeedUpload editionId={edition.id} />
        {feedRuns && feedRuns.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Rows</th>
                <th scope="col">Matched</th>
                <th scope="col">Unmatched</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {feedRuns.map((run) => (
                <tr key={run.id}>
                  <td>{run.original_name}</td>
                  <td>{run.row_count}</td>
                  <td>{run.accepted_count}</td>
                  <td>{run.rejected_count}</td>
                  <td>{new Date(run.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No arrival accreditation feed imported yet.</p>
        )}
      </section>

      <DeskEntry editionId={edition.id} />
    </main>
  )
}
