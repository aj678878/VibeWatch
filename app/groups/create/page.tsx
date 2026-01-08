'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateGroupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/groups/create', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create group')
      }

      const { group } = await response.json()
      router.push(`/groups/${group.id}/watchlist`)
    } catch (error: any) {
      console.error('Error creating group:', error)
      setError(error.message || 'Failed to create group')
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
        <div className="w-full max-w-lg bg-card-bg rounded p-12 animate-fade-in">
          <Link
            href="/groups"
            className="text-netflix-gray text-sm hover:text-white transition-colors inline-block mb-6"
          >
            Back to Groups
          </Link>
          
          <h2 className="text-3xl font-medium mb-4">Create a Group</h2>
          <p className="text-netflix-gray mb-8">
            Start a new watch group and invite friends to decide on movies together.
          </p>

          {error && (
            <div className="bg-netflix-red/20 text-netflix-red p-4 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="netflix-btn w-full py-4 text-lg disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </main>
    </div>
  )
}
