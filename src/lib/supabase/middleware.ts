import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

// Refreshes the auth session on every request and redirects unauthenticated
// requests away from protected routes. Called from the root middleware.ts.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getUser(). A simple
  // mistake here can make it very hard to debug random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const publicPaths = ['/sign-in', '/accept-invite', '/auth/confirm']
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: return supabaseResponse as-is, or a new NextResponse built from
  // request.headers, and be sure to copy over the cookies. Creating a new
  // response object without doing this can cause the browser and server to
  // lose the session.
  return supabaseResponse
}
