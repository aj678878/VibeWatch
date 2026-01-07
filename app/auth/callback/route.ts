import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/groups'

  if (code) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL(next, requestUrl.origin))

    // Use NEXT_PUBLIC_ versions to ensure consistency with client-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      const url = new URL('/login', requestUrl.origin)
      url.searchParams.set('error', 'auth_failed')
      url.searchParams.set('message', encodeURIComponent('Server configuration error'))
      return NextResponse.redirect(url)
    }

    // Force read all cookies before creating the client (important for PKCE)
    const allCookies = cookieStore.getAll()
    console.log('Cookies available:', allCookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', '))
    
    // Check for PKCE-related cookies
    const pkceCookies = allCookies.filter(c => 
      c.name.includes('code') || c.name.includes('verifier') || c.name.includes('pkce')
    )
    console.log('PKCE-related cookies:', pkceCookies.map(c => c.name).join(', ') || 'none found')

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: code?.substring(0, 20) + '...',
        supabaseUrl: process.env.SUPABASE_URL ? 'set' : 'missing',
        supabaseKey: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
      })
      // Redirect to login with error
      const url = new URL('/login', requestUrl.origin)
      url.searchParams.set('error', 'auth_failed')
      url.searchParams.set('message', encodeURIComponent(error.message))
      return NextResponse.redirect(url)
    }

    console.log('Successfully exchanged code for session:', data.user?.id)

    return response
  }

  // No code provided, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
