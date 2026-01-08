import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'
import { selectNextRoundMovies } from '@/lib/ai/movie-selector'
import { recommendMovies, recommendMovieForSoloUser } from '@/lib/groq'

export async function POST(request: NextRequest) {
  try {
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

    // Get round with session and group info
    const round = await prisma.votingRound.findUnique({
      where: { id: roundId },
      include: {
        session: {
          include: {
            group: {
              include: {
                participants: {
                  where: { status: 'active' },
                },
              },
            },
          },
        },
        votes: true,
      },
    })

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Check if session is still active
    if (round.session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      )
    }

    // Get current participant (member or guest)
    const participant = await getCurrentParticipant(round.session.group_id)
    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant in this group' },
        { status: 403 }
      )
    }

    // Verify movie is in this round
    const movieIds = round.movie_tmdb_ids as number[]
    if (!movieIds.includes(movieTmdbId)) {
      return NextResponse.json(
        { error: 'Movie not in this round' },
        { status: 400 }
      )
    }

    // Upsert vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        round_id_participant_id_movie_tmdb_id: {
          round_id: roundId,
          participant_id: participant.id,
          movie_tmdb_id: movieTmdbId,
        },
      },
    })

    if (existingVote) {
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: {
          vote,
          reason_text: reasonText || null,
        },
      })
    } else {
      await prisma.vote.create({
        data: {
          round_id: roundId,
          participant_id: participant.id,
          movie_tmdb_id: movieTmdbId,
          vote,
          reason_text: reasonText || null,
        },
      })
    }

    // Check if round is complete (all active participants have voted on all 5 movies)
    const activeParticipants = round.session.group.participants
    const roundVotes = await prisma.vote.findMany({
      where: { round_id: roundId },
    })

    const roundComplete = activeParticipants.every((p) => {
      const participantVotes = roundVotes.filter((v) => v.participant_id === p.id)
      return participantVotes.length === movieIds.length
    })

    if (!roundComplete) {
      // Round not complete yet, just return success
      return NextResponse.json({ success: true, roundComplete: false })
    }

    // Re-fetch session to check if it was completed by another concurrent request (idempotency)
    const currentSession = await prisma.decisionSession.findUnique({
      where: { id: round.session_id },
      select: { status: true, final_movie_tmdb_id: true },
    })

    if (currentSession?.status === 'completed') {
      return NextResponse.json({
        success: true,
        roundComplete: true,
        sessionCompleted: true,
        finalMovieTmdbId: currentSession.final_movie_tmdb_id,
      })
    }

    // SOLO MODE: If only 1 participant, use Groq to recommend a NEW movie
    const totalParticipants = activeParticipants.length
    if (totalParticipants === 1) {
      try {
        console.log('=== SOLO MODE: Round complete, calling Groq ===')
        const currentRoundVotes = roundVotes.map((v) => ({
          movie_tmdb_id: v.movie_tmdb_id,
          vote: v.vote as 'yes' | 'no',
          reason_text: v.reason_text,
        }))

        // Get all shown movie IDs to avoid recommending them
        const allRounds = await prisma.votingRound.findMany({
          where: { session_id: round.session_id },
        })
        const shownMovieIds = allRounds.flatMap(
          (r) => r.movie_tmdb_ids as number[]
        )

        console.log('Current round votes:', currentRoundVotes)
        console.log('Shown movie IDs:', shownMovieIds)

        // Get AI recommendation based on solo user's votes
        const recommendation = await recommendMovieForSoloUser(
          round.session.vibe_text,
          currentRoundVotes,
          shownMovieIds
        )

        console.log('Groq recommendation:', recommendation)

        // Update session with final movie
        await prisma.decisionSession.update({
          where: { id: round.session_id },
          data: {
            status: 'completed',
            final_movie_tmdb_id: recommendation.tmdb_id,
            picked_by: 'ai',
          },
        })

        // Add chosen movie to group watchlist
        await prisma.groupWatchlist.upsert({
          where: {
            group_id_tmdb_id: {
              group_id: round.session.group_id,
              tmdb_id: recommendation.tmdb_id,
            },
          },
          update: {},
          create: {
            group_id: round.session.group_id,
            tmdb_id: recommendation.tmdb_id,
          },
        })

        return NextResponse.json({
          success: true,
          roundComplete: true,
          consensus: true, // Keep UI ambiguous
          finalMovieTmdbId: recommendation.tmdb_id,
          soloMode: true,
        })
      } catch (error) {
        console.error('Error in solo mode Groq recommendation:', error)
        // Don't fallback to first movie - throw error instead
        return NextResponse.json(
          { error: 'Failed to generate recommendation. Please try again.' },
          { status: 500 }
        )
      }
    }

    // MULTI-USER MODE: Check for consensus
    // Consensus rule:
    // - For odd number of members: YES > NO (majority)
    // - For even number of members: YES > NO (strict majority, tie = no consensus)
    // - NO votes must be 0 for consensus
    const consensusMovies: Array<{ movieId: number; yesCount: number }> = []
    
    for (const movieId of movieIds) {
      const movieVotes = roundVotes.filter((v) => v.movie_tmdb_id === movieId)
      const yesCount = movieVotes.filter((v) => v.vote === 'yes').length
      const noCount = movieVotes.filter((v) => v.vote === 'no').length

      // Check if this movie has consensus
      // For even number: YES must be > NO (strict majority, tie = no consensus)
      // For odd number: YES must be > NO (majority)
      const hasConsensus = noCount === 0 && yesCount > (totalParticipants - yesCount)

      if (hasConsensus) {
        consensusMovies.push({ movieId, yesCount })
      }
    }

    if (consensusMovies.length > 0) {
      // Consensus reached - select most popular (highest YES count)
      // Sort by YES count descending, then take the first one
      consensusMovies.sort((a, b) => b.yesCount - a.yesCount)
      const finalMovieId = consensusMovies[0].movieId

      await prisma.decisionSession.update({
        where: { id: round.session_id },
        data: {
          status: 'completed',
          final_movie_tmdb_id: finalMovieId,
          picked_by: 'consensus',
        },
      })

      // Add to watchlist
      await prisma.groupWatchlist.upsert({
        where: {
          group_id_tmdb_id: {
            group_id: round.session.group_id,
            tmdb_id: finalMovieId,
          },
        },
        update: {},
        create: {
          group_id: round.session.group_id,
          tmdb_id: finalMovieId,
        },
      })

      return NextResponse.json({
        success: true,
        roundComplete: true,
        consensus: true,
        finalMovieTmdbId: finalMovieId,
      })
    }

    // No consensus - check if we've reached max rounds
    if (round.session.current_round >= 5) {
      // Call Groq final resolution
      try {
        const allRounds = await prisma.votingRound.findMany({
          where: { session_id: round.session_id },
          include: { votes: true },
          orderBy: { round_number: 'asc' },
        })

        const allVotes = allRounds.flatMap((r) =>
          r.votes.map((v) => ({
            movie_tmdb_id: v.movie_tmdb_id,
            vote: v.vote as 'yes' | 'no',
            reason_text: v.reason_text,
          }))
        )

        const roundHistory = allRounds.map((r) => ({
          round_number: r.round_number,
          movie_tmdb_ids: r.movie_tmdb_ids as number[],
        }))

        const watchlistTmdbIds = (
          await prisma.groupWatchlist.findMany({
            where: { group_id: round.session.group_id },
            select: { tmdb_id: true },
          })
        ).map((w) => w.tmdb_id)

        const recommendation = await recommendMovies(
          round.session.vibe_text,
          allVotes,
          roundHistory,
          watchlistTmdbIds
        )

        await prisma.decisionSession.update({
          where: { id: round.session_id },
          data: {
            status: 'completed',
            final_movie_tmdb_id: recommendation.topPick.tmdb_id,
            picked_by: 'ai',
            alternates_json: recommendation.alternates as any, // Prisma JSON field requires type cast
          },
        })

        // Add to watchlist
        await prisma.groupWatchlist.upsert({
          where: {
            group_id_tmdb_id: {
              group_id: round.session.group_id,
              tmdb_id: recommendation.topPick.tmdb_id,
            },
          },
          update: {},
          create: {
            group_id: round.session.group_id,
            tmdb_id: recommendation.topPick.tmdb_id,
          },
        })

        return NextResponse.json({
          success: true,
          roundComplete: true,
          consensus: false,
          maxRoundsReached: true,
          finalMovieTmdbId: recommendation.topPick.tmdb_id,
        })
      } catch (error) {
        console.error('Error in Groq final resolution:', error)
        return NextResponse.json({
          success: true,
          roundComplete: true,
          consensus: false,
          maxRoundsReached: true,
          error: 'Failed to generate final resolution',
        })
      }
    }

    // Need to create next round
    try {
      const allRounds = await prisma.votingRound.findMany({
        where: { session_id: round.session_id },
        include: { votes: true },
        orderBy: { round_number: 'asc' },
      })

      const currentRoundVotes = roundVotes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote as 'yes' | 'no',
        reason_text: v.reason_text,
      }))

      const roundHistory = allRounds.map((r) => ({
        round_number: r.round_number,
        movie_tmdb_ids: r.movie_tmdb_ids as number[],
        votes: r.votes.map((v) => ({
          movie_tmdb_id: v.movie_tmdb_id,
          vote: v.vote as 'yes' | 'no',
          reason_text: v.reason_text,
        })),
      }))

      const watchlistTmdbIds = (
        await prisma.groupWatchlist.findMany({
          where: { group_id: round.session.group_id },
          select: { tmdb_id: true },
        })
      ).map((w) => w.tmdb_id)

      const nextRoundMovies = await selectNextRoundMovies(
        round.session.vibe_text,
        currentRoundVotes,
        roundHistory,
        watchlistTmdbIds
      )

      const nextRoundNumber = round.session.current_round + 1
      await prisma.votingRound.create({
        data: {
          session_id: round.session_id,
          round_number: nextRoundNumber,
          movie_tmdb_ids: nextRoundMovies,
        },
      })

      await prisma.decisionSession.update({
        where: { id: round.session_id },
        data: {
          current_round: nextRoundNumber,
        },
      })

      return NextResponse.json({
        success: true,
        roundComplete: true,
        consensus: false,
        nextRound: nextRoundNumber,
        nextRoundMovies,
      })
    } catch (error) {
      console.error('Error creating next round:', error)
      return NextResponse.json({
        success: true,
        roundComplete: true,
        consensus: false,
        error: 'Failed to create next round',
      })
    }
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
}
