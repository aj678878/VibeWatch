'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MovieSearch from '@/components/MovieSearch'
import Watchlist from '@/components/Watchlist'

interface GroupMember {
  id: string
  user_id: string
}

interface Group {
  id: string
  invite_code: string
  members: GroupMember[]
}

interface WatchlistItem {
  id: string
  tmdb_id: number
}

interface DecisionSession {
  id: string
  current_round: number
  status: string
}

interface WatchlistClientProps {
  group: Group
  watchlist: WatchlistItem[]
  activeSession: DecisionSession | null
}

export default function WatchlistClient({
  group,
  watchlist: initialWatchlist,
  activeSession,
}: WatchlistClientProps) {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [loading, setLoading] = useState(false)

  const handleMovieAdded = (movie: any) => {
    // Refresh watchlist
    fetch(`/api/groups/${group.id}/watchlist`)
      .then((res) => res.json())
      .then((data) => setWatchlist(data.watchlist || []))
      .catch(console.error)
  }

  const handleStartDecision = async () => {
    if (watchlist.length < 5) {
      alert('Please add at least 5 movies to the watchlist before starting a decision session.')
      return
    }

    router.push(`/groups/${group.id}/sessions/new`)
  }

  const handleContinueSession = () => {
    if (activeSession) {
      router.push(`/groups/${group.id}/sessions/${activeSession.id}/round/${activeSession.current_round}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-light mb-2">Group Watchlist</h1>
            <p className="text-gray-400 text-sm">
              Invite code: <span className="font-mono">{group.invite_code}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-4">
            {activeSession ? (
              <button
                onClick={handleContinueSession}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors"
              >
                Continue Session (Round {activeSession.current_round})
              </button>
            ) : (
              <button
                onClick={handleStartDecision}
                disabled={watchlist.length < 5}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Decision
              </button>
            )}
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-6 mb-8">
          <h2 className="text-xl font-light mb-4">Add Movies</h2>
          <MovieSearch onSelectMovie={handleMovieAdded} groupId={group.id} />
        </div>

        <div>
          <h2 className="text-2xl font-light mb-6">
            Watchlist ({watchlist.length})
          </h2>
          <Watchlist
            items={watchlist}
            groupId={group.id}
            onRemove={(tmdbId) => {
              setWatchlist((prev) => prev.filter((item) => item.tmdb_id !== tmdbId))
            }}
          />
        </div>
      </div>
    </div>
  )
}
