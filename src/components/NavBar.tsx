'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Map routes to display titles shown in top bar
const PAGE_TITLES: Record<string, string> = {
  '/': 'Hjem',
  '/community/search': 'Kretser',
  '/add': 'Legg ut',
  '/notifications': 'Varsler',
  '/profile': 'Min profil',
}

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/items/')) return 'Gjenstand'
  if (pathname.startsWith('/profile/')) return 'Profil'
  if (pathname.startsWith('/community/')) return 'Krets'
  if (pathname.startsWith('/loans/')) return 'Lån'
  return 'Village'
}

export default function NavBar() {
  const [unread, setUnread] = useState(0)
  const [hasUser, setHasUser] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHasUser(false)
        return
      }
      setHasUser(true)

      // Count unread notifications AND pending loan requests (unanswered)
      const [{ count: notifCount }, { count: loanCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
        supabase
          .from('loans')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('status', 'pending'),
      ])

      setUnread((notifCount || 0) + (loanCount || 0))
    }
    load()

    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Don't render nav on auth pages
  if (!hasUser) return null
  if (pathname === '/login' || pathname === '/register' || pathname === '/onboarding') return null

  const title = getTitle(pathname)

  const navItems = [
    { href: '/', icon: '🏠', label: 'Hjem' },
    { href: '/community/search', icon: '🏘️', label: 'Kretser' },
    { href: '/add', icon: null, label: 'Legg ut' }, // special CTA button
    { href: '/notifications', icon: '🔔', label: 'Varsler', badge: unread },
    { href: '/profile', icon: '👤', label: 'Min profil' },
  ]

  return (
    <>
      {/* ── Top bar ── */}
      <header
        className="page-header glass"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          borderRadius: '0 0 20px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}
      >
        {/* Left: Search */}
        <Link
          href="/search"
          aria-label="Søk"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(196,103,58,0.10)',
            border: '1px solid rgba(196,103,58,0.15)',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>

        {/* Center: Page title */}
        <h1
          className="page-header-title font-display"
          style={{
            margin: 0,
            fontSize: 'clamp(18px, 5vw, 22px)',
            color: 'var(--terra-dark, #2C1A0E)',
            letterSpacing: '-0.025em',
            fontWeight: 700,
          }}
        >
          {title}
        </h1>

        {/* Right: Messages */}
        <Link
          href="/messages"
          aria-label="Meldinger"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(196,103,58,0.10)',
            border: '1px solid rgba(196,103,58,0.15)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
      </header>

      {/* ── Bottom navigation ── */}
      <nav
        className="bottom-nav glass"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 12px 12px',
          borderRadius: 24,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '8px 4px',
        }}
      >
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          // Special CTA button (Legg ut)
          if (!item.icon) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5"
                style={{ flex: 1, textDecoration: 'none' }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--terra, #C4673A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: -20,
                    boxShadow: '0 4px 12px rgba(196,103,58,0.45)',
                    border: '3px solid rgba(250,247,242,0.9)',
                  }}
                >
                  <span style={{ color: 'white', fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: -1 }}>+</span>
                </div>
                <span style={{ fontSize: 10, color: isActive ? 'var(--terra, #C4673A)' : 'var(--terra-mid, #9C7B65)', fontWeight: isActive ? 600 : 400 }}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                textDecoration: 'none',
                padding: '4px 0',
                borderRadius: 16,
                position: 'relative',
                // Shading for active item
                background: isActive ? 'rgba(196,103,58,0.10)' : 'transparent',
                transition: 'background 200ms ease',
              }}
            >
              <span
                className="nav-icon"
                style={{
                  fontSize: 20,
                  lineHeight: 1,
                  display: 'block',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 200ms ease',
                }}
              >
                {item.icon}
              </span>

              {/* Badge */}
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: '18%',
                    background: 'var(--terra, #C4673A)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                  }}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}

              <span
                className="nav-label"
                style={{
                  fontSize: 10,
                  color: isActive ? 'var(--terra, #C4673A)' : 'var(--terra-mid, #9C7B65)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'color 200ms ease',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Spacer so content isn't hidden behind fixed nav */}
      <div className="nav-spacer" style={{ height: 80 }} />
    </>
  )
}
