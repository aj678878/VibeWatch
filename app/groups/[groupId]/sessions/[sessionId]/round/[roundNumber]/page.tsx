import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import VotingRoundClient from './VotingRoundClient'

export default async function VotingRoundPage({
  params,
}: {
  params: { groupId: string; sessionId: string; roundNumber: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const roundNumber = parseInt(params.roundNumber)

  // Get session and verify access
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

  // Get current round
  const round = await prisma.votingRound.findUnique({
    where: {
      session_id_round_number: {
        session_id: params.sessionId,
        round_number: roundNumber,
      },
    },
    include: {
      votes: {
        where: {
          user_id: user.id,
        },
      },
    },
  })

  if (!round) {
    redirect(`/groups/${params.groupId}/watchlist`)
  }

  // If session is completed, redirect to results
  if (session.status === 'completed') {
    redirect(`/groups/${params.groupId}/sessions/${params.sessionId}/results`)
  }

  return (
    <VotingRoundClient
      sessionId={params.sessionId}
      roundNumber={roundNumber}
      movieTmdbIds={round.movie_tmdb_ids as number[]}
      userVotes={round.votes.map((v) => ({
        movie_tmdb_id: v.movie_tmdb_id,
        vote: v.vote as 'yes' | 'no',
        reason_text: v.reason_text,
      }))}
    />
  )
}
