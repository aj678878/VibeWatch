/**
 * AI Provider Abstraction Layer
 * Allows easy switching between different AI providers (Groq, Gemini, etc.)
 */

export interface AIRecommendation {
  tmdb_id: number
  title: string
  reason: string
}

export interface AIGroupRecommendation {
  topPick: AIRecommendation
  alternates: AIRecommendation[]
  explanation: string
}

export type AIProvider = 'groq' | 'gemini' | 'fallback'

// Get the active AI provider from environment variable
export function getActiveProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'groq'
  
  // Validate provider
  if (provider === 'groq' || provider === 'gemini' || provider === 'fallback') {
    return provider
  }
  
  console.warn(`Invalid AI_PROVIDER "${provider}", defaulting to groq`)
  return 'groq'
}

/**
 * Get a movie recommendation for solo users
 */
export async function getSoloRecommendation(
  vibeText: string,
  votes: Array<{
    movie_tmdb_id: number
    vote: 'yes' | 'no'
    reason_text?: string | null
  }>,
  shownMovieIds: number[]
): Promise<AIRecommendation> {
  const provider = getActiveProvider()
  
  console.log(`[AI] Using provider: ${provider}`)
  
  try {
    switch (provider) {
      case 'groq':
        const { recommendMovieForSoloUser } = await import('./groq')
        return await recommendMovieForSoloUser(vibeText, votes, shownMovieIds)
      
      case 'gemini':
        const { recommendMovieForSoloUser: geminiRecommend } = await import('./gemini')
        return await geminiRecommend(vibeText, votes, shownMovieIds)
      
      case 'fallback':
        return getFallbackRecommendation(vibeText, votes, shownMovieIds)
      
      default:
        throw new Error(`Unknown AI provider: ${provider}`)
    }
  } catch (error) {
    console.error(`[AI] Error with provider ${provider}:`, error)
    
    // Try fallback if primary provider fails
    if (provider !== 'fallback') {
      console.log('[AI] Attempting fallback recommendation...')
      try {
        return await getFallbackRecommendation(vibeText, votes, shownMovieIds)
      } catch (fallbackError) {
        console.error('[AI] Fallback also failed:', fallbackError)
        throw error // Throw original error
      }
    }
    
    throw error
  }
}

/**
 * Get group movie recommendations
 */
export async function getGroupRecommendations(
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
): Promise<AIGroupRecommendation> {
  const provider = getActiveProvider()
  
  console.log(`[AI] Using provider: ${provider} for group recommendations`)
  
  try {
    switch (provider) {
      case 'groq':
        const { recommendMovies } = await import('./groq')
        return await recommendMovies(vibeText, allVotes, roundHistory, watchlistTmdbIds)
      
      case 'gemini':
        const { recommendMovies: geminiRecommend } = await import('./gemini')
        return await geminiRecommend(vibeText, allVotes, roundHistory, watchlistTmdbIds)
      
      case 'fallback':
        return getFallbackGroupRecommendation(vibeText, allVotes, roundHistory, watchlistTmdbIds)
      
      default:
        throw new Error(`Unknown AI provider: ${provider}`)
    }
  } catch (error) {
    console.error(`[AI] Error with provider ${provider}:`, error)
    
    // Try fallback if primary provider fails
    if (provider !== 'fallback') {
      console.log('[AI] Attempting fallback recommendation...')
      try {
        return await getFallbackGroupRecommendation(vibeText, allVotes, roundHistory, watchlistTmdbIds)
      } catch (fallbackError) {
        console.error('[AI] Fallback also failed:', fallbackError)
        throw error // Throw original error
      }
    }
    
    throw error
  }
}

/**
 * Fallback recommendation (simple rule-based, no AI)
 * This is a basic fallback that doesn't require any API
 */
function getFallbackRecommendation(
  vibeText: string,
  votes: Array<{
    movie_tmdb_id: number
    vote: 'yes' | 'no'
    reason_text?: string | null
  }>,
  shownMovieIds: number[]
): AIRecommendation {
  console.log('[AI] Using fallback recommendation (no AI)')
  
  // Simple fallback: return a placeholder
  // In a real scenario, you might want to:
  // 1. Pick a random popular movie from TMDB
  // 2. Use a predefined list of movies
  // 3. Return an error asking user to try again
  
  throw new Error(
    'AI recommendation service is unavailable. Please try again later or contact support.'
  )
}

function getFallbackGroupRecommendation(
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
): AIGroupRecommendation {
  console.log('[AI] Using fallback group recommendation (no AI)')
  
  throw new Error(
    'AI recommendation service is unavailable. Please try again later or contact support.'
  )
}
