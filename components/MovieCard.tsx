'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getPosterUrl, type TMDBMovie } from '@/lib/tmdb'

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
        const response = await fetch(`/api/tmdb/movie/${tmdbId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch movie: ${response.statusText}`)
        }
        const movieData: TMDBMovie = await response.json()
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
      <div className="netflix-card aspect-[2/3] animate-pulse bg-card-hover" />
    )
  }

  if (!movie) {
    return (
      <div className="netflix-card aspect-[2/3] flex items-center justify-center bg-card-bg">
        <div className="text-center p-4">
          <p className="text-netflix-gray text-sm">Failed to load movie</p>
          <p className="text-xs text-gray-600 mt-1">ID: {tmdbId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="netflix-card overflow-hidden bg-card-bg">
      {/* Poster */}
      <div className="relative aspect-[2/3]">
        {movie.poster_path ? (
          <Image
            src={getPosterUrl(movie.poster_path, 'w500') || ''}
            alt={movie.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-gray-500 text-center px-4">{movie.title}</span>
          </div>
        )}
        
        {/* Vote indicator overlay */}
        {userVote && (
          <div className={`absolute inset-0 flex items-center justify-center ${
            userVote.vote === 'yes' 
              ? 'bg-green-500/30' 
              : 'bg-red-500/30'
          }`}>
            <span className={`text-4xl font-bold ${
              userVote.vote === 'yes' ? 'text-green-400' : 'text-red-400'
            }`}>
              {userVote.vote === 'yes' ? 'YES' : 'NO'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-lg line-clamp-1 mb-1">{movie.title}</h3>
        <p className="text-sm text-netflix-gray line-clamp-2 mb-3">{movie.overview}</p>
        <div className="flex gap-3 text-xs text-netflix-gray mb-4">
          <span>{movie.release_date?.split('-')[0] || 'N/A'}</span>
          <span>Rating: {movie.vote_average?.toFixed(1) || 'N/A'}</span>
          {movie.runtime && <span>{movie.runtime} min</span>}
        </div>

        {/* Voting UI */}
        {userVote ? (
          <div className={`p-3 rounded text-center text-sm ${
            userVote.vote === 'yes'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            Voted {userVote.vote.toUpperCase()}
            {userVote.reason && (
              <p className="text-xs text-netflix-gray mt-1">{userVote.reason}</p>
            )}
          </div>
        ) : showReasonInput ? (
          <div className="space-y-2">
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Why not? (optional)"
              className="netflix-input w-full text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReason}
                disabled={disabled}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                Confirm No
              </button>
              <button
                onClick={() => {
                  setShowReasonInput(false)
                  setReasonText('')
                }}
                className="px-4 py-2 netflix-btn-secondary text-sm"
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
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors disabled:opacity-50"
            >
              Yes
            </button>
            <button
              onClick={() => handleVote('no')}
              disabled={disabled}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded font-medium transition-colors disabled:opacity-50"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
