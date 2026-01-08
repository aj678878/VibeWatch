'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPosterUrl, type TMDBMovie } from '@/lib/tmdb'

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
  const [explanation, setExplanation] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/tmdb/movie/${finalMovieTmdbId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch movie details')
        }
        const movieData: TMDBMovie = await response.json()
        setMovie(movieData)

        setExplanation(
          `Selected based on your preferences: "${vibeText}" and the group voting patterns.`
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
      <div className="min-h-screen bg-netflix-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-netflix-red border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-netflix-gray">Loading your pick...</p>
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-netflix-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-netflix-gray mb-4">Movie not found</p>
          <Link href="/groups" className="netflix-btn px-6 py-3">
            Back to Groups
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark to-transparent">
        <div className="flex justify-between items-center px-8 py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
        </div>
      </header>

      {/* Hero section with movie backdrop */}
      <div className="relative min-h-screen">
        {/* Background image */}
        {movie.backdrop_path && (
          <div className="absolute inset-0">
            <Image
              src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
              alt=""
              fill
              className="object-cover opacity-40"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-r from-netflix-dark via-netflix-dark/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-netflix-dark via-transparent to-netflix-dark/50" />
          </div>
        )}

        {/* Content */}
        <div className="relative pt-32 px-8 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Poster */}
              <div className="flex-shrink-0 animate-scale-in">
                {movie.poster_path ? (
                  <Image
                    src={getPosterUrl(movie.poster_path, 'w500') || ''}
                    alt={movie.title}
                    width={300}
                    height={450}
                    className="rounded shadow-2xl"
                    unoptimized
                  />
                ) : (
                  <div className="w-[300px] h-[450px] bg-gray-800 rounded flex items-center justify-center">
                    <span className="text-gray-500">No poster</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 animate-slide-up">
                <p className="text-netflix-red text-lg font-medium mb-2">Tonight&apos;s Pick</p>
                <h1 className="text-5xl font-bold mb-4">{movie.title}</h1>
                
                <div className="flex gap-4 text-sm text-netflix-gray mb-6">
                  <span className="text-green-500 font-medium">
                    {Math.round((movie.vote_average || 0) * 10)}% Match
                  </span>
                  <span>{movie.release_date?.split('-')[0]}</span>
                  {movie.runtime && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
                </div>

                <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">
                  {movie.overview}
                </p>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {movie.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-3 py-1 bg-white/10 rounded text-sm"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                <div className="bg-card-bg rounded p-6 mb-8 max-w-2xl">
                  <h3 className="font-medium mb-2">Why this pick?</h3>
                  <p className="text-netflix-gray text-sm">{explanation}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => router.push('/groups')}
                    className="netflix-btn px-8 py-3 text-lg"
                  >
                    Back to Groups
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
