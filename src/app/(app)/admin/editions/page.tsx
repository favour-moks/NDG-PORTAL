import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { EditionsAdmin } from './EditionsAdmin'

export default async function AdminEditionsPage() {
  const profile = await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const { data: editions } = await supabase
    .from('editions')
    .select('id, name, year, status, is_reference, closed_at')
    .order('year', { ascending: false })

  return (
    <main>
      <h1>Editions</h1>
      <EditionsAdmin editions={editions ?? []} isAdmin={profile.role === 'admin'} />
    </main>
  )
}
