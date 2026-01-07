'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getPosterUrl, getMovieDetails, type TMDBMovie } from '@/lib/tmdb'

interface MovieCardProps {
  tmdbId: number
  onVote: (tmdbId: number, vote: 'yes' | 'no', reason?: string) => void
  userVote?: { vote: 'yes' | 'no'; reason?: string | null }
  disabled?: boolean
}

export default function MovieCard({
  tmdbId,
  onVote,
  userVote,
  disabled = false,
}: MovieCardProps) {
  const [movie, setMovie] = useState<TMDBMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [reasonText, setReasonText] = useState('')

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const movieData = await getMovieDetails(tmdbId)
        setMovie(movieData)
      } catch (error) {
        console.error('Error fetching movie:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMovie()
  }, [tmdbId])

  const handleVote = (vote: 'yes' | 'no') => {
    if (vote === 'no' && !userVote) {
      setShowReasonInput(true)
      return
    }

    onVote(tmdbId, vote, vote === 'no' ? reasonText : undefined)
    if (vote === 'yes') {
      setShowReasonInput(false)
      setReasonText('')
    }
  }

  const handleSubmitReason = () => {
    onVote(tmdbId, 'no', reasonText)
    setShowReasonInput(false)
  }

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-6 animate-pulse">
        <div className="w-full h-64 bg-white/10 rounded mb-4"></div>
        <div className="h-4 bg-white/10 rounded mb-2"></div>
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-6">
        <p className="text-gray-400">Movie not found</p>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-6 hover:bg-white/10 transition-colors">
      {movie.poster_path && (
        <Image
          src={getPosterUrl(movie.poster_path, 'w500') || ''}
          alt={movie.title}
          width={500}
          height={750}
          className="w-full h-80 object-cover rounded-lg mb-4"
          unoptimized
        />
      )}
      <h3 className="font-light text-xl mb-2">{movie.title}</h3>
      <p className="text-sm text-gray-400 line-clamp-3 mb-4">{movie.overview}</p>
      <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
        <span>{movie.release_date?.split('-')[0]}</span>
        <span>⭐ {movie.vote_average?.toFixed(1) || 'N/A'}</span>
        {movie.runtime && <span>{movie.runtime} min</span>}
      </div>

      {userVote ? (
        <div className="space-y-2">
          <div
            className={`p-3 rounded-lg text-center ${
              userVote.vote === 'yes'
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}
          >
            <span className="text-sm">
              You voted <strong>{userVote.vote === 'yes' ? 'YES' : 'NO'}</strong>
            </span>
            {userVote.reason && (
              <p className="text-xs text-gray-400 mt-2">{userVote.reason}</p>
            )}
          </div>
        </div>
      ) : showReasonInput ? (
        <div className="space-y-2">
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Optional: Why not this one? (e.g., too slow, don't want subtitles)"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500 text-sm resize-none"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitReason}
              disabled={disabled}
              className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg font-light text-sm transition-colors disabled:opacity-50"
            >
              Submit NO Vote
            </button>
            <button
              onClick={() => {
                setShowReasonInput(false)
                setReasonText('')
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-light text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handleVote('yes')}
            disabled={disabled}
            className="flex-1 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg font-light transition-colors disabled:opacity-50"
          >
            Yes
          </button>
          <button
            onClick={() => handleVote('no')}
            disabled={disabled}
            className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg font-light transition-colors disabled:opacity-50"
          >
            No
          </button>
        </div>
      )}
    </div>
  )
}
