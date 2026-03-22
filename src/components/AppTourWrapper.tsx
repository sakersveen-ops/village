'use client'
import dynamic from 'next/dynamic'

const AppTour = dynamic(() => import('./AppTour'), { ssr: false })

export default function AppTourWrapper() {
  return <AppTour />
}
