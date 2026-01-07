import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupId, vibeText } = await request.json()

    if (!groupId || !vibeText) {
      return NextResponse.json(
        { error: 'groupId and vibeText are required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      )
    }

    // Check for existing active session
    const existingSession = await prisma.decisionSession.findFirst({
      where: {
        group_id: groupId,
        status: 'active',
      },
    })

    if (existingSession) {
      return NextResponse.json(
        { error: 'An active session already exists' },
        { status: 400 }
      )
    }

    // Get watchlist movies
    const watchlist = await prisma.groupWatchlist.findMany({
      where: { group_id: groupId },
    })

    if (watchlist.length < 5) {
      return NextResponse.json(
        { error: 'Watchlist must have at least 5 movies' },
        { status: 400 }
      )
    }

    // Select 5 random movies for first round
    const shuffled = [...watchlist].sort(() => 0.5 - Math.random())
    const firstRoundMovies = shuffled.slice(0, 5).map((item) => item.tmdb_id)

    // Create session
    const session = await prisma.decisionSession.create({
      data: {
        group_id: groupId,
        vibe_text: vibeText,
        status: 'active',
        current_round: 1,
        rounds: {
          create: {
            round_number: 1,
            movie_tmdb_ids: firstRoundMovies,
          },
        },
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
