import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * Demo authentication endpoint for testing/college presentation.
 * Creates a demo session without requiring email verification.
 * 
 * WARNING: This should be disabled in production!
 */
export async function POST() {
  try {
    // For demo mode, we'll use Supabase's anonymous sign-in
    // or create a predictable demo user session
    const supabase = await createClient()
    
    // Try anonymous sign in (must be enabled in Supabase dashboard)
    const { data, error } = await supabase.auth.signInAnonymously()
    
    if (error) {
      console.error('Demo login error:', error)
      // If anonymous auth is disabled, return helpful error
      return NextResponse.json(
        { 
          error: 'Demo mode requires anonymous auth enabled in Supabase Dashboard → Authentication → Providers → Anonymous Sign-ins',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      user: data.user,
      message: 'Demo login successful' 
    })
  } catch (error) {
    console.error('Demo auth error:', error)
    return NextResponse.json(
      { error: 'Failed to create demo session' },
      { status: 500 }
    )
  }
}
