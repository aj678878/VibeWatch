/**
 * Google Gemini AI Provider
 * Free tier: https://aistudio.google.com/
 * Get API key: https://aistudio.google.com/app/apikey
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

export interface TMDBSearchFilters {
  genres?: string[] // Genre names (e.g., "Action", "Comedy")
  year_min?: number
  year_max?: number
  keywords?: string[] // Search keywords
  query?: string // Main search query
}

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY not set - Gemini provider will not work')
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

export interface MovieRecommendation {
  tmdb_id: number
  title: string
  reason: string
}

/**
 * Convert vibe text to TMDB search filters using Gemini
 */
export async function getTMDBSearchFilters(vibeText: string): Promise<TMDBSearchFilters> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const prompt = `Convert the user's movie vibe/mood description into TMDB (The Movie Database) search filters.

User's vibe: "${vibeText}"

Return ONLY a JSON object with these fields:
{
  "genres": ["Action", "Comedy"],  // Array of genre names (use TMDB genre names)
  "year_min": 2001,  // Minimum release year (must be >= 2001)
  "year_max": 2025,  // Maximum release year (current year or later)
  "keywords": ["keyword1", "keyword2"],  // Optional: relevant keywords for search
  "query": "main search query"  // Main search query string for TMDB
}

IMPORTANT:
- Only include Hindi (hi) or English (en) movies
- year_min must be >= 2001
- Use standard TMDB genre names (Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, TV Movie, Thriller, War, Western)
- If vibe is vague, use popular genres
- Return valid JSON only, no extra text`

  try {
    console.log('=== GEMINI: Getting TMDB Search Filters ===')
    console.log('Vibe text:', vibeText)

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
    console.log('Using Gemini model: gemini-3-flash-preview')

    const result = await model.generateContent(prompt)
    const response = await result.response
    const content = response.text()

    console.log('Gemini raw response:', content)

    if (!content) {
      throw new Error('No response content from Gemini API')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response')
    }

    const filters = JSON.parse(jsonMatch[0]) as TMDBSearchFilters

    // Validate and set defaults
    if (!filters.year_min || filters.year_min < 2001) {
      filters.year_min = 2001
    }
    if (!filters.year_max) {
      filters.year_max = new Date().getFullYear()
    }
    if (!filters.query && !filters.genres && !filters.keywords) {
      // Fallback: use vibe text as query
      filters.query = vibeText
    }

    console.log('Parsed TMDB filters:', JSON.stringify(filters, null, 2))
    console.log('=== END GEMINI: TMDB Search Filters ===\n')

    return filters
  } catch (error) {
    console.error('Error getting TMDB search filters from Gemini:', error)
    // Fallback: return basic filters with vibe as query
    return {
      query: vibeText,
      year_min: 2001,
      year_max: new Date().getFullYear(),
    }
  }
}

/**
 * Get a movie recommendation for solo users using Gemini
 */
