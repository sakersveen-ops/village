import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Village',
  description: 'Lån og lån bort i kretsen din',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="bg-[#FAF7F2] min-h-screen">
        {children}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DDD0] flex justify-around items-center py-3 z-20">
        <Link href="/" className="flex flex-col items-center gap-1">
          <span className="text-xl">🏠</span>
          <span className="text-xs text-[#9C7B65]">Feed</span>
        </Link>
        <Link href="/community/search" className="flex flex-col items-center gap-1">
          <span className="text-xl">🏘️</span>
          <span className="text-xs text-[#9C7B65]">Communities</span>
        </Link>
        <Link href="/add" className="flex flex-col items-center gap-1">
          <span className="text-xl">➕</span>
          <span className="text-xs text-[#9C7B65]">Legg ut</span>
        </Link>
        <Link href="/notifications" className="flex flex-col items-center gap-1">
          <span className="text-xl">🔔</span>
          <span className="text-xs text-[#9C7B65]">Varsler</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1">
          <span className="text-xl">👤</span>
          <span className="text-xs text-[#9C7B65]">Min side</span>
        </Link>
      </nav>
      </body>
    </html>
  )
}