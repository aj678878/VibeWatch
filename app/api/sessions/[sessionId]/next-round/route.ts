import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { selectNextRoundMovies } from '@/lib/ai/movie-selector'
import { recommendMovies, recommendMovieForSoloUser } from '@/lib/groq'

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
    const totalMembers = memberIds.length

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

    // SOLO MODE: Always use Groq to recommend based on all votes
    if (totalMembers === 1) {
      try {
        // Collect all votes from current round
        const currentRoundVotes = currentRound.votes.map((v) => ({
          movie_tmdb_id: v.movie_tmdb_id,
          vote: v.vote as 'yes' | 'no',
          reason_text: v.reason_text,
        }))

        // Get all shown movie IDs to avoid recommending them
        const shownMovieIds = session.rounds.flatMap(
          (r) => r.movie_tmdb_ids as number[]
        )

        // Get AI recommendation based on solo user's votes
        const recommendation = await recommendMovieForSoloUser(
          session.vibe_text,
          currentRoundVotes,
          shownMovieIds
        )

        // Update session with final movie
        await prisma.decisionSession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            final_movie_tmdb_id: recommendation.tmdb_id,
          },
        })

        // Add chosen movie to group watchlist
        const existing = await prisma.groupWatchlist.findUnique({
          where: {
            group_id_tmdb_id: {
              group_id: session.group_id,
              tmdb_id: recommendation.tmdb_id,
            },
          },
        })

        if (!existing) {
          await prisma.groupWatchlist.create({
            data: {
              group_id: session.group_id,
              tmdb_id: recommendation.tmdb_id,
            },
          })
        }

        return NextResponse.json({
          consensus: true, // Keep UI ambiguous
          final_movie_tmdb_id: recommendation.tmdb_id,
          soloMode: true,
        })
      } catch (error) {
        console.error('Error getting solo recommendation:', error)
        // Fallback: use first YES vote or first movie if no YES votes
        const yesVote = allVotes.find((v) => v.vote === 'yes')
        const fallbackMovieId = yesVote?.movie_tmdb_id || movieIds[0]

        await prisma.decisionSession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            final_movie_tmdb_id: fallbackMovieId,
          },
        })

        return NextResponse.json({
          consensus: true,
          final_movie_tmdb_id: fallbackMovieId,
          soloMode: true,
          fallback: true,
        })
      }
    }

    // MULTI-USER MODE: Check for consensus
    const requiredYesVotes = Math.ceil(totalMembers / 2) + (totalMembers % 2 === 0 ? 1 : 0)
    
    const yesVotesByMovie: Record<number, number> = {}
    movieIds.forEach((tmdbId) => {
      const yesVotes = allVotes.filter(
        (v) => v.movie_tmdb_id === tmdbId && v.vote === 'yes'
      )
      yesVotesByMovie[tmdbId] = yesVotes.length
    })

    // Find movies that meet consensus threshold
    const consensusMovies = Object.entries(yesVotesByMovie)
      .filter(([_, count]) => count >= requiredYesVotes)
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

      // Add chosen movie to group watchlist
      const existing = await prisma.groupWatchlist.findUnique({
        where: {
          group_id_tmdb_id: {
            group_id: session.group_id,
            tmdb_id: finalMovieTmdbId,
          },
        },
      })

      if (!existing) {
        await prisma.groupWatchlist.create({
          data: {
            group_id: session.group_id,
            tmdb_id: finalMovieTmdbId,
          },
        })
      }

      return NextResponse.json({
        consensus: true,
        final_movie_tmdb_id: finalMovieTmdbId,
      })
    }

    // No consensus - check if we've reached max rounds
    if (session.current_round >= 5) {
      // Trigger final AI resolution
      try {
        const allSessionVotes = session.rounds.flatMap((round) =>
          round.votes.map((v) => ({
            movie_tmdb_id: v.movie_tmdb_id,
            vote: v.vote as 'yes' | 'no',
            reason_text: v.reason_text,
          }))
        )

        const roundHistory = session.rounds.map((round) => ({
          round_number: round.round_number,
          movie_tmdb_ids: round.movie_tmdb_ids as number[],
        }))

        const watchlistTmdbIds = session.group.watchlists.map((w) => w.tmdb_id)

        const recommendation = await recommendMovies(
          session.vibe_text,
          allSessionVotes,
          roundHistory,
          watchlistTmdbIds
        )

        await prisma.decisionSession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            final_movie_tmdb_id: recommendation.topPick.tmdb_id,
          },
        })

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

      const watchlistTmdbIds = session.group.watchlists.map((w) => w.tmdb_id)

      const nextRoundMovies = await selectNextRoundMovies(
        session.vibe_text,
        currentRoundVotes,
        roundHistory,
        watchlistTmdbIds
      )

      const nextRoundNumber = session.current_round + 1
      await prisma.votingRound.create({
        data: {
          session_id: sessionId,
          round_number: nextRoundNumber,
          movie_tmdb_ids: nextRoundMovies,
        },
      })

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
