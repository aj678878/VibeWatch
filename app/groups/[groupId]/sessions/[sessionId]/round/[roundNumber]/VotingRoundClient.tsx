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
  roundId: string
  roundNumber: number
  movieTmdbIds: number[]
  userVotes: UserVote[]
}

export default function VotingRoundClient({
  sessionId,
  roundId: initialRoundId,
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
  const [roundId, setRoundId] = useState<string>(initialRoundId)
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number>(roundNumber)
  const [currentMovieIds, setCurrentMovieIds] = useState<number[]>(movieTmdbIds)
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
    let interval: NodeJS.Timeout | null = null

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`)
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[CLIENT] Status poll failed: ${response.status}`, errorText)
          return
        }
        
        if (response.ok) {
          const data = await response.json()
          setSessionStatus(data.session.status)
          setRoundId(data.currentRound.id)
          setCurrentRoundNumber(data.session.current_round)
          setCurrentMovieIds(data.currentRound.movie_tmdb_ids || [])

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

          // If session is completed, redirect to results
          if (data.session.status === 'completed') {
            if (interval) clearInterval(interval)
            router.push(`/groups/${groupId}/sessions/${sessionId}/results`)
            return
          }

          // If we've moved to a new round, redirect to that round
          if (data.session.current_round > roundNumber) {
            if (interval) clearInterval(interval)
            router.push(
              `/groups/${groupId}/sessions/${sessionId}/round/${data.session.current_round}`
            )
            return
          }

          // If round is complete, poll more frequently (every 1.5 seconds) to catch
          // when server finishes processing (creates next round or completes session)
          if (data.roundStatus?.isComplete) {
            if (interval) {
              clearInterval(interval)
            }
            // Poll faster when waiting for server to process
            interval = setInterval(pollStatus, 1500)
            return
          }
        }
      } catch (error) {
        const errorDetails = {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
          context: { sessionId, roundNumber },
        }
        console.error('[CLIENT] Error polling status:', errorDetails)
        
        // Try to log to server (non-blocking)
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorDetails),
        }).catch(() => {
          // Ignore if logging endpoint doesn't exist
        })
      }
    }

    pollStatus()
    interval = setInterval(pollStatus, 3000)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sessionId, roundNumber, groupId, router])

  const handleVote = async (
    tmdbId: number,
    vote: 'yes' | 'no',
    reason?: string
  ) => {
    if (!roundId) {
      console.error('Cannot vote: roundId is missing')
      alert('Round ID is missing. Please refresh the page.')
      return
    }

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

      // Parse response first
      const result = await response.json().catch(() => ({ error: 'Failed to parse response' }))
      
      if (!response.ok) {
        // Check if vote was saved but recommendation failed
        const errorMessage = result.error || `Failed to submit vote (${response.status})`
        console.error('Vote submission error:', errorMessage, result)
        
        // If it's a recommendation error, the vote was likely saved
        if (result.error && result.error.includes('recommendation')) {
          console.warn('[CLIENT] Vote may have been saved but recommendation failed')
          // Still show error but indicate vote might be saved
          throw new Error(`${errorMessage}\n\nNote: Your vote may have been saved. Please refresh the page to check.`)
        }
        
        throw new Error(errorMessage)
      }

      console.log('Vote submitted successfully:', result)

      setUserVotes((prev) => ({
        ...prev,
        [tmdbId]: {
          movie_tmdb_id: tmdbId,
          vote,
          reason_text: reason || null,
        },
      }))
    } catch (error) {
      // Enhanced error logging
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote. Please try again.'
      const errorDetails = {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        context: {
          sessionId,
          roundId,
          roundNumber,
          movieTmdbId: tmdbId,
          vote,
        },
      }
      
      console.error('[CLIENT] Error submitting vote:', errorDetails)
      
      // Try to log to server for debugging (non-blocking)
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorDetails),
      }).catch(() => {
        // Ignore if logging endpoint doesn't exist
      })
      
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const allVoted = currentMovieIds.every((id) => userVotes[id])
  const votedCount = currentMovieIds.filter((id) => userVotes[id]).length

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark via-netflix-dark/95 to-transparent">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-xl sm:text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
          <div className="text-xs sm:text-sm text-netflix-gray">
            Round {currentRoundNumber} of 5
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 sm:pt-24 px-4 sm:px-6 md:px-8 pb-8 sm:pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Progress */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-medium">Vote on Movies</h2>
              <span className="text-sm sm:text-base text-netflix-gray">
                {votedCount} of {currentMovieIds.length} voted
              </span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-netflix-red transition-all duration-300"
                style={{ width: `${currentMovieIds.length > 0 ? (votedCount / currentMovieIds.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Participants status */}
          {participantsStatus.length > 0 && (
            <div className="bg-card-bg rounded p-3 sm:p-4 mb-6 sm:mb-8">
              <h3 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">Participants</h3>
              <div className="space-y-2">
                {participantsStatus.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          p.hasCompleted ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="truncate">{p.displayName}</span>
                      {p.type === 'guest' && (
                        <span className="text-xs text-netflix-gray flex-shrink-0">Guest</span>
                      )}
                    </div>
                    <span className="text-netflix-gray flex-shrink-0 ml-2">
                      {p.hasCompleted ? 'Done' : 'Voting...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status messages */}
          {allVoted && roundStatus && !roundStatus.isComplete && (
            <div className="bg-card-bg rounded p-3 sm:p-4 mb-6 sm:mb-8 text-center">
              <p className="text-xs sm:text-sm text-netflix-gray">
                You have voted on all movies. Waiting for {roundStatus.waitingForParticipants} other {roundStatus.waitingForParticipants === 1 ? 'participant' : 'participants'}...
              </p>
            </div>
          )}
          
          {roundStatus && roundStatus.isComplete && (
            <div className="bg-green-500/20 rounded p-3 sm:p-4 mb-6 sm:mb-8 text-center">
              <p className="text-xs sm:text-sm text-green-400">
                All participants have voted. Processing results...
              </p>
            </div>
          )}

          {/* Movie grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {currentMovieIds.map((tmdbId) => (
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
