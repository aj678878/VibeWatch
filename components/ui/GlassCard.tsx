import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={`backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-6 ${
        hover ? 'hover:bg-white/10 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
