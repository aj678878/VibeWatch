import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface PreferenceConstraints {
  genres?: string[]
  runtime?: { min?: number; max?: number }
  language?: string
  tone?: string[]
  avoid?: string[]
  year?: { min?: number; max?: number }
}

export interface MovieRecommendation {
  tmdb_id: number
  title: string
  reason: string
}

export async function extractPreferences(
  vibeText: string,
  votes: Array<{
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
  }>
): Promise<PreferenceConstraints> {
  const yesVotes = votes.filter((v) => v.vote === 'yes')
  const noVotes = votes.filter((v) => v.vote === 'no')

  const prompt = `You are analyzing movie preferences for a group decision-making session.

Initial vibe description: "${vibeText}"

Recent voting round:
- YES votes: ${yesVotes.length} (these are preferred)
- NO votes: ${noVotes.length}${noVotes.some((v) => v.reason_text) ? ` with reasons: ${noVotes.filter((v) => v.reason_text).map((v) => `"${v.reason_text}"`).join(', ')}` : ''}

Round history: ${roundHistory.length} previous rounds

Extract structured preference constraints from this information. Consider:
- Genres that were liked (from YES votes context)
- Runtime preferences (from vibe or rejection reasons like "too long")
- Language preferences
- Tone/mood (from vibe text)
- Things to avoid (from NO vote reasons)
- Year/era preferences

Return ONLY a JSON object with this structure:
{
  "genres": ["comedy", "drama"] or null,
  "runtime": {"min": 90, "max": 120} or null,
  "language": "en" or null,
  "tone": ["light", "funny"] or null,
  "avoid": ["slow", "subtitles"] or null,
  "year": {"min": 2000, "max": 2024} or null
}

Be specific and only include constraints you can confidently infer. If uncertain, use null.`

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a movie preference analyzer. Extract structured constraints from voting patterns and vibe descriptions. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'mixtral-8x7b-32768',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from Groq')
    }

    const constraints = JSON.parse(content) as PreferenceConstraints
    return constraints
  } catch (error) {
    console.error('Error extracting preferences:', error)
    // Return minimal constraints if AI fails
    return {}
  }
}

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
  const yesVotes = allVotes.filter((v) => v.vote === 'yes')
  const noVotes = allVotes.filter((v) => v.vote === 'no')

  const shownMovies = new Set(
    roundHistory.flatMap((r) => r.movie_tmdb_ids as number[])
  )

  const prompt = `You are helping a group of friends choose a movie. They've gone through 5 voting rounds without consensus.

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

Be fair, consider all preferences, and avoid movies that were strongly rejected.`

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a fair movie recommendation assistant. Recommend movies that minimize objections while respecting group preferences. Return only valid JSON with tmdb_id, title, reason, and explanation fields.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'mixtral-8x7b-32768',
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from Groq')
    }

    const result = JSON.parse(content) as {
      topPick: MovieRecommendation
      alternates: MovieRecommendation[]
      explanation: string
    }

    return result
  } catch (error) {
    console.error('Error getting recommendations:', error)
    throw error
  }
}
