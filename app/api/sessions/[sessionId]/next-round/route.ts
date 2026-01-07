import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { selectNextRoundMovies } from '@/lib/ai/movie-selector'
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
            members: true,
            watchlists: true,
          },
        },
        rounds: {
          include: {
            votes: true,
          },
          orderBy: {
            round_number: 'desc',
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

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      )
    }

    // Get current round
    const currentRound = session.rounds[0]
    if (!currentRound) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Check if all members have voted on all movies
    const memberIds = session.group.members.map((m) => m.user_id)
    const movieIds = currentRound.movie_tmdb_ids as number[]
    const allVotes = currentRound.votes

    const allMembersVoted = memberIds.every((memberId) =>
      movieIds.every((tmdbId) =>
        allVotes.some(
          (vote) => vote.user_id === memberId && vote.movie_tmdb_id === tmdbId
        )
      )
    )

    if (!allMembersVoted) {
      return NextResponse.json(
        { error: 'Not all members have voted' },
        { status: 400 }
      )
    }

    // Check for consensus (at least 2 YES votes on same movie for 3-person groups)
    const yesVotesByMovie: Record<number, number> = {}
    movieIds.forEach((tmdbId) => {
      const yesVotes = allVotes.filter(
        (v) => v.movie_tmdb_id === tmdbId && v.vote === 'yes'
      )
      yesVotesByMovie[tmdbId] = yesVotes.length
    })

    // Find movies with at least 2 YES votes
    const consensusMovies = Object.entries(yesVotesByMovie)
      .filter(([_, count]) => count >= 2)
      .map(([tmdbId]) => parseInt(tmdbId))

    if (consensusMovies.length > 0) {
      // Consensus reached - use first movie with consensus
      const finalMovieTmdbId = consensusMovies[0]

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          final_movie_tmdb_id: finalMovieTmdbId,
        },
      })

      return NextResponse.json({
        consensus: true,
        final_movie_tmdb_id: finalMovieTmdbId,
      })
    }

    // No consensus - check if we've reached max rounds
    if (session.current_round >= 5) {
      // Trigger final AI resolution
      try {
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

        return NextResponse.json({
          consensus: false,
          maxRoundsReached: true,
          finalResolution: recommendation,
        })
      } catch (error) {
        console.error('Error triggering final resolution:', error)
        return NextResponse.json({
          consensus: false,
          maxRoundsReached: true,
          error: 'Failed to generate final resolution',
        })
      }
    }

    // Need to generate next round
    try {
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
        consensus: false,
        needsNextRound: true,
        nextRound: nextRoundNumber,
        movies: nextRoundMovies,
      })
    } catch (error) {
      console.error('Error refining round:', error)
      return NextResponse.json({
        consensus: false,
        needsNextRound: true,
        currentRound: session.current_round,
        error: 'Failed to generate next round',
      })
    }
  } catch (error) {
    console.error('Error checking next round:', error)
    return NextResponse.json(
      { error: 'Failed to check next round' },
      { status: 500 }
    )
  }
}
