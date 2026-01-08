import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = params

    const session = await prisma.decisionSession.findUnique({
      where: { id: sessionId },
      include: {
        group: {
          include: {
            members: true,
          },
        },
        rounds: {
          include: {
            votes: {
              where: {
                user_id: user.id,
              },
            },
          },
          orderBy: {
            round_number: 'asc',
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify user is a member
    const isMember = session.group.members.some(
      (member) => member.user_id === user.id
    )

    if (!isMember) {
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      )
    }

    // Get current round
    const currentRound = session.rounds.find(
      (r) => r.round_number === session.current_round
    )

    if (!currentRound) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Check if user has voted on all movies in current round
    const movieIds = currentRound.movie_tmdb_ids as number[]
    const userVotes = currentRound.votes
    const hasVotedOnAll = movieIds.every((tmdbId) =>
      userVotes.some((vote) => vote.movie_tmdb_id === tmdbId)
    )

    // Check how many members have voted on all movies in this round
    const memberIds = session.group.members.map((m) => m.user_id)
    const allVotesInRound = await prisma.vote.findMany({
      where: { round_id: currentRound.id },
    })

    // Count members who have voted on all movies
    const membersVotedCount = memberIds.filter((memberId) =>
      movieIds.every((tmdbId) =>
        allVotesInRound.some(
          (vote) => vote.user_id === memberId && vote.movie_tmdb_id === tmdbId
        )
      )
    ).length

    const totalMembers = memberIds.length
    const waitingCount = totalMembers - membersVotedCount

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        current_round: session.current_round,
        final_movie_tmdb_id: session.final_movie_tmdb_id,
      },
      currentRound: {
        id: currentRound.id,
        round_number: currentRound.round_number,
        movie_tmdb_ids: movieIds,
      },
      userVotes: userVotes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote,
        reason_text: v.reason_text,
      })),
      hasVotedOnAll,
      // Async session info (do not reveal vote counts or identities)
      roundStatus: {
        membersVoted: membersVotedCount,
        totalMembers: totalMembers,
        waitingForMembers: waitingCount,
        isComplete: waitingCount === 0,
      },
    })
  } catch (error) {
    console.error('Error fetching session status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session status' },
      { status: 500 }
    )
  }
}
