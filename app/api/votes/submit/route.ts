import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roundId, movieTmdbId, vote, reasonText } = await request.json()

    if (!roundId || !movieTmdbId || !vote) {
      return NextResponse.json(
        { error: 'roundId, movieTmdbId, and vote are required' },
        { status: 400 }
      )
    }

    if (vote !== 'yes' && vote !== 'no') {
      return NextResponse.json(
        { error: 'vote must be "yes" or "no"' },
        { status: 400 }
      )
    }

    // Verify round exists and get session
    const round = await prisma.votingRound.findUnique({
      where: { id: roundId },
      include: {
        session: {
          include: {
            group: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    })

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Verify user is a member of the group
    const isMember = round.session.group.members.some(
      (member) => member.user_id === user.id
    )

    if (!isMember) {
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      )
    }

    // Check if session is still active
    if (round.session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      )
    }

    // Check if vote already exists
    const existingVote = await prisma.vote.findUnique({
      where: {
        round_id_user_id_movie_tmdb_id: {
          round_id: roundId,
          user_id: user.id,
          movie_tmdb_id: movieTmdbId,
        },
      },
    })

    if (existingVote) {
      // Update existing vote
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: {
          vote,
          reason_text: reasonText || null,
        },
      })
    } else {
      // Create new vote
      await prisma.vote.create({
        data: {
          round_id: roundId,
          user_id: user.id,
          movie_tmdb_id: movieTmdbId,
          vote,
          reason_text: reasonText || null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
}
