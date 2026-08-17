import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteForm } from './AcceptInviteForm'

export default async function AcceptInvitePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Reaching this page without a session means the invite link was not
  // followed through /auth/confirm — send back to sign-in rather than show
  // a password form with nothing to attach it to.
  if (!user) redirect('/sign-in?error=invite-expired')

  return (
    <main>
      <h1>Welcome to the NDG Payment Accreditation Portal</h1>
      <p>Set a password to finish setting up your account.</p>
      <AcceptInviteForm />
    </main>
  )
}
