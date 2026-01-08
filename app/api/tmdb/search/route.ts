import { NextRequest, NextResponse } from 'next/server'
import { searchMovies } from '@/lib/tmdb'

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const results = await searchMovies(query, page)
    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error searching TMDB:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search movies' },
      { status: 500 }
    )
  }
}
