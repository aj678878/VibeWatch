'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function JoinGroupPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Auto-join on page load
  useEffect(() => {
    const autoJoin = async () => {
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
        setLoading(false)
      }
    }

    autoJoin()
  }, [code, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-light mb-8">Join Group</h1>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8">
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-400">Joining group...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
