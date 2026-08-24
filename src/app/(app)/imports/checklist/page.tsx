import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { resolveEdition } from '@/lib/edition/context'
import { getImportChecklist } from '@/lib/query/importChecklist'

export default async function ImportChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>
}) {
  await requireRole(['admin', 'editor'])
  const { edition: editionIdParam } = await searchParams
  const edition = await resolveEdition(editionIdParam)

  if (!edition) {
    return (
      <main>
        <h1>Upload checklist</h1>
        <p>No active edition yet.</p>
      </main>
    )
  }

  const { states, categories, cellByKey } = await getImportChecklist(edition.id)

  return (
    <main>
      <h1>Upload checklist — {edition.name}</h1>
      <p>
        <Link href={`/imports?edition=${edition.id}`}>Go to import</Link>
      </p>

      <table>
        <thead>
          <tr>
            <th scope="col">State</th>
            {categories.map((category) => (
              <th key={category.id} scope="col">
                {category.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {states.map((state) => (
            <tr key={state.id}>
              <th scope="row">{state.name}</th>
              {categories.map((category) => {
                const cell = cellByKey.get(`${state.id}:${category.id}`)
                return (
                  <td key={category.id}>
                    {cell ? (
                      <>
                        Uploaded {new Date(cell.uploadedAt).toLocaleDateString()} by {cell.uploaderName}
                      </>
                    ) : (
                      'Not uploaded'
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
