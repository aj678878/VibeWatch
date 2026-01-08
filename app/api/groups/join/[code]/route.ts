import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { createGuestSessionToken, getGuestCookieOptions } from '@/lib/guest-auth'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params
    const body = await request.json().catch(() => ({}))
    const { preferredName } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Find group by invite code
    const group = await prisma.group.findUnique({
      where: { invite_code: code },
      include: {
        participants: {
          where: { status: 'active' },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // If user is logged in, join as member
    if (user) {
      // Check if already a participant
      const existingParticipant = await prisma.groupParticipant.findFirst({
        where: {
          group_id: group.id,
          user_id: user.id,
          type: 'member',
          status: 'active',
        },
      })

      if (existingParticipant) {
        return NextResponse.json({ group })
      }

      // Check legacy GroupMember table
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          user_id_group_id: {
            user_id: user.id,
            group_id: group.id,
          },
        },
      })

      if (existingMember) {
        // Migrate to participant
        await prisma.groupParticipant.create({
          data: {
            group_id: group.id,
            type: 'member',
            user_id: user.id,
            preferred_name: user.email?.split('@')[0] || 'Member',
            status: 'active',
          },
        })
        return NextResponse.json({ group })
      }

      // Create new member participant
      await prisma.groupParticipant.create({
        data: {
          group_id: group.id,
          type: 'member',
          user_id: user.id,
          preferred_name: user.email?.split('@')[0] || 'Member',
          status: 'active',
        },
      })

      // Also create legacy GroupMember for backward compatibility
      await prisma.groupMember.create({
        data: {
          user_id: user.id,
          group_id: group.id,
        },
      })

      return NextResponse.json({ group })
    }

    // Guest join - requires preferredName
    if (!preferredName || typeof preferredName !== 'string' || preferredName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Preferred name is required for guest join' },
        { status: 400 }
      )
    }

    // Create guest participant
    const guestParticipant = await prisma.groupParticipant.create({
      data: {
        group_id: group.id,
        type: 'guest',
        user_id: null,
        preferred_name: preferredName.trim(),
        status: 'active',
      },
    })

    // Create guest session cookie
    const token = createGuestSessionToken(guestParticipant.id)
    const cookieOptions = getGuestCookieOptions()
    const response = NextResponse.json({ 
      group,
      participant: {
        id: guestParticipant.id,
        type: 'guest',
        preferred_name: guestParticipant.preferred_name,
      },
    })

    response.cookies.set('vw_guest_participant', token, cookieOptions)

    return response
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json(
      { error: 'Failed to join group' },
      { status: 500 }
    )
  }
}
