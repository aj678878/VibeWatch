'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

  // Poll for session status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`)
        if (response.ok) {
          const data = await response.json()
          setSessionStatus(data.session.status)
          setRoundId(data.currentRound.id)

          // Update user votes
          const votesMap: Record<number, UserVote> = {}
          data.userVotes.forEach((v: UserVote) => {
            votesMap[v.movie_tmdb_id] = v
          })
          setUserVotes(votesMap)

          // If session is completed, redirect to results
          if (data.session.status === 'completed') {
            router.push(`/groups/${groupId}/sessions/${sessionId}/results`)
            return
          }

          // If round has advanced, redirect to new round
          if (data.session.current_round > roundNumber) {
            router.push(
              `/groups/${groupId}/sessions/${sessionId}/round/${data.session.current_round}`
            )
            return
          }

          // Check if all members have voted and trigger next round or final resolution
          if (data.hasVotedOnAll && data.session.status === 'active') {
            // Call next-round endpoint to check consensus and progress
            fetch(`/api/sessions/${sessionId}/next-round`, {
              method: 'POST',
            }).catch(console.error)
          }
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }

    // Initial fetch
    pollStatus()

    // Poll every 3 seconds
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

      // Update local state
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-light mb-2">Round {roundNumber}</h1>
          <p className="text-gray-400">
            Vote Yes or No on each movie. You can optionally provide a reason
            for No votes.
          </p>
        </div>

        {allVoted && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
            You've voted on all movies. Waiting for other members...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {movieTmdbIds.map((tmdbId) => (
            <MovieCard
              key={tmdbId}
              tmdbId={tmdbId}
              onVote={handleVote}
              userVote={userVotes[tmdbId]}
              disabled={loading || sessionStatus !== 'active'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
