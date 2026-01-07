import { NextRequest, NextResponse } from 'next/server'
import { getMovieDetails } from '@/lib/tmdb'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tmdbId = parseInt(params.id)

    if (isNaN(tmdbId)) {
      return NextResponse.json(
        { error: 'Invalid movie ID' },
        { status: 400 }
      )
    }

    const movie = await getMovieDetails(tmdbId)
    return NextResponse.json(movie)
  } catch (error: any) {
    console.error('Error fetching movie details:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch movie details' },
      { status: 500 }
    )
  }
}
