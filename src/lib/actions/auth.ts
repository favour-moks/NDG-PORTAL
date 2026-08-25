'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import postgres from 'postgres'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, recordRateLimitEvent } from '@/lib/rate-limit'

export type SignInResult = { ok: true } | { ok: false; error: string }

const AUTH_ATTEMPTS_LIMIT = 10
const AUTH_ATTEMPTS_WINDOW_MINUTES = 15

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { ok: false, error: 'Enter your email address and password.' }
  }

  // By IP, not by the attempted email — an attacker guessing a real
  // user's password shouldn't be able to lock that user out by
  // deliberately tripping a per-account limit instead.
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headerList.get('x-real-ip') ?? 'unknown'
  const bucket = `auth:${ip}`

  const sql = postgres(process.env.DATABASE_URL as string)
  try {
    const { allowed } = await checkRateLimit(sql, bucket, AUTH_ATTEMPTS_LIMIT, AUTH_ATTEMPTS_WINDOW_MINUTES)
    if (!allowed) {
      return {
        ok: false,
        error: `Too many sign-in attempts. Try again in a few minutes.`,
      }
    }
    await recordRateLimitEvent(sql, bucket)
  } finally {
    await sql.end()
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
