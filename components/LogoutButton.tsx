'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-light text-sm transition-colors"
    >
      Logout
    </button>
  )
}
