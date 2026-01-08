import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

const SECRET_KEY = process.env.GUEST_SESSION_SECRET || 'default-secret-change-in-production'
const COOKIE_NAME = 'vw_guest_participant'

/**
 * Create a signed guest session cookie value
 */
export function createGuestSessionToken(participantId: string): string {
  const timestamp = Date.now()
  const message = `${participantId}:${timestamp}`
  const signature = createHmac('sha256', SECRET_KEY).update(message).digest('hex')
  return `${message}:${signature}`
}

/**
 * Verify and extract participant ID from guest cookie
 */
export async function getGuestParticipantId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return null
    }

    const parts = token.split(':')
    if (parts.length !== 3) {
      return null
    }

    const [participantId, timestamp, signature] = parts
    const message = `${participantId}:${timestamp}`
    const expectedSignature = createHmac('sha256', SECRET_KEY).update(message).digest('hex')

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return null
    }

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null
    }

    // Check if token is expired (30 days)
    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return null
    }

    return participantId
  } catch (error) {
    console.error('Error verifying guest session:', error)
    return null
  }
}

/**
 * Get cookie options for setting guest session
 */
export function getGuestCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  }
}
