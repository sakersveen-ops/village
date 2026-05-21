'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// data-tour attributes wire up the AppTour spotlight to each nav element
  const navItems = [
    { href: '/',                 icon: 'home',      label: 'Hjem',         tour: 'feed' },
    { href: '/community/search', icon: 'community', label: 'Kretser',      tour: 'communities' },
    { href: '/',                 icon: 'home',      label: 'Hjem',          tour: 'feed' },
    { href: '/community/search', icon: 'community', label: 'Kretser',       tour: 'communities' },
    { href: '/add',              icon: null,         label: 'Del gjenstand', tour: 'add' },
    { href: '/schedule',         icon: 'schedule',  label: 'Avtaler',      tour: 'schedule' },
    { href: '/profile',          icon: 'profile',   label: 'Profil',       tour: 'profile' },
    { href: '/schedule',         icon: 'schedule',  label: 'Avtaler',       tour: 'schedule' },
    { href: '/profile',          icon: 'profile',   label: 'Profil',        tour: 'profile' },
  ]

const HIDE_ON = ['/login', '/signup', '/onboarding']

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Sjekk eksisterende session umiddelbart (dekker refresh-tilfellet)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setVisible(!!session)
    })

    // Abonner på auth-endringer — viser navbar øyeblikkelig etter første innlogging
    // uten at brukeren trenger å refreshe siden
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setVisible(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!visible || HIDE_ON.some(p => pathname.startsWith(p))) return null

  return (
    <>
      <nav className="bottom-nav glass">
        {NAV_ITEMS.map(item => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <button
              key={item.href}
              className={`nav-item${active ? ' active' : ''}`}
              onClick={() => router.push(item.href)}
              aria-label={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="nav-spacer" />
    </>
  )
}
