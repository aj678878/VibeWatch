import { searchMovies, getMovieDetails, type TMDBMovie } from '@/lib/tmdb'
import { extractPreferences, type PreferenceConstraints } from '@/lib/groq'

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
