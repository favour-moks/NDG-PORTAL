import { requireSession } from '@/lib/auth/guards'
import { signOut } from '@/lib/actions/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Fetched once here, not re-queried per component further down the tree.
  const profile = await requireSession()

  return (
    <div>
      <header>
        <nav>
          <span>NDG Payment Accreditation Portal</span>
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
