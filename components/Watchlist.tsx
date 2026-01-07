'use client'

import { useState, useEffect } from 'react'
import { getPosterUrl, getMovieDetails, type TMDBMovie } from '@/lib/tmdb'

interface WatchlistItem {
  id: string
  tmdb_id: number
}

interface WatchlistProps {
  items: WatchlistItem[]
  groupId: string
  onRemove?: (tmdbId: number) => void
}

export default function Watchlist({ items, groupId, onRemove }: WatchlistProps) {
  const [movies, setMovies] = useState<Record<number, TMDBMovie>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const fetchMovies = async () => {
      const idsToFetch = items
        .map((item) => item.tmdb_id)
        .filter((id) => !movies[id] && !loading[id])

      if (idsToFetch.length === 0) return

      idsToFetch.forEach((id) => {
        setLoading((prev) => ({ ...prev, [id]: true }))
      })

      try {
        const moviePromises = idsToFetch.map((id) => getMovieDetails(id))
        const fetchedMovies = await Promise.all(moviePromises)

        setMovies((prev) => {
          const updated = { ...prev }
          fetchedMovies.forEach((movie) => {
            updated[movie.id] = movie
          })
          return updated
        })
      } catch (error) {
        console.error('Error fetching movie details:', error)
      } finally {
        idsToFetch.forEach((id) => {
          setLoading((prev) => {
            const updated = { ...prev }
            delete updated[id]
            return updated
          })
        })
      }
    }

    fetchMovies()
  }, [items, movies, loading])

  const handleRemove = async (tmdbId: number) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/watchlist/${tmdbId}`, {
        method: 'DELETE',
      })

      if (response.ok && onRemove) {
        onRemove(tmdbId)
      }
    } catch (error) {
      console.error('Error removing movie:', error)
      alert('Failed to remove movie from watchlist')
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No movies in watchlist yet.</p>
        <p className="text-sm mt-2">Search and add movies above.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const movie = movies[item.tmdb_id]
        const isLoading = loading[item.tmdb_id]

        if (isLoading) {
          return (
            <div
              key={item.id}
              className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 animate-pulse"
            >
              <div className="w-full h-48 bg-white/10 rounded mb-4"></div>
              <div className="h-4 bg-white/10 rounded mb-2"></div>
              <div className="h-4 bg-white/10 rounded w-3/4"></div>
            </div>
          )
        }

        if (!movie) {
          return (
            <div
              key={item.id}
              className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4"
            >
              <p className="text-gray-400 text-sm">Loading movie details...</p>
            </div>
          )
        }

        return (
          <div
            key={item.id}
            className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors"
          >
            {movie.poster_path && (
              <img
                src={getPosterUrl(movie.poster_path, 'w500') || ''}
                alt={movie.title}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            <h3 className="font-light text-lg mb-2 line-clamp-2">{movie.title}</h3>
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">{movie.overview}</p>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{movie.release_date?.split('-')[0]}</span>
              <span>⭐ {movie.vote_average?.toFixed(1) || 'N/A'}</span>
            </div>
            {onRemove && (
              <button
                onClick={() => handleRemove(item.tmdb_id)}
                className="mt-3 w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-light text-sm transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
