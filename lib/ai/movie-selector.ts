import { searchMovies, searchMoviesWithFilters, getMovieDetails, type TMDBMovie } from '@/lib/tmdb'
import { extractPreferences, type PreferenceConstraints } from '@/lib/groq'
import { getTMDBSearchFilters } from '@/lib/gemini'

/**
 * Select initial round movies based on vibe text.
 * Uses TMDB search with filters (Hindi/English, after 2000, sorted by popularity).
 * Does NOT depend on watchlist.
 */
export async function selectInitialRoundMovies(vibeText: string): Promise<number[]> {
  try {
    console.log('=== MOVIE SELECTION DEBUG ===')
    console.log('Vibe text:', vibeText)
    
    // Step 1: Pass vibe to Gemini to get exact search filters
    console.log('Step 1: Getting TMDB search filters from Gemini...')
    const filters = await getTMDBSearchFilters(vibeText)
    
    console.log('Gemini returned filters:', JSON.stringify(filters, null, 2))
    console.log('Search parameters:')
    console.log('  - Query:', filters.query || 'N/A')
    console.log('  - Genres:', filters.genres?.join(', ') || 'N/A')
    console.log('  - Year range:', `${filters.year_min || 2001}-${filters.year_max || new Date().getFullYear()}`)
    console.log('  - Languages: Hindi (hi) or English (en)')
    console.log('  - Sort: Popularity (desc)')
    console.log('  - Limit: Top 5')
    
    // Step 2: Search TMDB based on filters
    console.log('Step 2: Searching TMDB with filters...')
    const searchResults = await searchMoviesWithFilters(filters)
    
    console.log('TMDB Search Results:')
    console.log('  - Total results:', searchResults.total_results)
    console.log('  - Results returned:', searchResults.results.length)
    console.log('  - Top 5 movies:')
    searchResults.results.slice(0, 5).forEach((movie, idx) => {
      console.log(`    ${idx + 1}. [${movie.id}] ${movie.title} (${movie.release_date?.split('-')[0] || 'N/A'}) - Lang: ${movie.original_language}, Popularity: ${movie.popularity?.toFixed(2) || 'N/A'}`)
    })
    
    // Step 3: Get first 5 movie IDs (already sorted by popularity)
    const movieIds = searchResults.results
      .slice(0, 5)
      .map((movie) => movie.id)
      .filter((id) => !isNaN(id) && id > 0) // Validate IDs are valid numbers

    if (movieIds.length < 5) {
      console.warn(`Only found ${movieIds.length} movies matching filters for vibe: ${vibeText}`)
      
      // Try searching for popular movies as fallback
      const popularResults = await searchMovies('', 1) // Empty query = discover popular
      const popularIds = popularResults.results
        .map((movie) => movie.id)
        .filter((id) => !isNaN(id) && id > 0 && !movieIds.includes(id))
        .slice(0, 5 - movieIds.length)
      
      movieIds.push(...popularIds)
      console.log('Filled with popular movies:', popularIds)
    }

    console.log('Final selected movie IDs:', movieIds)
    console.log('=== END MOVIE SELECTION DEBUG ===\n')

    // Ensure we return exactly 5 movies (or as many as possible)
    return movieIds.slice(0, 5)
  } catch (error) {
    console.error('Error selecting initial round movies:', error)
    // Fallback: return empty array (will be caught by validation in API route)
    throw new Error(`Failed to find movies for vibe: ${vibeText}`)
  }
}

export async function selectNextRoundMovies(
  vibeText: string,
  currentRoundVotes: Array<{
    movie_tmdb_id: number
    vote: 'yes' | 'no'
    reason_text?: string | null
  }>,
  roundHistory: Array<{
    round_number: number
    movie_tmdb_ids: number[]
    votes: Array<{
      movie_tmdb_id: number
      vote: 'yes' | 'no'
      reason_text?: string | null
    }>
  }>,
  watchlistTmdbIds: number[]
): Promise<number[]> {
  // Extract preferences using AI
  const constraints = await extractPreferences(
    vibeText,
    currentRoundVotes,
    roundHistory
  )

  // Get all previously shown movies to avoid duplicates
  const shownMovies = new Set(
    roundHistory.flatMap((r) => r.movie_tmdb_ids as number[])
  )

  // Start with watchlist movies that haven't been shown
  const availableFromWatchlist = watchlistTmdbIds.filter(
    (id) => !shownMovies.has(id)
  )

  // If we have enough from watchlist, use those
  if (availableFromWatchlist.length >= 5) {
    // Shuffle and take 5
    const shuffled = [...availableFromWatchlist].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 5)
  }

  // Otherwise, try to find movies matching constraints from TMDB
  // For MVP, we'll use a simple approach: search by genre if available
  const selectedMovies: number[] = [...availableFromWatchlist]

  // If we need more movies, search TMDB
  if (selectedMovies.length < 5 && constraints.genres && constraints.genres.length > 0) {
    try {
      // Search for movies by first genre
      const searchResults = await searchMovies(constraints.genres[0], 1)
      const candidates = searchResults.results
        .map((m) => m.id)
        .filter((id) => !shownMovies.has(id) && !selectedMovies.includes(id))
        .slice(0, 5 - selectedMovies.length)

      selectedMovies.push(...candidates)
    } catch (error) {
      console.error('Error searching TMDB for next round:', error)
    }
  }

  // If still not enough, fill with random watchlist movies (even if shown before)
  if (selectedMovies.length < 5) {
    const remaining = watchlistTmdbIds
      .filter((id) => !selectedMovies.includes(id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 5 - selectedMovies.length)
    selectedMovies.push(...remaining)
  }

  // Return exactly 5 movies
  return selectedMovies.slice(0, 5)
}
