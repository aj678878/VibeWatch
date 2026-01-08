'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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
      setError('Please describe what you are in the mood for')
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
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="px-8 py-4">
        <Link href="/groups">
          <h1 className="text-netflix-red text-2xl font-bold tracking-tight">VIBEWATCH</h1>
        </Link>
      </header>

      <main className="flex items-center justify-center px-4 pt-12">
        <div className="w-full max-w-2xl bg-card-bg rounded p-12 animate-fade-in">
          <Link
            href={`/groups/${groupId}/watchlist`}
            className="text-netflix-gray text-sm hover:text-white transition-colors inline-block mb-6"
          >
            Back to Watchlist
          </Link>

          <h2 className="text-3xl font-medium mb-2">Start a Decision</h2>
          <p className="text-netflix-gray mb-8">
            Describe what kind of movie everyone is in the mood for tonight
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="vibe"
                className="block text-sm font-medium mb-2"
              >
                What are you in the mood for?
              </label>
              <textarea
                id="vibe"
                value={vibeText}
                onChange={(e) => setVibeText(e.target.value)}
                required
                rows={4}
                className="netflix-input w-full resize-none"
                placeholder="e.g., Something funny and light, under 2 hours, in English"
              />
              <p className="text-xs text-netflix-gray mt-2">
                Be specific about genre, mood, length, language preferences
              </p>
            </div>

            {error && (
              <div className="bg-netflix-red/20 text-netflix-red p-4 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="netflix-btn w-full py-4 text-lg disabled:opacity-50"
            >
              {loading ? 'Finding Movies...' : 'Find Movies'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