export async function recommendMovieForSoloUser(
  vibeText: string,
  votes: Array<{
    movie_tmdb_id: number
    vote: 'yes' | 'no'
    reason_text?: string | null
  }>,
  shownMovieIds: number[]
): Promise<{
  tmdb_id: number
  title: string
  reason: string
}> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const yesVotes = votes.filter((v) => v.vote === 'yes')
  const noVotes = votes.filter((v) => v.vote === 'no')

  const prompt = `You are a movie recommendation assistant helping a single user find the perfect movie.

CRITICAL RESTRICTIONS:
- Only recommend Hindi (language code: hi) or English (language code: en) movies
- Only recommend movies released AFTER 2000 (year >= 2001)
- The recommended movie MUST NOT be one of these already shown: ${shownMovieIds.join(', ')}
- Return the movie TITLE (name), NOT a TMDB ID. The system will search TMDB for this title.

User's mood/vibe: "${vibeText}"

Movies the user LIKED (voted YES):
${yesVotes.length > 0 ? yesVotes.map(v => `- Movie ID: ${v.movie_tmdb_id}`).join('\n') : '- None'}

Movies the user REJECTED (voted NO):
${noVotes.map(v => `- Movie ID: ${v.movie_tmdb_id}${v.reason_text ? ` (reason: "${v.reason_text}")` : ''}`).join('\n') || '- None'}

Movies already shown (DO NOT recommend these): ${shownMovieIds.join(', ')}

Based on this information, recommend ONE movie that:
1. Matches the user's stated vibe/mood
2. Is similar to movies they liked (if any)
3. Avoids characteristics of movies they rejected
4. Has NOT been shown before (not in the list above)
5. Is Hindi or English only
6. Was released after 2000

Return ONLY a JSON object:
{
  "title": "Movie Title",
  "reason": "Brief explanation of why this movie fits their preferences"
}

IMPORTANT: Return ONLY the movie TITLE (name), NOT a TMDB ID. The system will search TMDB for this movie title.`

  try {
    console.log('=== GEMINI SOLO RECOMMENDATION DEBUG ===')
    console.log('Input prompt:', prompt)
    console.log('Votes summary:')
    console.log('  - YES votes:', yesVotes.length)
    console.log('  - NO votes:', noVotes.length)
    console.log('  - Shown movie IDs:', shownMovieIds)

    // Use latest Gemini model: gemini-3-flash-preview (latest as of Jan 2026)
    // If this model isn't available, the error will be caught and fallback provider will be used
    const modelName = 'gemini-3-flash-preview' // Latest fast model
    // Alternative models if above doesn't work:
    // - 'gemini-3-pro' (more capable but slower)
    // - 'gemini-pro' (older but widely available)
    const model = genAI.getGenerativeModel({ model: modelName })
    console.log(`Using Gemini model: ${modelName}`)

    const result = await model.generateContent(prompt)
    const response = await result.response
    const content = response.text()

    console.log('Gemini raw response:', content)

    if (!content) {
      throw new Error('No response content from Gemini API')
    }

    // Extract JSON from response (Gemini might add extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response')
    }

    let resultData: { title: string; reason: string }
    try {
      resultData = JSON.parse(jsonMatch[0]) as {
        title: string
        reason: string
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', jsonMatch[0])
      throw new Error(
        `Invalid JSON response from Gemini: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      )
    }

    // Validate required fields
    if (!resultData.title || typeof resultData.title !== 'string') {
      throw new Error('Gemini response missing valid title field')
    }
    
    console.log('Parsed recommendation (movie name):', JSON.stringify(resultData, null, 2))
    
    // Step: Search TMDB for this movie title
    console.log('Searching TMDB for movie:', resultData.title)
    const { searchMovies } = await import('@/lib/tmdb')
    const tmdbSearch = await searchMovies(resultData.title, 1)
    
    // Find the best match (exact title match preferred, then first result)
    let tmdbId: number | null = null
    const exactMatch = tmdbSearch.results.find(
      (m) => m.title.toLowerCase() === resultData.title.toLowerCase()
    )
    
    if (exactMatch) {
      tmdbId = exactMatch.id
      console.log('Found exact match in TMDB:', exactMatch.id, exactMatch.title)
    } else if (tmdbSearch.results.length > 0) {
      // Filter for Hindi/English, after 2000
      const filtered = tmdbSearch.results.filter((m) => {
        const lang = m.original_language || ''
        const year = m.release_date ? parseInt(m.release_date.split('-')[0]) : 0
        return (lang === 'en' || lang === 'hi') && year >= 2001
      })
      
      if (filtered.length > 0) {
        tmdbId = filtered[0].id
        console.log('Found match in TMDB:', filtered[0].id, filtered[0].title)
      }
    }
    
    if (!tmdbId) {
      throw new Error(`Could not find movie "${resultData.title}" in TMDB`)
    }
    
    console.log('Final recommendation:', { tmdb_id: tmdbId, title: resultData.title, reason: resultData.reason })
    console.log('=== END GEMINI SOLO RECOMMENDATION DEBUG ===\n')

    return {
      tmdb_id: tmdbId,
      title: resultData.title,
      reason: resultData.reason,
    }
  } catch (error) {
    console.error('Error getting solo recommendation from Gemini:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}

/**
 * Get group movie recommendations using Gemini
 */
export async function recommendMovies(
  vibeText: string,
  allVotes: Array<{
    movie_tmdb_id: number
    vote: 'yes' | 'no'
    reason_text?: string | null
  }>,
  roundHistory: Array<{
    round_number: number
    movie_tmdb_ids: number[]
  }>,
  watchlistTmdbIds: number[]
): Promise<{
  topPick: MovieRecommendation
  alternates: MovieRecommendation[]
  explanation: string
}> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const yesVotes = allVotes.filter((v) => v.vote === 'yes')
  const noVotes = allVotes.filter((v) => v.vote === 'no')

  const shownMovies = new Set(
    roundHistory.flatMap((r) => r.movie_tmdb_ids as number[])
  )

  const prompt = `You are a fair movie recommendation assistant for a group.

CRITICAL RESTRICTIONS:
- Only recommend Hindi (language code: hi) or English (language code: en) movies
- Only recommend movies released AFTER 2000 (year >= 2001)
- You can recommend movies NOT in the watchlist if they better match preferences

Initial vibe: "${vibeText}"

Voting patterns:
- Total YES votes: ${yesVotes.length}
- Total NO votes: ${noVotes.length}
${noVotes.some((v) => v.reason_text) ? `- NO vote reasons: ${noVotes.filter((v) => v.reason_text).map((v) => `"${v.reason_text}"`).join(', ')}` : ''}

Movies already shown in rounds: ${Array.from(shownMovies).join(', ')}
Available watchlist movies: ${watchlistTmdbIds.join(', ')}

Recommend 1 top pick and 2 alternates.

For each recommendation, provide:
- title (movie title - the system will search TMDB for this)
- reason (brief explanation why this fits)

IMPORTANT: Return ONLY movie TITLES (names), NOT TMDB IDs. The system will search TMDB for these titles.

Return ONLY a JSON object:
{
  "topPick": {"title": "Movie Title", "reason": "..."},
  "alternates": [
    {"title": "Movie 2", "reason": "..."},
    {"title": "Movie 3", "reason": "..."}
  ],
  "explanation": "Overall explanation of why these recommendations are fair and match the group's preferences"
}

Be fair, consider all preferences, and avoid movies that were strongly rejected. All movies must be Hindi or English, released after 2000.`

  try {
    console.log('=== GEMINI FINAL RESOLUTION DEBUG ===')
    console.log('Input prompt:', prompt)

    // Use latest Gemini model: gemini-3-flash-preview (latest as of Jan 2026)
    // If this model isn't available, the error will be caught and fallback provider will be used
    const modelName = 'gemini-3-flash-preview' // Latest fast model
    // Alternative models if above doesn't work:
    // - 'gemini-3-pro' (more capable but slower)
    // - 'gemini-pro' (older but widely available)
    const model = genAI.getGenerativeModel({ model: modelName })
    console.log(`Using Gemini model: ${modelName}`)

    const result = await model.generateContent(prompt)
    const response = await result.response
    const content = response.text()

    console.log('Gemini raw response:', content)

    if (!content) {
      throw new Error('No response content from Gemini API')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response')
    }

    let resultData: {
      topPick: { title: string; reason: string }
      alternates: Array<{ title: string; reason: string }>
      explanation: string
    }
    try {
      resultData = JSON.parse(jsonMatch[0]) as {
        topPick: { title: string; reason: string }
        alternates: Array<{ title: string; reason: string }>
        explanation: string
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', jsonMatch[0])
      throw new Error(
        `Invalid JSON response from Gemini: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      )
    }

    // Validate required fields
    if (!resultData.topPick || !resultData.topPick.title || typeof resultData.topPick.title !== 'string') {
      throw new Error('Gemini response missing valid topPick.title field')
    }

    if (!Array.isArray(resultData.alternates)) {
      throw new Error('Gemini response missing valid alternates array')
    }
    
    console.log('Parsed recommendation (movie names):', JSON.stringify(resultData, null, 2))
    
    // Search TMDB for each movie title
    const { searchMovies } = await import('@/lib/tmdb')
    
    const searchAndGetId = async (title: string): Promise<number> => {
      console.log(`Searching TMDB for: ${title}`)
      const tmdbSearch = await searchMovies(title, 1)
      
      // Find exact match first
      const exactMatch = tmdbSearch.results.find(
        (m) => m.title.toLowerCase() === title.toLowerCase()
      )
      
      if (exactMatch) {
        const lang = exactMatch.original_language || ''
        const year = exactMatch.release_date ? parseInt(exactMatch.release_date.split('-')[0]) : 0
        if ((lang === 'en' || lang === 'hi') && year >= 2001) {
          console.log(`Found exact match: ${exactMatch.id} - ${exactMatch.title}`)
          return exactMatch.id
        }
      }
      
      // Filter for Hindi/English, after 2000
      const filtered = tmdbSearch.results.filter((m) => {
        const lang = m.original_language || ''
        const year = m.release_date ? parseInt(m.release_date.split('-')[0]) : 0
        return (lang === 'en' || lang === 'hi') && year >= 2001
      })
      
      if (filtered.length > 0) {
        console.log(`Found match: ${filtered[0].id} - ${filtered[0].title}`)
        return filtered[0].id
      }
      
      throw new Error(`Could not find movie "${title}" in TMDB`)
    }
    
    // Get TMDB IDs for all recommendations
    const [topPickId, ...alternateIds] = await Promise.all([
      searchAndGetId(resultData.topPick.title),
      ...resultData.alternates.map(a => searchAndGetId(a.title))
    ])
    
    const finalResult: {
      topPick: MovieRecommendation
      alternates: MovieRecommendation[]
      explanation: string
    } = {
      topPick: {
        tmdb_id: topPickId,
        title: resultData.topPick.title,
        reason: resultData.topPick.reason,
      },
      alternates: resultData.alternates.map((alt, idx) => ({
        tmdb_id: alternateIds[idx],
        title: alt.title,
        reason: alt.reason,
      })),
      explanation: resultData.explanation,
    }
    
    console.log('Final recommendation with TMDB IDs:', JSON.stringify(finalResult, null, 2))
    console.log('=== END GEMINI FINAL RESOLUTION DEBUG ===\n')

    return finalResult
  } catch (error) {
    console.error('Error getting recommendations from Gemini:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}
