const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_API_KEY = process.env.TMDB_API_KEY

export interface TMDBMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  runtime: number | null
  genres: Array<{ id: number; name: string }>
  original_language: string
}

export interface TMDBSearchResult {
  results: Array<{
    id: number
    title: string
    overview: string
    poster_path: string | null
    release_date: string
    vote_average: number
  }>
  total_pages: number
  total_results: number
}

export async function searchMovies(query: string, page: number = 1): Promise<TMDBSearchResult> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}&language=en-US`
  )

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`)
  }

  return response.json()
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovie> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
  )

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`)
  }

  return response.json()
}

export async function getMoviesByIds(tmdbIds: number[]): Promise<TMDBMovie[]> {
  // Fetch movie details for multiple IDs in parallel
  const promises = tmdbIds.map((id) => getMovieDetails(id))
  return Promise.all(promises)
}

export function getPosterUrl(posterPath: string | null, size: 'w200' | 'w300' | 'w500' = 'w500'): string | null {
  if (!posterPath) return null
  return `https://image.tmdb.org/t/p/${size}${posterPath}`
}

export function getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' = 'w1280'): string | null {
  if (!backdropPath) return null
  return `https://image.tmdb.org/t/p/${size}${backdropPath}`
}
