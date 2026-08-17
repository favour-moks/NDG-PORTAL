'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SignInResult = { ok: true } | { ok: false; error: string }

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { ok: false, error: 'Enter your email address and password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      ok: false,
      error: 'We could not sign you in. Check the email address, or request a new invite.',
    }
  }

  redirect('/')
}

export type SetPasswordResult = { ok: true } | { ok: false; error: string }

// Called from the accept-invite screen. Requires an active session, which
// src/app/auth/confirm/route.ts establishes from the invite email's link
// before this page is ever reached.
export async function setPassword(formData: FormData): Promise<SetPasswordResult> {
  const password = String(formData.get('password') ?? '')

  if (password.length < 8) {
    return { ok: false, error: 'Choose a password with at least 8 characters.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { ok: false, error: 'We could not set your password. Request a new invite.' }
  }

  redirect('/')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
