import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'
import VotingRoundClient from './VotingRoundClient'

export default async function VotingRoundPage({
  params,
}: {
  params: { groupId: string; sessionId: string; roundNumber: string }
}) {
  const roundNumber = parseInt(params.roundNumber)

  // Get current participant (member or guest)
  const currentParticipant = await getCurrentParticipant(params.groupId)
  if (!currentParticipant) {
    redirect('/groups')
  }

  // Get session and verify access
  const session = await prisma.decisionSession.findUnique({
    where: { id: params.sessionId },
    include: {
      group: {
        include: {
          participants: {
            where: { status: 'active' },
          },
        },
      },
    },
  })

  if (!session) {
    redirect(`/groups/${params.groupId}/watchlist`)
  }

  // Verify participant is in the group
  const isParticipant = session.group.participants.some(
    (p) => p.id === currentParticipant.id
  )

  if (!isParticipant) {
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
          participant_id: currentParticipant.id,
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
