import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { recommendMovies } from '@/lib/groq'

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

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      )
    }

    if (session.current_round < 5) {
      return NextResponse.json(
        { error: 'Session has not reached round 5' },
        { status: 400 }
      )
    }

    // Get all votes from all rounds
    const allVotes = session.rounds.flatMap((round) =>
      round.votes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote as 'yes' | 'no',
        reason_text: v.reason_text,
      }))
    )

    // Prepare round history
    const roundHistory = session.rounds.map((round) => ({
      round_number: round.round_number,
      movie_tmdb_ids: round.movie_tmdb_ids as number[],
    }))

    // Get watchlist IDs
    const watchlistTmdbIds = session.group.watchlists.map((w) => w.tmdb_id)

    // Get AI recommendation
    const recommendation = await recommendMovies(
      session.vibe_text,
      allVotes,
      roundHistory,
      watchlistTmdbIds
    )

    // Update session with final movie
    await prisma.decisionSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        final_movie_tmdb_id: recommendation.topPick.tmdb_id,
      },
    })

    // Add chosen movie to group watchlist (if not already there)
    const existing = await prisma.groupWatchlist.findUnique({
      where: {
        group_id_tmdb_id: {
          group_id: session.group_id,
          tmdb_id: recommendation.topPick.tmdb_id,
        },
      },
    })

    if (!existing) {
      await prisma.groupWatchlist.create({
        data: {
          group_id: session.group_id,
          tmdb_id: recommendation.topPick.tmdb_id,
        },
      })
    }

    // Optionally add alternates as suggestions (skip for MVP simplicity)

    return NextResponse.json({
      success: true,
      recommendation,
    })
  } catch (error) {
    console.error('Error generating final resolution:', error)
    return NextResponse.json(
      { error: 'Failed to generate final resolution' },
      { status: 500 }
    )
  }
}
