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
  popularity: number
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
    popularity: number
    original_language: string
  }>
  total_pages: number
  total_results: number
}

/**
 * Search movies with filters:
 * - Only Hindi (hi) or English (en) movies
 * - Only movies released after 2000
 * - Sorted by popularity (desc)
 */
export async function searchMovies(query: string, page: number = 1): Promise<TMDBSearchResult> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const yearFrom = 2000
  const currentYear = new Date().getFullYear()
  
  let response
  
  if (query && query.trim()) {
    // Use search API first to find movies matching query
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}&language=en-US`
    response = await fetch(searchUrl)
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }
    
    const searchData = await response.json()
    
    // Filter results: Hindi/English only, after 2000, sort by popularity desc
    const filtered = searchData.results
      .filter((movie: any) => {
        const lang = movie.original_language || ''
        const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : 0
        return (lang === 'en' || lang === 'hi') && year >= yearFrom
      })
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    
    return {
      ...searchData,
      results: filtered,
    }
  } else {
    // No query - use discover API for popular movies
    // Note: TMDB discover API doesn't support multiple languages in one call
    // So we'll fetch English and Hindi separately, then combine and sort
    const [enResponse, hiResponse] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&primary_release_date.gte=${yearFrom}-01-01&primary_release_date.lte=${currentYear}-12-31&with_original_language=en&page=${page}`),
      fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&primary_release_date.gte=${yearFrom}-01-01&primary_release_date.lte=${currentYear}-12-31&with_original_language=hi&page=${page}`)
    ])
    
    if (!enResponse.ok || !hiResponse.ok) {
      throw new Error(`TMDB API error`)
    }
    
    const [enData, hiData] = await Promise.all([enResponse.json(), hiResponse.json()])
    
    // Combine and sort by popularity
    const combined = [...enData.results, ...hiData.results]
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    
    return {
      ...enData,
      results: combined,
    }
  }
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
