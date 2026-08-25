import Link from 'next/link'
import { requireSession } from '@/lib/auth/guards'
import { signOut } from '@/lib/actions/auth'

// Role-scoped: viewers get exactly one destination beyond home
// (Participants, which already redirects them straight into their own
// state — TASK-070) and never see payments, admin, or anything
// editor/admin-only. Editors and admins get the full set; only admins
// see Users, since only admins change an existing user's role or
// deactivate them (editors invite, but don't manage existing accounts —
// PRD § 9 role table).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Fetched once here, not re-queried per component further down the tree.
  const profile = await requireSession()
  const canEdit = profile.role === 'admin' || profile.role === 'editor'
  const isAdmin = profile.role === 'admin'

  return (
    <div>
      <header>
        <nav>
          <span>NDG Payment Accreditation Portal</span>
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/participants">Participants</Link>
            </li>
            {canEdit ? (
              <>
                <li>
                  <Link href="/personnel">Personnel</Link>
                </li>
                <li>
                  <Link href="/drm">DRM</Link>
                </li>
                <li>
                  <Link href="/accreditation">Accreditation</Link>
                </li>
                <li>
                  <Link href="/imports">Import</Link>
                </li>
                <li>
                  <Link href="/imports/checklist">Upload checklist</Link>
                </li>
                <li>
                  <Link href="/review">Review queue</Link>
                </li>
                <li>
                  <Link href="/payments">Payments</Link>
                </li>
                <li>
                  <Link href="/admin/editions">Editions</Link>
                </li>
                <li>
                  <Link href="/admin/reference">Reference data</Link>
                </li>
              </>
            ) : null}
            {isAdmin ? (
              <li>
                <Link href="/admin/users">Users</Link>
              </li>
            ) : null}
          </ul>
          <span>
            {profile.fullName} ({profile.role})
          </span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
