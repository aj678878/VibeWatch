'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function JoinGroupPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const [preferredName, setPreferredName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isGuest, setIsGuest] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/groups/join/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferredName: preferredName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join group')
      }

      const data = await response.json()
      router.push(`/groups/${data.group.id}/watchlist`)
    } catch (error: any) {
      console.error('Error joining group:', error)
      setError(error.message || 'Failed to join group')
      setLoading(false)
    }
  }

  // Check if user is logged in (try to join as member first, fallback to guest)
  useEffect(() => {
    // Try joining without preferredName first (for logged-in users)
    fetch(`/api/groups/join/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => {
            router.push(`/groups/${data.group.id}/watchlist`)
          })
        } else {
          // Not logged in, show guest form
          setIsGuest(true)
        }
      })
      .catch(() => {
        setIsGuest(true)
      })
  }, [code, router])

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="px-4 sm:px-6 md:px-8 py-3 sm:py-4">
        <Link href="/groups">
          <h1 className="text-netflix-red text-xl sm:text-2xl font-bold tracking-tight">VIBEWATCH</h1>
        </Link>
      </header>

      <main className="flex items-center justify-center px-4 sm:px-6 pt-12 sm:pt-24 pb-8">
        <div className="w-full max-w-lg bg-card-bg rounded p-6 sm:p-8 md:p-12 animate-fade-in">
          <h2 className="text-xl sm:text-2xl font-medium mb-2">Join Group</h2>
          <p className="text-sm sm:text-base text-netflix-gray mb-4 sm:mb-6">Invite code: <span className="font-mono">{code.toUpperCase()}</span></p>

          {isGuest ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-2">
                  Your preferred name
                </label>
                <input
                  id="name"
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  required
                  minLength={1}
                  maxLength={50}
                  className="netflix-input w-full text-sm sm:text-base"
                  placeholder="Enter your name"
                />
                <p className="text-xs text-netflix-gray mt-1">
                  This name will be visible to other group members
                </p>
              </div>

              {error && (
                <div className="bg-netflix-red/20 text-netflix-red p-3 sm:p-4 rounded text-xs sm:text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !preferredName.trim()}
                className="netflix-btn w-full py-3 text-sm sm:text-base disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join as Guest'}
              </button>
            </form>
          ) : (
            <div>
              <p className="text-sm sm:text-base text-netflix-gray mb-4">You are logged in. Joining as member...</p>
              <button
                onClick={handleJoin}
                disabled={loading}
                className="netflix-btn w-full py-3 text-sm sm:text-base disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
