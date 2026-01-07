import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId } = params

    // Verify user is a member of the group
    const member = await prisma.groupMember.findUnique({
      where: {
        user_id_group_id: {
          user_id: user.id,
          group_id: groupId,
        },
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
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
