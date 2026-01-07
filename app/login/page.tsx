'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
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
    // Use NEXT_PUBLIC_APP_URL if set (for production), otherwise use current origin
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      : `${window.location.origin}/auth/callback`
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="w-full max-w-md p-8">
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8 shadow-2xl">
          <h1 className="text-3xl font-light mb-2 text-center">VibeWatch</h1>
          <p className="text-sm text-gray-400 text-center mb-8">
            Collaborative movie decision-making
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-light mb-2 text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>

            {message && (
              <p
                className={`text-sm text-center ${
                  message.includes('Check your email')
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
