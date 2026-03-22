'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Village',
  '/community/search': 'Kretser',
  '/add': 'Del gjenstand',
  '/schedule': 'Mine avtaler',
  '/profile': 'Min profil',
}

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/items/manage')) return 'Mine gjenstander'
  if (pathname.startsWith('/items/')) return 'Gjenstand'
  if (pathname.startsWith('/profile/')) return 'Profil'
  if (pathname.startsWith('/community/')) return 'Krets'
  if (pathname.startsWith('/loans/')) return 'Lån'
  if (pathname.startsWith('/friends')) return 'Venner'
  if (pathname.startsWith('/invite')) return 'Inviter'
  if (pathname.startsWith('/settings')) return 'Innstillinger'
  return 'Village'
}

const ROOT_PATHS = ['/', '/community/search', '/add', '/schedule', '/profile']
function isRootPath(pathname: string) {
  return ROOT_PATHS.includes(pathname)
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

const iconBtnStyle = (active = false): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'rgba(196,103,58,0.18)' : 'rgba(196,103,58,0.10)',
  border: '1px solid rgba(196,103,58,0.15)',
  flexShrink: 0, textDecoration: 'none', cursor: 'pointer',
  color: 'var(--terra-dark, #2C1A0E)',
})

export default function NavBar() {
  const [unread, setUnread] = useState(0)
  const [hasUser, setHasUser] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const showBack = !isRootPath(pathname)

  useEffect(() => {
    setShowMenu(false)
  }, [pathname])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setHasUser(false); return }
      setHasUser(true)

      const [
        { count: notifCount },
        { data: pendingLoans },
        { data: loanRequestNotifs },
      ] = await Promise.all([
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
        supabase.from('loans').select('id').eq('owner_id', user.id).eq('status', 'pending'),
        supabase.from('notifications').select('loan_id').eq('user_id', user.id).eq('type', 'loan_request').eq('read', false),
      ])

      const coveredLoanIds = new Set((loanRequestNotifs || []).map((n: any) => n.loan_id))
      const uncoveredLoans = (pendingLoans || []).filter((l: any) => !coveredLoanIds.has(l.id)).length
      setUnread((notifCount || 0) + uncoveredLoans)

      return user.id
    }

    let channel: any = null

    load().then(userId => {
      if (!userId) return
      const supabase = createClient()
      channel = supabase
        .channel('navbar_notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => { load() })
        .subscribe()
    })

    const interval = setInterval(load, 30000)
    return () => {
      clearInterval(interval)
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!hasUser) return null
  if (pathname === '/login' || pathname === '/register' || pathname === '/onboarding') return null

  const title = getTitle(pathname)

  // data-tour attributes wire up the AppTour spotlight to each nav element
  const navItems = [
    { href: '/',                 icon: 'home',      label: 'Hjem',         tour: 'feed' },
    { href: '/community/search', icon: 'community', label: 'Kretser',      tour: 'communities' },
    { href: '/add',              icon: null,         label: 'Del gjenstand', tour: 'add' },
    { href: '/schedule',         icon: 'schedule',  label: 'Avtaler',      tour: 'schedule' },
    { href: '/profile',          icon: 'profile',   label: 'Profil',       tour: 'profile' },
  ]

  return (
    <>
      {/* ── Top bar ── */}
      <header
        className="page-header glass"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
      >
        {showBack ? (
          <button onClick={() => router.back()} aria-label="Tilbake" style={iconBtnStyle()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <Link href="/search" aria-label="Søk" style={iconBtnStyle()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
        )}

        <h1 className="page-header-title font-display">{title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Varsler — data-tour for top bar */}
          <Link href="/notifications" aria-label="Varsler" data-tour="notifications"
            style={{ ...iconBtnStyle(pathname === '/notifications'), position: 'relative' }}>
            <BellIcon />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: 'var(--terra, #C4673A)', color: 'white',
                fontSize: 9, fontWeight: 700,
                minWidth: 14, height: 14, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1,
                boxShadow: '0 0 0 2px rgba(250,247,242,0.9)',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          {/* Meldinger */}
          <Link href="/messages" aria-label="Meldinger" data-tour="messages"
            style={iconBtnStyle(pathname === '/messages')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </Link>

          {/* ··· meny */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(m => !m)} aria-label="Meny" style={iconBtnStyle(showMenu)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-11 z-50 rounded-2xl shadow-lg overflow-hidden w-44"
                  style={{ background: '#fff', border: '1px solid #E8DDD0' }}>
                  <Link href="/profile" onClick={() => setShowMenu(false)}>
                    <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ color: 'var(--terra-dark)' }}>
                      👤 Min profil
                    </div>
                  </Link>
                  <Link href="/settings" onClick={() => setShowMenu(false)}>
                    <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ color: 'var(--terra-dark)', borderTop: '1px solid #E8DDD0' }}>
                      ⚙️ Innstillinger
                    </div>
                  </Link>
                  <button onClick={signOut} className="w-full px-4 py-3 flex items-center gap-2 text-sm"
                    style={{ color: 'var(--terra)', borderTop: '1px solid #E8DDD0' }}>
                    🚪 Logg ut
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Bottom navigation ── */}
      <nav className="bottom-nav glass">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          if (!item.icon) {
            return (
              <Link key={item.href} href={item.href} data-tour={item.tour}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--terra, #C4673A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -20,
                  boxShadow: '0 4px 12px rgba(196,103,58,0.45)',
                  border: '3px solid rgba(250,247,242,0.9)',
                }}>
                  <span style={{ color: 'white', fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: -1 }}>+</span>
                </div>
                <span style={{ fontSize: 10, color: isActive ? 'var(--terra)' : 'var(--terra-mid)', fontWeight: isActive ? 600 : 400 }}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link key={item.href} href={item.href} data-tour={item.tour}
              className={`nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon === 'home' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isActive ? 'var(--terra)' : 'none'} stroke={isActive ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
                {item.icon === 'community' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {item.icon === 'schedule' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                {item.icon === 'profile' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isActive ? 'var(--terra)' : 'none'} stroke={isActive ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="nav-spacer" />
    </>
  )
}
