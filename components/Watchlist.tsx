'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getPosterUrl, type TMDBMovie } from '@/lib/tmdb'

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
        const moviePromises = idsToFetch.map(async (id) => {
          const response = await fetch(`/api/tmdb/movie/${id}`)
          if (!response.ok) throw new Error(`Failed to fetch movie ${id}`)
          return response.json() as Promise<TMDBMovie>
        })
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
      <div className="bg-card-bg rounded p-12 text-center">
        <p className="text-netflix-gray">No movies in watchlist yet</p>
        <p className="text-sm text-netflix-gray mt-2">Search and add movies above</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {items.map((item) => {
        const movie = movies[item.tmdb_id]
        const isLoading = loading[item.tmdb_id]

        if (isLoading) {
          return (
            <div
              key={item.id}
              className="netflix-card aspect-[2/3] animate-pulse bg-card-hover"
            />
          )
        }

        if (!movie) {
          return (
            <div
              key={item.id}
              className="netflix-card aspect-[2/3] flex items-center justify-center"
            >
              <span className="text-netflix-gray text-sm">Loading...</span>
            </div>
          )
        }

        return (
          <div
            key={item.id}
            className="netflix-card group relative overflow-hidden"
          >
            {movie.poster_path ? (
              <Image
                src={getPosterUrl(movie.poster_path, 'w500') || ''}
                alt={movie.title}
                width={300}
                height={450}
                className="w-full aspect-[2/3] object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center">
                <span className="text-gray-500 text-sm text-center px-2">{movie.title}</span>
              </div>
            )}
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <h4 className="font-medium text-sm line-clamp-2 mb-1">{movie.title}</h4>
              <div className="flex items-center gap-2 text-xs text-netflix-gray mb-2">
                <span>{movie.release_date?.split('-')[0]}</span>
                <span>Rating: {movie.vote_average?.toFixed(1) || 'N/A'}</span>
              </div>
              {onRemove && (
                <button
                  onClick={() => handleRemove(item.tmdb_id)}
                  className="netflix-btn-secondary w-full py-1.5 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
