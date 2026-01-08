import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: { groupId: string; participantId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId, participantId } = params

    // Verify user is the host
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (group.created_by_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the host can remove guests' },
        { status: 403 }
      )
    }

    // Find participant
    const participant = await prisma.groupParticipant.findUnique({
      where: { id: participantId },
    })

    if (!participant || participant.group_id !== groupId) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      )
    }

    if (participant.type !== 'guest') {
      return NextResponse.json(
        { error: 'Can only remove guests' },
        { status: 400 }
      )
    }

    // Remove guest (set status to 'removed')
    await prisma.groupParticipant.update({
      where: { id: participantId },
      data: { status: 'removed' },
    })

    // Check if there's an active session and re-evaluate round completion
    const activeSession = await prisma.decisionSession.findFirst({
      where: {
        group_id: groupId,
        status: 'active',
      },
      include: {
        rounds: {
          where: {
            round_number: {
              // Get current round
            },
          },
          include: {
            votes: true,
          },
        },
      },
    })

    if (activeSession) {
      // Trigger round completion check (this will be handled by the vote submission endpoint)
      // For now, we just return success - the next vote will trigger the check
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing guest:', error)
    return NextResponse.json(
      { error: 'Failed to remove guest' },
      { status: 500 }
    )
  }
}
