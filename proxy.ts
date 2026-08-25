import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Renamed from middleware.ts per Next.js 16 (middleware.js is deprecated,
// renamed to proxy.js — file/export name change only, per the official
// migration guide).
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, images, fonts
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
