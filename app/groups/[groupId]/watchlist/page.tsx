import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import WatchlistClient from './WatchlistClient'

export default async function WatchlistPage({
  params,
}: {
  params: { groupId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify user is a member
  const member = await prisma.groupMember.findUnique({
    where: {
      user_id_group_id: {
        user_id: user.id,
        group_id: params.groupId,
      },
    },
  })

  if (!member) {
    redirect('/groups')
  }

  // Get group details
  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    include: {
      members: true,
      watchlists: {
        orderBy: { id: 'desc' },
      },
    },
  })

  if (!group) {
    redirect('/groups')
  }

  // Get active sessions
  const activeSession = await prisma.decisionSession.findFirst({
    where: {
      group_id: params.groupId,
      status: 'active',
    },
    orderBy: { created_at: 'desc' },
  })

  return (
    <WatchlistClient
      group={group}
      watchlist={group.watchlists}
      activeSession={activeSession}
    />
  )
}
