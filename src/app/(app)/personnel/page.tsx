import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { listCategories } from '@/lib/query/reference'

export default async function PersonnelIndexPage() {
  await requireRole(['admin', 'editor'])
  const categories = await listCategories('personnel')

  return (
    <main>
      <h1>Personnel</h1>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <Link href={`/personnel/${category.id}`}>{category.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
