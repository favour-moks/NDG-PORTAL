import { requireSession } from '@/lib/auth/guards'

// Placeholder editor/viewer landing page. The real work queue (outstanding
// uploads, open reviews, recent batches) is TASK-057 in Phase 3.
export default async function HomePage() {
  const profile = await requireSession()

  return (
    <p>
      Welcome, {profile.fullName}. You have {profile.role} access.
    </p>
  )
}
