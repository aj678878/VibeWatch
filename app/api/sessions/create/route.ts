import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { selectInitialRoundMovies } from '@/lib/ai/movie-selector'

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

    // Select initial round movies based on vibe_text (NOT watchlist)
    // This uses TMDB search to find 5 candidate movies matching the vibe
    const firstRoundMovies = await selectInitialRoundMovies(vibeText)

    // Validate we got 5 valid movie IDs
    if (!Array.isArray(firstRoundMovies) || firstRoundMovies.length !== 5) {
      return NextResponse.json(
        { error: 'Failed to find 5 movies matching your vibe. Please try a different description.' },
        { status: 500 }
      )
    }

    // Ensure all IDs are valid numbers
    const validMovieIds = firstRoundMovies.filter((id) => 
      typeof id === 'number' && !isNaN(id) && id > 0
    )

    if (validMovieIds.length !== 5) {
      return NextResponse.json(
        { error: 'Invalid movie IDs generated. Please try again.' },
        { status: 500 }
      )
    }

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
            movie_tmdb_ids: validMovieIds, // Store as JSON array of numbers
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
