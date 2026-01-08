import { createClient } from '@/lib/supabase/server'
import { getGuestParticipantId } from '@/lib/guest-auth'
import { prisma } from '@/lib/prisma'

/**
 * Get the current participant (member or guest) for a group
 * Returns null if user is not a participant
 */
export async function getCurrentParticipant(groupId: string): Promise<{
  id: string
  type: 'member' | 'guest'
  user_id: string | null
  preferred_name: string | null
  status: string
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Try to find as logged-in member first
  if (user) {
    const memberParticipant = await prisma.groupParticipant.findFirst({
      where: {
        group_id: groupId,
        user_id: user.id,
        type: 'member',
        status: 'active',
      },
    })

    if (memberParticipant) {
      return {
        ...memberParticipant,
        type: memberParticipant.type as 'member' | 'guest', // Type assertion for literal union
      }
    }
  }

  // Try to find as guest
  const guestParticipantId = await getGuestParticipantId()
  if (guestParticipantId) {
    const guestParticipant = await prisma.groupParticipant.findFirst({
      where: {
        id: guestParticipantId,
        group_id: groupId,
        type: 'guest',
        status: 'active',
      },
    })

    if (guestParticipant) {
      return {
        ...guestParticipant,
        type: guestParticipant.type as 'member' | 'guest', // Type assertion for literal union
      }
    }
  }

  return null
}

/**
 * Get all active participants for a group
 */
export async function getGroupParticipants(groupId: string) {
  return prisma.groupParticipant.findMany({
    where: {
      group_id: groupId,
      status: 'active',
    },
    orderBy: {
      created_at: 'asc',
    },
  })
}
