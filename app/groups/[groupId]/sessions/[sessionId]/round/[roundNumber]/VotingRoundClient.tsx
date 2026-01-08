'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import MovieCard from '@/components/MovieCard'

interface UserVote {
  movie_tmdb_id: number
  vote: 'yes' | 'no'
  reason_text: string | null
}

interface VotingRoundClientProps {
  sessionId: string
  roundNumber: number
  movieTmdbIds: number[]
  userVotes: UserVote[]
}

export default function VotingRoundClient({
  sessionId,
  roundNumber,
  movieTmdbIds,
  userVotes: initialUserVotes,
}: VotingRoundClientProps) {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string

  const [userVotes, setUserVotes] = useState<Record<number, UserVote>>(
    initialUserVotes.reduce((acc, vote) => {
      acc[vote.movie_tmdb_id] = vote
      return acc
    }, {} as Record<number, UserVote>)
  )
  const [loading, setLoading] = useState(false)
  const [roundId, setRoundId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [roundStatus, setRoundStatus] = useState<{
    participantsCompleted: number
    totalParticipants: number
    waitingForParticipants: number
    isComplete: boolean
  } | null>(null)
  const [participantsStatus, setParticipantsStatus] = useState<Array<{
    id: string
    type: 'member' | 'guest'
    displayName: string
    hasCompleted: boolean
  }>>([])

  // Poll for session status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`)
        if (response.ok) {
          const data = await response.json()
          setSessionStatus(data.session.status)
          setRoundId(data.currentRound.id)

          if (data.roundStatus) {
            setRoundStatus(data.roundStatus)
          }

          if (data.participantsStatus) {
            setParticipantsStatus(data.participantsStatus)
          }

          const votesMap: Record<number, UserVote> = {}
          data.userVotes.forEach((v: UserVote) => {
            votesMap[v.movie_tmdb_id] = v
          })
          setUserVotes(votesMap)

          if (data.session.status === 'completed') {
            router.push(`/groups/${groupId}/sessions/${sessionId}/results`)
            return
          }

          if (data.session.current_round > roundNumber) {
            router.push(
              `/groups/${groupId}/sessions/${sessionId}/round/${data.session.current_round}`
            )
            return
          }

          // Don't call next-round - vote submission route handles round completion
          // Just wait for status to change to 'completed' via polling
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }

    pollStatus()
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [sessionId, roundNumber, groupId, router])

  const handleVote = async (
    tmdbId: number,
    vote: 'yes' | 'no',
    reason?: string
  ) => {
    if (!roundId) return

    setLoading(true)
    try {
      const response = await fetch('/api/votes/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roundId,
          movieTmdbId: tmdbId,
          vote,
          reasonText: reason,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit vote')
      }

      setUserVotes((prev) => ({
        ...prev,
        [tmdbId]: {
          movie_tmdb_id: tmdbId,
          vote,
          reason_text: reason || null,
        },
      }))
    } catch (error) {
      console.error('Error submitting vote:', error)
      alert('Failed to submit vote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const allVoted = movieTmdbIds.every((id) => userVotes[id])
  const votedCount = Object.keys(userVotes).length

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark via-netflix-dark/95 to-transparent">
        <div className="flex justify-between items-center px-8 py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
          <div className="text-sm text-netflix-gray">
            Round {roundNumber} of 5
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-medium">Vote on Movies</h2>
              <span className="text-netflix-gray">
                {votedCount} of {movieTmdbIds.length} voted
              </span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-netflix-red transition-all duration-300"
                style={{ width: `${(votedCount / movieTmdbIds.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Participants status */}
          {participantsStatus.length > 0 && (
            <div className="bg-card-bg rounded p-4 mb-8">
              <h3 className="text-sm font-medium mb-3">Participants</h3>
              <div className="space-y-2">
                {participantsStatus.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          p.hasCompleted ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span>{p.displayName}</span>
                      {p.type === 'guest' && (
                        <span className="text-xs text-netflix-gray">Guest</span>
                      )}
                    </div>
                    <span className="text-netflix-gray">
                      {p.hasCompleted ? 'Done' : 'Voting...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status messages */}
          {allVoted && roundStatus && !roundStatus.isComplete && (
            <div className="bg-card-bg rounded p-4 mb-8 text-center">
              <p className="text-netflix-gray">
                You have voted on all movies. Waiting for {roundStatus.waitingForParticipants} other {roundStatus.waitingForParticipants === 1 ? 'participant' : 'participants'}...
              </p>
            </div>
          )}
          
          {roundStatus && roundStatus.isComplete && (
            <div className="bg-green-500/20 rounded p-4 mb-8 text-center">
              <p className="text-green-400">
                All participants have voted. Processing results...
              </p>
            </div>
          )}

          {/* Movie grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {movieTmdbIds.map((tmdbId) => (
              <MovieCard
                key={tmdbId}
                tmdbId={tmdbId}
                onVote={handleVote}
                userVote={userVotes[tmdbId] ? {
                  vote: userVotes[tmdbId].vote,
                  reason: userVotes[tmdbId].reason_text,
                } : undefined}
                disabled={loading || sessionStatus !== 'active'}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
