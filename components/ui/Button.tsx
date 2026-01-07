import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses =
    'font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border'

  const variantClasses = {
    primary: 'bg-white/10 hover:bg-white/20 border-white/20',
    secondary: 'bg-white/5 hover:bg-white/10 border-white/10',
    danger: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',
    success: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
