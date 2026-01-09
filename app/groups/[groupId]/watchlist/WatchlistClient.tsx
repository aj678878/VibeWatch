'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MovieSearch from '@/components/MovieSearch'
import Watchlist from '@/components/Watchlist'
import LogoutButton from '@/components/LogoutButton'

interface Participant {
  id: string
  type: 'member' | 'guest'
  displayName: string
  hasCompleted?: boolean
}

interface Group {
  id: string
  invite_code: string
  created_by_user_id: string
  participants: Participant[]
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
  isHost: boolean
}

export default function WatchlistClient({
  group,
  watchlist: initialWatchlist,
  activeSession,
  isHost,
}: WatchlistClientProps) {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [copied, setCopied] = useState(false)

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/groups/join/${group.invite_code}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      const textArea = document.createElement('textarea')
      textArea.value = inviteUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleMovieAdded = () => {
    fetch(`/api/groups/${group.id}/watchlist`)
      .then((res) => res.json())
      .then((data) => setWatchlist(data.watchlist || []))
      .catch(console.error)
  }

  const handleStartDecision = () => {
    router.push(`/groups/${group.id}/sessions/new`)
  }

  const handleEnterSession = () => {
    if (activeSession) {
      router.push(`/groups/${group.id}/sessions/${activeSession.id}/round/${activeSession.current_round}`)
    }
  }

  const handleRemoveGuest = async (participantId: string) => {
    if (!confirm('Remove this guest from the group?')) {
      return
    }

    try {
      const response = await fetch(`/api/groups/${group.id}/guests/${participantId}/remove`, {
        method: 'POST',
      })

      if (response.ok) {
        // Reload page to refresh participant list
        window.location.reload()
      } else {
        alert('Failed to remove guest')
      }
    } catch (error) {
      console.error('Error removing guest:', error)
      alert('Failed to remove guest')
    }
  }

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark via-netflix-dark/95 to-transparent">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-xl sm:text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 sm:pt-24 px-4 sm:px-6 md:px-8 pb-8 sm:pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Back navigation */}
          <Link
            href="/groups"
            className="text-netflix-gray text-xs sm:text-sm hover:text-white transition-colors inline-block mb-4 sm:mb-6"
          >
            Back to Groups
          </Link>

          {/* Group header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 sm:mb-8">
            <div className="w-full md:w-auto">
              <h2 className="text-2xl sm:text-3xl font-medium mb-2">Watch Group</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                <span className="bg-netflix-red/20 text-netflix-red px-2 sm:px-3 py-1 rounded font-medium">
                  {group.invite_code.toUpperCase()}
                </span>
                <button
                  onClick={copyInviteLink}
                  className="text-netflix-gray hover:text-white transition-colors"
                >
                  {copied ? 'Copied' : 'Copy invite link'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              {activeSession ? (
                <button
                  onClick={handleEnterSession}
                  className="netflix-btn px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex-1 md:flex-none"
                >
                  Enter Decision Session
                </button>
              ) : (
                <button
                  onClick={handleStartDecision}
                  className="netflix-btn px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex-1 md:flex-none"
                >
                  Start Decision Session
                </button>
              )}
            </div>
          </div>

          {/* Participants list */}
          <section className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">
              Participants <span className="text-netflix-gray font-normal">({group.participants.length})</span>
            </h3>
            <div className="bg-card-bg rounded p-3 sm:p-4 space-y-2">
              {group.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between py-2 px-2 sm:px-3 hover:bg-card-hover rounded transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Status dot */}
                    {activeSession && (
                      <div
                        className={`w-2 sm:w-3 h-2 sm:h-3 rounded-full flex-shrink-0 ${
                          participant.hasCompleted ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        title={
                          participant.hasCompleted
                            ? 'Completed voting for this round'
                            : 'Has not completed voting for this round'
                        }
                      />
                    )}
                    <span className="text-sm sm:text-base font-medium truncate">{participant.displayName}</span>
                    {participant.type === 'guest' && (
                      <span className="text-xs text-netflix-gray bg-netflix-gray/20 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                        Guest
                      </span>
                    )}
                  </div>
                  {isHost && participant.type === 'guest' && (
                    <button
                      onClick={() => handleRemoveGuest(participant.id)}
                      className="text-netflix-red hover:text-netflix-red-hover text-lg sm:text-xl font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center flex-shrink-0 ml-2"
                      title="Remove guest"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Search section */}
          <section className="mb-8 sm:mb-12">
            <h3 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">Add Movies</h3>
            <MovieSearch onSelectMovie={handleMovieAdded} groupId={group.id} />
          </section>

          {/* Watchlist section */}
          <section>
            <h3 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">
              Watchlist <span className="text-netflix-gray font-normal">({watchlist.length})</span>
            </h3>
            <Watchlist
              items={watchlist}
              groupId={group.id}
              onRemove={(tmdbId) => {
                setWatchlist((prev) => prev.filter((item) => item.tmdb_id !== tmdbId))
              }}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
