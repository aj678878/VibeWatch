'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { getPosterUrl } from '@/lib/tmdb'

interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  release_date?: string
  vote_average?: number
}

interface MovieSearchProps {
  onSelectMovie: (movie: Movie) => void
  groupId: string
}

export default function MovieSearch({ onSelectMovie, groupId }: MovieSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (query.length < 2) {
      setResults([])
      return
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
        }
      } catch (error) {
        console.error('Error searching movies:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query])

  const handleAddToWatchlist = async (movie: Movie) => {
    setAdding(movie.id)
    try {
      const response = await fetch(`/api/groups/${groupId}/watchlist/${movie.id}`, {
        method: 'POST',
      })

      const data = await response.json().catch(() => ({ error: 'Failed to parse response' }))

      if (response.ok) {
        onSelectMovie(movie)
        setQuery('')
        setResults([])
      } else {
        console.error('Error adding to watchlist:', data)
        alert(data.error || 'Failed to add movie to watchlist')
      }
    } catch (error) {
      console.error('Error adding movie:', error)
      alert('Failed to add movie to watchlist. Please try again.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for movies..."
        className="netflix-input w-full md:w-96"
      />

      {loading && (
        <div className="absolute top-full left-0 right-0 md:w-96 mt-2 bg-card-bg rounded p-4 text-netflix-gray text-sm">
          Searching...
        </div>
      )}

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 md:w-[600px] mt-2 bg-card-bg rounded shadow-2xl max-h-[400px] overflow-y-auto z-50">
          {results.map((movie) => (
            <div
              key={movie.id}
              className="flex items-center gap-4 p-3 hover:bg-card-hover transition-colors border-b border-gray-800 last:border-0"
            >
              {movie.poster_path ? (
                <Image
                  src={getPosterUrl(movie.poster_path, 'w200') || ''}
                  alt={movie.title}
                  width={60}
                  height={90}
                  className="w-12 h-18 object-cover rounded"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-18 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
                  No image
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium line-clamp-1">{movie.title}</h4>
                <p className="text-sm text-netflix-gray line-clamp-1">{movie.overview}</p>
                <p className="text-xs text-netflix-gray mt-1">
                  {movie.release_date?.split('-')[0] || 'N/A'} | Rating: {movie.vote_average?.toFixed(1) || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => handleAddToWatchlist(movie)}
                disabled={adding === movie.id}
                className="netflix-btn px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
              >
                {adding === movie.id ? 'Adding...' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
