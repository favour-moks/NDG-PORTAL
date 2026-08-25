import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { listAllCategories } from '@/lib/query/reference'

export default async function DrmIndexPage() {
  await requireRole(['admin', 'editor'])
  const categories = await listAllCategories()

  return (
    <main>
      <h1>DRM</h1>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <Link href={`/drm/${category.id}`}>{category.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
