import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentParticipant } from '@/lib/participant'

export async function GET(
  request: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params

    // Verify user is a participant in the group
    const participant = await getCurrentParticipant(groupId)
    if (!participant) {
      return NextResponse.json({ error: 'Not a participant in this group' }, { status: 403 })
    }

    // Get watchlist items
    const watchlist = await prisma.groupWatchlist.findMany({
      where: { group_id: groupId },
      orderBy: { id: 'desc' },
    })

    return NextResponse.json({ watchlist })
  } catch (error) {
    console.error('Error fetching watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    )
  }
}
