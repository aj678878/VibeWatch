import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: { groupId: string; tmdbId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId, tmdbId } = params
    const tmdbIdNum = parseInt(tmdbId)

    if (isNaN(tmdbIdNum)) {
      return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 })
    }

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

    // Check if already in watchlist
    const existing = await prisma.groupWatchlist.findUnique({
      where: {
        group_id_tmdb_id: {
          group_id: groupId,
          tmdb_id: tmdbIdNum,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ message: 'Movie already in watchlist' })
    }

    // Add to watchlist
    await prisma.groupWatchlist.create({
      data: {
        group_id: groupId,
        tmdb_id: tmdbIdNum,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding to watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to add to watchlist' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { groupId: string; tmdbId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId, tmdbId } = params
    const tmdbIdNum = parseInt(tmdbId)

    if (isNaN(tmdbIdNum)) {
      return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 })
    }

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

    // Remove from watchlist
    await prisma.groupWatchlist.deleteMany({
      where: {
        group_id: groupId,
        tmdb_id: tmdbIdNum,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    )
  }
}
