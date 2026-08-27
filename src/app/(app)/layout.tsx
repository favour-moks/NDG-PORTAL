import Image from 'next/image'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/guards'
import { signOut } from '@/lib/actions/auth'

const linkClass =
  'rounded-md px-3 py-1.5 text-sm font-medium text-navy-100 no-underline transition hover:bg-navy-700 hover:text-white'

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
    <div className="min-h-screen bg-surface">
      <header className="border-b border-navy-900 bg-navy-800">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1 shadow-sm">
              <Image src="/logo.jpeg" alt="Niger Delta Games" width={28} height={28} priority className="h-full w-full object-contain" />
            </span>
            <span className="hidden text-sm font-semibold text-white sm:inline">NDG Payment Portal</span>
          </Link>

          <ul className="flex flex-1 flex-wrap items-center gap-1">
            <li>
              <Link className={linkClass} href="/">
                Home
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/participants">
                Participants
              </Link>
            </li>
            {canEdit ? (
              <>
                <li>
                  <Link className={linkClass} href="/personnel">
                    Personnel
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/drm">
                    DRM
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/accreditation">
                    Accreditation
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/imports">
                    Import
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/imports/checklist">
                    Checklist
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/review">
                    Review
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/payments">
                    Payments
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/admin/editions">
                    Editions
                  </Link>
                </li>
                <li>
                  <Link className={linkClass} href="/admin/reference">
                    Reference data
                  </Link>
                </li>
              </>
            ) : null}
            {isAdmin ? (
              <li>
                <Link className={linkClass} href="/admin/users">
                  Users
                </Link>
              </li>
            ) : null}
          </ul>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-white">{profile.fullName}</div>
              <div className="text-xs uppercase tracking-wide text-navy-300">{profile.role}</div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-navy-500 bg-transparent px-3 py-1.5 text-sm font-medium text-navy-100 shadow-none hover:bg-navy-700 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
