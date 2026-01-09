'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    const errorMessage = searchParams.get('message')
    if (error === 'auth_failed') {
      setMessage(
        errorMessage
          ? `Authentication failed: ${decodeURIComponent(errorMessage)}`
          : 'Authentication failed. Please try again.'
      )
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const redirectUrl = `${window.location.origin}/auth/callback`
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the sign in link')
    }
    setLoading(false)
  }

  const handleDemoLogin = async () => {
    setDemoLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        window.location.href = '/groups'
      } else {
        setMessage(data.error || 'Demo login failed')
      }
    } catch (error) {
      setMessage('Demo login failed. Please try again.')
    }
    setDemoLoading(false)
  }

  return (
    <div className="min-h-screen bg-netflix-dark flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        <h1 className="text-netflix-red text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">VIBEWATCH</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-4 sm:py-8">
        <div className="w-full max-w-md bg-black/75 rounded p-6 sm:p-10 md:p-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-medium mb-5 sm:mb-7">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="netflix-input w-full"
                placeholder="Email address"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="netflix-btn w-full py-3 text-base disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Sign In Link'}
            </button>

            {message && (
              <p
                className={`text-sm ${
                  message.includes('Check your email')
                    ? 'text-green-500'
                    : 'text-netflix-red'
                }`}
              >
                {message}
              </p>
            )}
          </form>

          <div className="mt-8 pt-8 border-t border-gray-700">
            <p className="text-netflix-gray text-sm mb-4">Quick access for demos</p>
            <button
              onClick={handleDemoLogin}
              disabled={demoLoading}
              className="netflix-btn-secondary w-full py-3 text-base disabled:opacity-50"
            >
              {demoLoading ? 'Loading...' : 'Continue as Guest'}
            </button>
          </div>

          <p className="text-netflix-gray text-sm mt-8">
            New to VibeWatch? Create groups and decide on movies together with friends.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-netflix-gray text-sm">
        <p>Group movie decision making</p>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-netflix-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
