'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function NewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const [vibeText, setVibeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!vibeText.trim()) {
      setError('Please describe the vibe')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          vibeText: vibeText.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const { session } = await response.json()
      router.push(`/groups/${groupId}/sessions/${session.id}/round/1`)
    } catch (error: any) {
      console.error('Error creating session:', error)
      setError(error.message || 'Failed to create session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-light mb-8">Start Decision Session</h1>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="vibe"
                className="block text-sm font-light mb-2 text-gray-300"
              >
                Describe the vibe
              </label>
              <textarea
                id="vibe"
                value={vibeText}
                onChange={(e) => setVibeText(e.target.value)}
                required
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500 resize-none"
                placeholder="e.g., funny, light, under 2 hours, English"
              />
              <p className="text-xs text-gray-500 mt-2">
                Describe what kind of movie you&apos;re in the mood for
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starting...' : 'Start Decision'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
