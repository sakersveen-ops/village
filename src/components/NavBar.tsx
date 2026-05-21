'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// SVG icon components
const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
)

const CommunityIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    <path d="M17 14c2.2.4 4 2.2 4 4.5" />
  </svg>
)

const AddIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
    <line x1="11" y1="4" x2="11" y2="18" />
    <line x1="4" y1="11" x2="18" y2="11" />
  </svg>
)

const ScheduleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="15" x2="8" y2="15" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="12" y1="15" x2="12" y2="15" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="16" y1="15" x2="16" y2="15" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

const ProfileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

// data-tour attributes wire up the AppTour spotlight to each nav element
const NAV_ITEMS = [
  { href: '/',                 icon: <HomeIcon />,      label: 'Hjem',         tour: 'feed' },
  { href: '/community/search', icon: <CommunityIcon />, label: 'Kretser',      tour: 'communities' },
  { href: '/add',              icon: <AddIcon />,       label: 'Del gjenstand', tour: 'add' },
  { href: '/schedule',         icon: <ScheduleIcon />,  label: 'Avtaler',      tour: 'schedule' },
  { href: '/profile',          icon: <ProfileIcon />,   label: 'Profil',       tour: 'profile' },
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
          if (item.tour === 'add') {
            return (
              <button
                key={item.href}
                data-tour={item.tour}
                className="nav-item"
                onClick={() => router.push(item.href)}
                aria-label={item.label}
                style={{ position: 'relative' }}
              >
                <span
                  className="nav-icon"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'var(--terra)',
                    boxShadow: '0 4px 16px rgba(46,98,113,0.35)',
                    marginTop: '-22px',
                    transform: 'none',
                  }}
                >
                  <AddIcon />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            )
          }

          return (
            <button
              key={item.href}
              data-tour={item.tour}
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
