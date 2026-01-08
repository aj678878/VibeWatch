'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MovieSearch from '@/components/MovieSearch'
import Watchlist from '@/components/Watchlist'
import LogoutButton from '@/components/LogoutButton'

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

  const handleContinueSession = () => {
    if (activeSession) {
      router.push(`/groups/${group.id}/sessions/${activeSession.id}/round/${activeSession.current_round}`)
    }
  }

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark via-netflix-dark/95 to-transparent">
        <div className="flex justify-between items-center px-8 py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Back navigation */}
          <Link
            href="/groups"
            className="text-netflix-gray text-sm hover:text-white transition-colors inline-block mb-6"
          >
            Back to Groups
          </Link>

          {/* Group header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-medium mb-2">Watch Group</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="bg-netflix-red/20 text-netflix-red px-3 py-1 rounded font-medium">
                  {group.invite_code.toUpperCase()}
                </span>
                <button
                  onClick={copyInviteLink}
                  className="text-netflix-gray hover:text-white transition-colors"
                >
                  {copied ? 'Copied' : 'Copy invite link'}
                </button>
                <span className="text-netflix-gray">
                  {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              {activeSession ? (
                <button
                  onClick={handleContinueSession}
                  className="netflix-btn px-6 py-3"
                >
                  Continue Session - Round {activeSession.current_round}
                </button>
              ) : (
                <button
                  onClick={handleStartDecision}
                  className="netflix-btn px-6 py-3"
                >
                  Start Decision
                </button>
              )}
            </div>
          </div>

          {/* Search section */}
          <section className="mb-12">
            <h3 className="text-xl font-medium mb-4">Add Movies</h3>
            <MovieSearch onSelectMovie={handleMovieAdded} groupId={group.id} />
          </section>

          {/* Watchlist section */}
          <section>
            <h3 className="text-xl font-medium mb-4">
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
