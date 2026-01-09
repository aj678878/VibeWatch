import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'
import { selectNextRoundMovies } from '@/lib/ai/movie-selector'
import { getSoloRecommendation, getGroupRecommendations } from '@/lib/ai-provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roundId, movieTmdbId, vote, reasonText } = body

    console.log('[VOTE] Received vote submission:', { roundId, movieTmdbId, vote, hasReason: !!reasonText })

    if (!roundId || !movieTmdbId || !vote) {
      console.error('[VOTE] Missing required fields:', { roundId: !!roundId, movieTmdbId: !!movieTmdbId, vote: !!vote })
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
      console.error('[VOTE] Round not found:', roundId)
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    console.log('[VOTE] Round found, session status:', round.session.status)

    // Check if session is still active
    if (round.session.status !== 'active') {
      console.error('[VOTE] Session is not active:', round.session.status)
      return NextResponse.json(
        { error: `Session is not active (status: ${round.session.status})` },
        { status: 400 }
      )
    }

    // Get current participant (member or guest)
    const participant = await getCurrentParticipant(round.session.group_id)
    if (!participant) {
      console.error('[VOTE] Participant not found for group:', round.session.group_id)
      return NextResponse.json(
        { error: 'Not a participant in this group' },
        { status: 403 }
      )
    }

    console.log('[VOTE] Participant found:', { id: participant.id, type: participant.type })

    // Verify movie is in this round
    const movieIds = round.movie_tmdb_ids as number[]
    if (!movieIds || !Array.isArray(movieIds)) {
      console.error('[VOTE] Invalid movieIds in round:', movieIds)
      return NextResponse.json(
        { error: 'Round has invalid movie list' },
        { status: 500 }
      )
    }

    if (!movieIds.includes(movieTmdbId)) {
      console.error('[VOTE] Movie not in round:', { movieTmdbId, roundMovieIds: movieIds })
      return NextResponse.json(
        { error: `Movie ${movieTmdbId} not in this round` },
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
      console.log(`[VOTE] Updated vote for participant ${participant.id}, movie ${movieTmdbId}, vote: ${vote}`)
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
      console.log(`[VOTE] Created vote for participant ${participant.id}, movie ${movieTmdbId}, vote: ${vote}`)
    }

    // Re-fetch active participants and votes to ensure we have fresh data
    const freshRound = await prisma.votingRound.findUnique({
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
      },
    })

    if (!freshRound) {
      return NextResponse.json({ error: 'Round not found after vote' }, { status: 404 })
    }

    // Check if round is complete (all active participants have voted on all 5 movies)
    const activeParticipants = freshRound.session.group.participants
    const roundVotes = await prisma.vote.findMany({
      where: { round_id: roundId },
    })

    console.log(`[VOTE] Checking round completion: ${activeParticipants.length} active participants, ${roundVotes.length} total votes, ${movieIds.length} movies per round`)

    // Debug: log each participant's vote status
    activeParticipants.forEach((p) => {
      const participantVotes = roundVotes.filter((v) => v.participant_id === p.id)
      console.log(`[VOTE] Participant ${p.id} (${p.type}): ${participantVotes.length}/${movieIds.length} votes`)
    })

    const roundComplete = activeParticipants.every((p) => {
      const participantVotes = roundVotes.filter((v) => v.participant_id === p.id)
      const hasAllVotes = participantVotes.length === movieIds.length
      if (!hasAllVotes) {
        console.log(`[VOTE] Participant ${p.id} missing votes: has ${participantVotes.length}, needs ${movieIds.length}`)
      }
      return hasAllVotes
    })

    console.log(`[VOTE] Round complete: ${roundComplete}`)

    if (!roundComplete) {
      // Round not complete yet, just return success
      return NextResponse.json({ success: true, roundComplete: false })
    }

    // Re-fetch session to check if it was completed by another concurrent request (idempotency)
    const currentSession = await prisma.decisionSession.findUnique({
      where: { id: freshRound.session_id },
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
      // Define currentRoundVotes outside try block so it's available in catch
      const currentRoundVotes = roundVotes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote as 'yes' | 'no',
        reason_text: v.reason_text,
      }))
      
      try {
        console.log('=== SOLO MODE: Round complete, calling Groq ===')

        // Get all shown movie IDs to avoid recommending them
        const allRounds = await prisma.votingRound.findMany({
          where: { session_id: freshRound.session_id },
        })
        const shownMovieIds = allRounds.flatMap(
          (r) => r.movie_tmdb_ids as number[]
        )

        console.log('Current round votes:', currentRoundVotes)
        console.log('Shown movie IDs:', shownMovieIds)

        // Get AI recommendation based on solo user's votes
        const recommendation = await getSoloRecommendation(
          freshRound.session.vibe_text,
          currentRoundVotes,
          shownMovieIds
        )

        console.log('Groq recommendation:', recommendation)

        // Update session with final movie
        await prisma.decisionSession.update({
          where: { id: freshRound.session_id },
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
              group_id: freshRound.session.group_id,
              tmdb_id: recommendation.tmdb_id,
            },
          },
          update: {},
          create: {
            group_id: freshRound.session.group_id,
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
        console.error('[VOTE] Error in solo mode Groq recommendation:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        // Log full error details
        console.error('[VOTE] Error details:', {
          errorMessage,
          errorStack,
          errorName: error instanceof Error ? error.constructor.name : typeof error,
          sessionId: freshRound.session_id,
          vibeText: freshRound.session.vibe_text,
          votesCount: currentRoundVotes.length,
        })
        
        // Check if it's a model error
        if (errorMessage.includes('model') || errorMessage.includes('decommissioned')) {
          console.error('[VOTE] Model error detected - check Groq model name')
        }
        
        // Check if it's an API key error
        if (errorMessage.includes('API key') || errorMessage.includes('GROQ_API_KEY')) {
          console.error('[VOTE] API key error - check GROQ_API_KEY is set')
        }
        
        // Return detailed error for debugging
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to generate recommendation. Please try again.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            // Include error type for client-side handling
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
          },
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
        where: { id: freshRound.session_id },
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
            group_id: freshRound.session.group_id,
            tmdb_id: finalMovieId,
          },
        },
        update: {},
        create: {
          group_id: freshRound.session.group_id,
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
    if (freshRound.session.current_round >= 5) {
      // Call Groq final resolution
      try {
        const allRounds = await prisma.votingRound.findMany({
          where: { session_id: freshRound.session_id },
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
            where: { group_id: freshRound.session.group_id },
            select: { tmdb_id: true },
          })
        ).map((w) => w.tmdb_id)

        const recommendation = await getGroupRecommendations(
          freshRound.session.vibe_text,
          allVotes,
          roundHistory,
          watchlistTmdbIds
        )

        await prisma.decisionSession.update({
          where: { id: freshRound.session_id },
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
              group_id: freshRound.session.group_id,
              tmdb_id: recommendation.topPick.tmdb_id,
            },
          },
          update: {},
          create: {
            group_id: freshRound.session.group_id,
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
        console.error('[VOTE] Error in Groq final resolution:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        console.error('[VOTE] Error details:', { errorMessage, errorStack })
        
        // Return error but don't mark as success
        return NextResponse.json({
          success: false,
          roundComplete: true,
          consensus: false,
          maxRoundsReached: true,
          error: 'Failed to generate final resolution',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 })
      }
    }

    // Need to create next round
    try {
      const allRounds = await prisma.votingRound.findMany({
        where: { session_id: freshRound.session_id },
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
          where: { group_id: freshRound.session.group_id },
          select: { tmdb_id: true },
        })
      ).map((w) => w.tmdb_id)

      const nextRoundMovies = await selectNextRoundMovies(
        freshRound.session.vibe_text,
        currentRoundVotes,
        roundHistory,
        watchlistTmdbIds
      )

      const nextRoundNumber = freshRound.session.current_round + 1
      console.log(`[VOTE] Creating next round ${nextRoundNumber} with ${nextRoundMovies.length} movies`)
      await prisma.votingRound.create({
        data: {
          session_id: freshRound.session_id,
          round_number: nextRoundNumber,
          movie_tmdb_ids: nextRoundMovies,
        },
      })

      await prisma.decisionSession.update({
        where: { id: freshRound.session_id },
        data: {
          current_round: nextRoundNumber,
        },
      })
      console.log(`[VOTE] Next round ${nextRoundNumber} created and session updated`)

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
    console.error('[VOTE] Error submitting vote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to submit vote: ${errorMessage}` },
      { status: 500 }
    )
  }
}
