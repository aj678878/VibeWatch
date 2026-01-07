import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VibeWatch',
  description: 'Collaborative movie decision-making for groups',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  )
}
