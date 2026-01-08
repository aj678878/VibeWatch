import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'
import { selectNextRoundMovies } from '@/lib/ai/movie-selector'

export async function POST(
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
            participants: {
              where: { status: 'active' },
            },
            watchlists: true,
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

    // Verify user is a participant
    const currentParticipant = await getCurrentParticipant(session.group_id)
    if (!currentParticipant) {
      return NextResponse.json(
        { error: 'Not a participant in this group' },
        { status: 403 }
      )
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      )
    }

    if (session.current_round >= 5) {
      return NextResponse.json(
        { error: 'Maximum rounds reached' },
        { status: 400 }
      )
    }

    // Get current round votes
    const currentRound = session.rounds.find(
      (r) => r.round_number === session.current_round
    )

    if (!currentRound) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Prepare round history for AI
    const roundHistory = session.rounds.map((round) => ({
      round_number: round.round_number,
      movie_tmdb_ids: round.movie_tmdb_ids as number[],
      votes: round.votes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote as 'yes' | 'no',
        reason_text: v.reason_text,
      })),
    }))

    const currentRoundVotes = currentRound.votes.map((v) => ({
      movie_tmdb_id: v.movie_tmdb_id,
      vote: v.vote as 'yes' | 'no',
      reason_text: v.reason_text,
    }))

    // Get watchlist IDs
    const watchlistTmdbIds = session.group.watchlists.map((w) => w.tmdb_id)

    // Use AI to select next round movies
    const nextRoundMovies = await selectNextRoundMovies(
      session.vibe_text,
      currentRoundVotes,
      roundHistory,
      watchlistTmdbIds
    )

    // Create next round
    const nextRoundNumber = session.current_round + 1
    await prisma.votingRound.create({
      data: {
        session_id: sessionId,
        round_number: nextRoundNumber,
        movie_tmdb_ids: nextRoundMovies,
      },
    })

    // Update session current round
    await prisma.decisionSession.update({
      where: { id: sessionId },
      data: {
        current_round: nextRoundNumber,
      },
    })

    return NextResponse.json({
      success: true,
      nextRound: nextRoundNumber,
      movies: nextRoundMovies,
    })
  } catch (error) {
    console.error('Error refining round:', error)
    return NextResponse.json(
      { error: 'Failed to refine round' },
      { status: 500 }
    )
  }
}
