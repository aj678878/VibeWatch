/**
 * Google Gemini AI Provider
 * Free tier: https://aistudio.google.com/
 * Get API key: https://aistudio.google.com/app/apikey
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

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
- You must provide a valid TMDB movie ID for a real movie that exists

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
  "tmdb_id": 123,
  "title": "Movie Title",
  "reason": "Brief explanation of why this movie fits their preferences"
}

The tmdb_id MUST be a valid TMDB movie ID for a real movie that meets all restrictions above.`

  try {
    console.log('=== GEMINI SOLO RECOMMENDATION DEBUG ===')
    console.log('Input prompt:', prompt)
    console.log('Votes summary:')
    console.log('  - YES votes:', yesVotes.length)
    console.log('  - NO votes:', noVotes.length)
    console.log('  - Shown movie IDs:', shownMovieIds)

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

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

    let resultData: { tmdb_id: number; title: string; reason: string }
    try {
      resultData = JSON.parse(jsonMatch[0]) as {
        tmdb_id: number
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
    if (!resultData.tmdb_id || typeof resultData.tmdb_id !== 'number') {
      throw new Error('Gemini response missing valid tmdb_id field')
    }

    if (!resultData.title || typeof resultData.title !== 'string') {
      throw new Error('Gemini response missing valid title field')
    }

    console.log('Parsed recommendation:', JSON.stringify(resultData, null, 2))
    console.log('=== END GEMINI SOLO RECOMMENDATION DEBUG ===\n')

    return resultData
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

Recommend 1 top pick and 2 alternates. You can recommend:
- Movies from the watchlist (preferred)
- Movies NOT in the watchlist if they better match preferences (but provide TMDB IDs)

For each recommendation, provide:
- tmdb_id (must be a valid TMDB movie ID)
- title (movie title)
- reason (brief explanation why this fits)

Return ONLY a JSON object:
{
  "topPick": {"tmdb_id": 123, "title": "Movie Title", "reason": "..."},
  "alternates": [
    {"tmdb_id": 456, "title": "Movie 2", "reason": "..."},
    {"tmdb_id": 789, "title": "Movie 3", "reason": "..."}
  ],
  "explanation": "Overall explanation of why these recommendations are fair and match the group's preferences"
}

Be fair, consider all preferences, and avoid movies that were strongly rejected. All movies must be Hindi or English, released after 2000.`

  try {
    console.log('=== GEMINI FINAL RESOLUTION DEBUG ===')
    console.log('Input prompt:', prompt)

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

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
      topPick: MovieRecommendation
      alternates: MovieRecommendation[]
      explanation: string
    }
    try {
      resultData = JSON.parse(jsonMatch[0]) as {
        topPick: MovieRecommendation
        alternates: MovieRecommendation[]
        explanation: string
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', jsonMatch[0])
      throw new Error(
        `Invalid JSON response from Gemini: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      )
    }

    // Validate required fields
    if (!resultData.topPick || !resultData.topPick.tmdb_id || typeof resultData.topPick.tmdb_id !== 'number') {
      throw new Error('Gemini response missing valid topPick.tmdb_id field')
    }

    if (!resultData.topPick.title || typeof resultData.topPick.title !== 'string') {
      throw new Error('Gemini response missing valid topPick.title field')
    }

    if (!Array.isArray(resultData.alternates)) {
      throw new Error('Gemini response missing valid alternates array')
    }

    console.log('Parsed recommendation:', JSON.stringify(resultData, null, 2))
    console.log('=== END GEMINI FINAL RESOLUTION DEBUG ===\n')

    return resultData
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
