// Path: src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )

  if (token_hash && type === 'recovery') {
    // Strip pkce_ prefix if present
    const cleanHash = token_hash.startsWith('pkce_') ? token_hash.slice(5) : token_hash
    const { error } = await supabase.auth.verifyOtp({
      token_hash: cleanHash,
      type: 'recovery',
    })
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
    // Log error to help debug
    console.error('verifyOtp error:', error)
  }

  if (code) {
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        name: data.user.email?.split('@')[0],
      })
    }
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
    return NextResponse.redirect(`${origin}/`)
  }

  return NextResponse.redirect(`${origin}/`)
}
