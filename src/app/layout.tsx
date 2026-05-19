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
  title: 'Village',
  description: 'Del og lån med naboer, venner og resten av kretsen din!',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Village',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Village',
    description: 'Del og lån med naboer, venner og resten av kretsen din!',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    siteName: 'Village',
    locale: 'nb_NO',
  },
}

export const viewport = {
  themeColor: '#C4673A',
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

