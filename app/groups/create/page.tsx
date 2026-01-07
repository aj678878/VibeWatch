'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateGroupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
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
      alert(`Failed to create group: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-light mb-8">Create Group</h1>

        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8">
          <p className="text-gray-300 mb-6">
            Create a new group to start deciding on movies together.
          </p>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
