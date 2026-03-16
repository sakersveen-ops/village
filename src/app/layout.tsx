import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import { Fraunces } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'It takes a VILLAGE',
  description: 'Lån og lån bort i kretsen din',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className={`${fraunces.variable} bg-[#FAF7F2] min-h-screen`}>
        {children}
        <NavBar />
      </body>
    </html>
  )
}