import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Village',
  description: 'Lån og lån bort i kretsen din',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="bg-[#FAF7F2] min-h-screen">{children}</body>
    </html>
  )
}