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

      if (response.ok) {
        onSelectMovie(movie)
        setQuery('')
        setResults([])
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add movie to watchlist')
      }
    } catch (error) {
      console.error('Error adding movie:', error)
      alert('Failed to add movie to watchlist')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="mb-8">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for movies..."
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
      />

      {loading && (
        <div className="mt-4 text-center text-gray-400 text-sm">Searching...</div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
          {results.map((movie) => (
            <div
              key={movie.id}
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              {movie.poster_path && (
                <Image
                  src={getPosterUrl(movie.poster_path, 'w200') || ''}
                  alt={movie.title}
                  width={200}
                  height={300}
                  className="w-16 h-24 object-cover rounded"
                  unoptimized
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-light text-lg truncate">{movie.title}</h3>
                <p className="text-sm text-gray-400 truncate">{movie.overview}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {movie.release_date?.split('-')[0] || 'N/A'} • ⭐ {movie.vote_average?.toFixed(1) || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => handleAddToWatchlist(movie)}
                disabled={adding === movie.id}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light text-sm transition-colors disabled:opacity-50"
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
