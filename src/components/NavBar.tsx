'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/',              icon: '🏠', label: 'Hjem'     },
  { href: '/search',        icon: '🔍', label: 'Søk'      },
  { href: '/add',           icon: '＋', label: 'Legg ut'  },
  { href: '/notifications', icon: '🔔', label: 'Varsler'  },
  { href: '/profile',       icon: '👤', label: 'Profil'   },
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
