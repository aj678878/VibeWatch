import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'
import WatchlistClient from './WatchlistClient'

export default async function WatchlistPage({
  params,
}: {
  params: { groupId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current participant (member or guest)
  const currentParticipant = await getCurrentParticipant(params.groupId)
  if (!currentParticipant) {
    // Not a participant, redirect to groups list
    redirect('/groups')
  }

  // Get group details with participants
  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    include: {
      participants: {
        where: { status: 'active' },
        orderBy: { created_at: 'asc' },
      },
      watchlists: {
        orderBy: { id: 'desc' },
      },
    },
  })

  if (!group) {
    redirect('/groups')
  }

  // Get active session
  const activeSession = await prisma.decisionSession.findFirst({
    where: {
      group_id: params.groupId,
      status: 'active',
    },
    orderBy: { created_at: 'desc' },
    include: {
      rounds: {
        orderBy: { round_number: 'desc' },
        take: 1, // Get only the current round
        include: {
          votes: true,
        },
      },
    },
  })

  // Get participant completion status for active session
  let participantsWithStatus: Array<{
    id: string
    type: 'member' | 'guest'
    displayName: string
    hasCompleted: boolean
  }> = group.participants.map((p) => ({
    id: p.id,
    type: p.type as 'member' | 'guest', // Type assertion for literal union
    displayName: p.preferred_name || (p.type === 'member' ? 'Member' : 'Guest'),
    hasCompleted: false, // Will be calculated if session exists
  }))

  if (activeSession && activeSession.rounds.length > 0) {
    const currentRound = activeSession.rounds[0]
    const movieIds = currentRound.movie_tmdb_ids as number[]
    const allVotes = currentRound.votes

    participantsWithStatus = group.participants.map((p) => {
      const participantVotes = allVotes.filter((v) => v.participant_id === p.id)
      const hasCompleted = movieIds.every((tmdbId) =>
        participantVotes.some((vote) => vote.movie_tmdb_id === tmdbId)
      )

      return {
        id: p.id,
        type: p.type as 'member' | 'guest', // Type assertion for literal union
        displayName: p.preferred_name || (p.type === 'member' ? 'Member' : 'Guest'),
        hasCompleted,
      }
    })
  }

  // Check if current user is host
  const isHost = group.created_by_user_id === user?.id

  return (
    <WatchlistClient
      group={{
        id: group.id,
        invite_code: group.invite_code,
        created_by_user_id: group.created_by_user_id,
        participants: participantsWithStatus,
      }}
      watchlist={group.watchlists}
      activeSession={activeSession}
      isHost={isHost}
    />
  )
}
