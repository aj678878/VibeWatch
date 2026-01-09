import { NextRequest, NextResponse } from 'next/server'

/**
 * Client-side error logging endpoint
 * Logs errors from the browser to help debug issues that don't show up in server logs
 */
export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json()
    
    // Log to server console with [CLIENT ERROR] prefix for easy filtering
    console.error('[CLIENT ERROR]', JSON.stringify(errorData, null, 2))
    
    // Return success (we don't want error logging to fail)
    return NextResponse.json({ success: true })
  } catch (error) {
    // Even if logging fails, don't throw - we don't want to break the app
    console.error('[CLIENT ERROR] Failed to log error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
