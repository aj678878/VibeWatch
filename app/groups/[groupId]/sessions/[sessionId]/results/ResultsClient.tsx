'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMovieDetails, getPosterUrl, type TMDBMovie } from '@/lib/tmdb'

interface ResultsClientProps {
  sessionId: string
  finalMovieTmdbId: number
  vibeText: string
}

export default function ResultsClient({
  sessionId,
  finalMovieTmdbId,
  vibeText,
}: ResultsClientProps) {
  const router = useRouter()
  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [alternates, setAlternates] = useState<TMDBMovie[]>([])
  const [explanation, setExplanation] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch final movie
        const movieData = await getMovieDetails(finalMovieTmdbId)
        setMovie(movieData)

        // Try to get recommendation details from session (if stored)
        // For MVP, we'll just show the movie with a generic explanation
        setExplanation(
          `Based on your vibe "${vibeText}" and the group's voting patterns, this movie minimizes objections while matching your preferences.`
        )
      } catch (error) {
        console.error('Error fetching results:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [finalMovieTmdbId, vibeText])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-12 text-center animate-pulse">
            <div className="h-8 bg-white/10 rounded w-64 mx-auto mb-4"></div>
            <div className="h-4 bg-white/10 rounded w-96 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-gray-400">Movie not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-light mb-4">Tonight's pick is ready</h1>
          <p className="text-gray-400 text-lg">
            Based on your group's preferences and voting
          </p>
        </div>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8 mb-8">
          {movie.poster_path && (
            <img
              src={getPosterUrl(movie.poster_path, 'w500') || ''}
              alt={movie.title}
              className="w-full max-w-md mx-auto rounded-lg mb-6"
            />
          )}
          <h2 className="text-3xl font-light text-center mb-4">{movie.title}</h2>
          <p className="text-gray-300 text-center mb-6">{movie.overview}</p>
          <div className="flex justify-center gap-6 text-sm text-gray-400 mb-6">
            <span>{movie.release_date?.split('-')[0]}</span>
            <span>⭐ {movie.vote_average?.toFixed(1) || 'N/A'}</span>
            {movie.runtime && <span>{movie.runtime} min</span>}
          </div>
        </div>

        {explanation && (
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-6 mb-8">
            <h3 className="text-xl font-light mb-3">Why this pick?</h3>
            <p className="text-gray-300 leading-relaxed">{explanation}</p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/groups')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors"
          >
            Back to Groups
          </button>
        </div>
      </div>
    </div>
  )
}
