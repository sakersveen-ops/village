import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import AppTourWrapper from '@/components/AppTourWrapper'
import FeedbackButton from '@/components/FeedbackButton'
import Script from 'next/script'
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
      <body className={`${fraunces.variable} min-h-screen`}>
        <NavBar />
        {children}
        <AppTourWrapper />
        <FeedbackButton />
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}