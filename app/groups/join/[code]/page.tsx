'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function JoinGroupPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/groups/join/${code}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join group')
      }

      const { group } = await response.json()
      router.push(`/groups/${group.id}/watchlist`)
    } catch (error: any) {
      console.error('Error joining group:', error)
      setError(error.message || 'Failed to join group. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-light mb-8">Join Group</h1>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8">
          <p className="text-gray-300 mb-2">Invite Code:</p>
          <p className="text-2xl font-mono mb-6 text-white/80">{code}</p>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Join Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
