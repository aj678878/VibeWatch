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

/**
 * TMDB Genre ID mapping (name to ID)
 */
const TMDB_GENRE_IDS: Record<string, number> = {
  'Action': 28,
  'Adventure': 12,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 14,
  'History': 36,
  'Horror': 27,
  'Music': 10402,
  'Mystery': 9648,
  'Romance': 10749,
  'Science Fiction': 878,
  'TV Movie': 10770,
  'Thriller': 53,
  'War': 10752,
  'Western': 37,
}

/**
 * Get genre IDs from genre names
 */
function getGenreIds(genreNames: string[]): number[] {
  return genreNames
    .map(name => TMDB_GENRE_IDS[name])
    .filter((id): id is number => id !== undefined)
}

/**
 * Search TMDB with filters (genres, year range, etc.)
 * Returns movies sorted by popularity (desc)
 */
export async function searchMoviesWithFilters(filters: {
  genres?: string[]
  year_min?: number
  year_max?: number
  query?: string
  keywords?: string[]
}): Promise<TMDBSearchResult> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const yearFrom = filters.year_min || 2001
  const yearTo = filters.year_max || new Date().getFullYear()

  console.log('[TMDB] Searching with filters:', {
    query: filters.query,
    genres: filters.genres,
    yearRange: `${yearFrom}-${yearTo}`,
  })

  // Convert genre names to IDs
  const genreIds = filters.genres && filters.genres.length > 0 ? getGenreIds(filters.genres) : []
  
  // Build base params for discover API
  const baseParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'en-US',
    sort_by: 'popularity.desc',
    'primary_release_date.gte': `${yearFrom}-01-01`,
    'primary_release_date.lte': `${yearTo}-12-31`,
    page: '1',
  })

  // Add genre filter if available (this is the key to getting different results!)
  if (genreIds.length > 0) {
    baseParams.append('with_genres', genreIds.join(','))
    console.log('[TMDB] Using genre filter:', genreIds, '(', filters.genres?.join(', '), ')')
  }

  // If we have a query, try search API first (more specific for text queries)
  if (filters.query && filters.query.trim() && genreIds.length === 0) {
    console.log('[TMDB] Using search API with query:', filters.query)
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(filters.query)}&page=1&language=en-US`
    const searchResponse = await fetch(searchUrl)
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      
      // Filter results: Hindi/English only, year range, sort by popularity desc
      const filtered = searchData.results
        .filter((movie: any) => {
          const lang = movie.original_language || ''
          const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : 0
          return (lang === 'en' || lang === 'hi') && year >= yearFrom && year <= yearTo
        })
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
      
      if (filtered.length >= 5) {
        console.log('[TMDB] Found', filtered.length, 'movies from search query')
        return {
          ...searchData,
          results: filtered,
        }
      }
      console.log('[TMDB] Search query returned only', filtered.length, 'movies, falling back to discover API')
    }
  }

  // Use discover API with genre filters (this ensures different results based on vibe)
  console.log('[TMDB] Using discover API', genreIds.length > 0 ? `with genres: ${genreIds.join(',')}` : 'without genres')
  
  // Fetch English and Hindi movies separately (TMDB limitation)
  const [enResponse, hiResponse] = await Promise.all([
    fetch(`${TMDB_BASE_URL}/discover/movie?${baseParams.toString()}&with_original_language=en`),
    fetch(`${TMDB_BASE_URL}/discover/movie?${baseParams.toString()}&with_original_language=hi`)
  ])
  
  if (!enResponse.ok || !hiResponse.ok) {
    throw new Error(`TMDB API error: ${enResponse.statusText || hiResponse.statusText}`)
  }
  
  const [enData, hiData] = await Promise.all([enResponse.json(), hiResponse.json()])
  
  // Combine and sort by popularity
  const combined = [...enData.results, ...hiData.results]
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
  
  console.log('[TMDB] Discover API returned', combined.length, 'total movies (EN:', enData.results.length, 'HI:', hiData.results.length, ')')
  
  return {
    ...enData,
    results: combined,
  }
}
