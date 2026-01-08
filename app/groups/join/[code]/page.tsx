'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function JoinGroupPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        setError(error.message || 'Failed to join group')
        setLoading(false)
      }
    }

    autoJoin()
  }, [code, router])

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="px-8 py-4">
        <Link href="/groups">
          <h1 className="text-netflix-red text-2xl font-bold tracking-tight">VIBEWATCH</h1>
        </Link>
      </header>

      <main className="flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-lg bg-card-bg rounded p-12 text-center animate-fade-in">
          {loading ? (
            <>
              <div className="w-12 h-12 border-4 border-netflix-red border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl font-medium mb-2">Joining Group</h2>
              <p className="text-netflix-gray">Code: {code.toUpperCase()}</p>
            </>
          ) : error ? (
            <>
              <h2 className="text-2xl font-medium mb-4 text-netflix-red">Unable to Join</h2>
              <p className="text-netflix-gray mb-6">{error}</p>
              <Link href="/groups" className="netflix-btn px-8 py-3 inline-block">
                Back to Groups
              </Link>
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
