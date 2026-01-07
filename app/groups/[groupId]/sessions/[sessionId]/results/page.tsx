import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import ResultsClient from './ResultsClient'

export default async function ResultsPage({
  params,
}: {
  params: { groupId: string; sessionId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get session
  const session = await prisma.decisionSession.findUnique({
    where: { id: params.sessionId },
    include: {
      group: {
        include: {
          members: true,
        },
      },
    },
  })

  if (!session) {
    redirect(`/groups/${params.groupId}/watchlist`)
  }

  // Verify user is a member
  const isMember = session.group.members.some(
    (member) => member.user_id === user.id
  )

  if (!isMember) {
    redirect('/groups')
  }

  // If session is not completed, check if we need to trigger final resolution
  if (session.status === 'active' && session.current_round >= 5) {
    // Check if all members have voted on round 5
    const round5 = await prisma.votingRound.findUnique({
      where: {
        session_id_round_number: {
          session_id: params.sessionId,
          round_number: 5,
        },
      },
      include: {
        votes: true,
      },
    })

    if (round5) {
      const memberIds = session.group.members.map((m) => user.id)
      const movieIds = round5.movie_tmdb_ids as number[]
      const allVoted = memberIds.every((memberId) =>
        movieIds.every((tmdbId) =>
          round5.votes.some(
            (v) => v.user_id === memberId && v.movie_tmdb_id === tmdbId
          )
        )
      )

      if (allVoted) {
        // Trigger final resolution (this will be done client-side)
        // For now, just show loading state
      }
    }
  }

  if (session.status !== 'completed' || !session.final_movie_tmdb_id) {
    // Still processing or no final movie yet
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <h1 className="text-3xl font-light mb-4">Processing...</h1>
            <p className="text-gray-400">
              Determining the final recommendation...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Get round history for alternates (we'll need to reconstruct from rounds)
  const rounds = await prisma.votingRound.findMany({
    where: { session_id: params.sessionId },
    orderBy: { round_number: 'asc' },
  })

  // For MVP, we'll just show the final movie
  // Alternates would need to be stored separately or reconstructed
  return (
    <ResultsClient
      sessionId={params.sessionId}
      finalMovieTmdbId={session.final_movie_tmdb_id}
      vibeText={session.vibe_text}
    />
  )
}
