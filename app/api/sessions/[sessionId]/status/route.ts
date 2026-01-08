import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params

    const session = await prisma.decisionSession.findUnique({
      where: { id: sessionId },
      include: {
        group: {
          include: {
            participants: {
              where: { status: 'active' },
            },
          },
        },
        rounds: {
          include: {
            votes: true,
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

    // Get current participant
    const currentParticipant = await getCurrentParticipant(session.group_id)
    if (!currentParticipant) {
      return NextResponse.json(
        { error: 'Not a participant in this group' },
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

    const movieIds = currentRound.movie_tmdb_ids as number[]
    const allVotesInRound = currentRound.votes

    // Get current participant's votes
    const currentParticipantVotes = allVotesInRound.filter(
      (v) => v.participant_id === currentParticipant.id
    )

    const hasVotedOnAll = movieIds.every((tmdbId) =>
      currentParticipantVotes.some((vote) => vote.movie_tmdb_id === tmdbId)
    )

    // Get participant completion status (for status dots)
    const activeParticipants = session.group.participants
    const participantsStatus = activeParticipants.map((p) => {
      const participantVotes = allVotesInRound.filter(
        (v) => v.participant_id === p.id
      )
      const hasCompleted = movieIds.every((tmdbId) =>
        participantVotes.some((vote) => vote.movie_tmdb_id === tmdbId)
      )

      return {
        id: p.id,
        type: p.type,
        displayName: p.preferred_name || (p.type === 'member' ? 'Member' : 'Guest'),
        hasCompleted,
      }
    })

    // Count participants who have completed
    const completedCount = participantsStatus.filter((p) => p.hasCompleted).length
    const totalParticipants = activeParticipants.length
    const waitingCount = totalParticipants - completedCount
    const isRoundComplete = waitingCount === 0

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
      userVotes: currentParticipantVotes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote,
        reason_text: v.reason_text,
      })),
      hasVotedOnAll,
      participantsStatus, // For showing green/red dots
      roundStatus: {
        participantsCompleted: completedCount,
        totalParticipants,
        waitingForParticipants: waitingCount,
        isComplete: isRoundComplete,
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
