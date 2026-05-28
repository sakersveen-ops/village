// Path: src/middleware.ts (add this to existing middleware, or create if it doesn't exist)
//
// Logged-in users who land on /p/item/[id], /p/profile/[id], /p/community/[id]
// get redirected straight to the real in-app page — no public preview needed.
// New/logged-out users see the public preview page as normal.
//
// Uses Supabase SSR session check (edge-compatible).

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only intercept public preview routes
  const itemMatch     = pathname.match(/^\/p\/item\/([^/]+)$/)
  const profileMatch  = pathname.match(/^\/p\/profile\/([^/]+)$/)
  const communityMatch = pathname.match(/^\/p\/community\/([^/]+)$/)

  if (!itemMatch && !profileMatch && !communityMatch) {
    return NextResponse.next()
  }

  // Check auth via Supabase SSR
  const supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in → show public preview
    return supabaseResponse
  }

  // Logged in → redirect to the real in-app page (the "hook")
  const url = request.nextUrl.clone()
  if (itemMatch)      url.pathname = `/items/${itemMatch[1]}`
  if (profileMatch)   url.pathname = `/profile/${profileMatch[1]}`
  if (communityMatch) url.pathname = `/community/${communityMatch[1]}`

  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/p/:path*'],
}
