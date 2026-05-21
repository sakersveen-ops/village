'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Village',
  '/community/search': 'Kretser',
  '/add': 'Del gjenstand',
  '/schedule': 'Mine avtaler',
  '/profile': 'Min profil',
  '/notifications': 'Varsler',
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

const iconBtnStyle = (active = false): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'rgba(46,98,113,0.18)' : 'rgba(46,98,113,0.08)',
  border: '1px solid rgba(46,98,113,0.15)',
  flexShrink: 0, textDecoration: 'none',
  cursor: 'pointer',
  color: 'var(--terra-dark)',
  transition: 'opacity 150ms ease, transform 150ms ease',
})

// Shared event so NotificationsPage can trigger a re-fetch of unread count
export const notifRefreshEvent =
  typeof window !== 'undefined' ? new EventTarget() : null

// SVG nav icons
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'var(--terra)' : 'none'} stroke={active ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const CommunityIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const ScheduleIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'var(--terra)' : 'none'} stroke={active ? 'var(--terra)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export default function NavBar() {
  const [unread, setUnread] = useState(0)
  const [hasUser, setHasUser] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const showBack = !isRootPath(pathname)
  const isNotificationsPage = pathname === '/notifications'

  const loadUnread = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHasUser(false); return undefined }
    setHasUser(true)

    const ACTION_TYPES = ['friend_request', 'connection_request', 'join_request']
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .in('type', ACTION_TYPES)

    setUnread(count || 0)
    return user.id
  }, [])

  useEffect(() => {
    setShowMenu(false)
  }, [pathname])

  useEffect(() => {
    let channel: any = null

    loadUnread().then(userId => {
      if (!userId) return
      const supabase = createClient()
      channel = supabase
        .channel('navbar_notifications')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, () => loadUnread())
        .subscribe()
    })

    const handler = () => loadUnread()
    notifRefreshEvent?.addEventListener('refresh', handler)

    const interval = setInterval(loadUnread, 30000)
    return () => {
      clearInterval(interval)
      notifRefreshEvent?.removeEventListener('refresh', handler)
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [loadUnread])

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnread(0)
      notifRefreshEvent?.dispatchEvent(new Event('marked-all-read'))
    }
    setMarkingAll(false)
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!hasUser) return null
  if (pathname === '/login' || pathname === '/register' || pathname === '/onboarding') return null

  const title = getTitle(pathname)

  const navItems = [
    { href: '/',                 label: 'Hjem',          tour: 'feed' },
    { href: '/community/search', label: 'Kretser',       tour: 'communities' },
    { href: '/add',              label: 'Del gjenstand', tour: 'add', isAdd: true },
    { href: '/schedule',         label: 'Avtaler',       tour: 'schedule' },
    { href: '/profile',          label: 'Profil',        tour: 'profile' },
  ]

  return (
    <>
      <style>{`
        .navbar-icon-btn:hover { opacity: 0.7; }
        .navbar-icon-btn:active { transform: scale(0.92); }
        .nav-item { cursor: pointer; transition: opacity 150ms ease, transform 150ms ease; }
        .nav-item:hover { opacity: 0.7; }
        .nav-item:active { transform: scale(0.93); }
        .nav-add-btn { cursor: pointer; transition: opacity 150ms ease; }
        .nav-add-btn:hover .nav-add-circle { box-shadow: 0 6px 20px rgba(46,98,113,0.5); transform: scale(1.07) translateY(-2px); }
        .nav-add-btn:active .nav-add-circle { transform: scale(0.95) translateY(0); }
        .nav-add-circle { transition: transform 150ms ease, box-shadow 150ms ease; }
      `}</style>

      {/* ── Top bar ── */}
      <header
        className="page-header glass"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
      >
        {/* Left: back or search */}
        {showBack ? (
          <button onClick={() => router.back()} aria-label="Tilbake" className="navbar-icon-btn" style={iconBtnStyle()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <Link href="/search" aria-label="Søk" className="navbar-icon-btn" style={iconBtnStyle()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
        )}

        {/* Centre: title */}
        <h1 className="page-header-title font-display">{title}</h1>

        {/* Right: context-aware actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {isNotificationsPage ? (
            unread > 0 ? (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: '6px 14px', borderRadius: 99,
                  background: 'var(--terra)', color: 'white',
                  border: 'none', cursor: 'pointer',
                  opacity: markingAll ? 0.55 : 1,
                  transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {markingAll ? '…' : 'Merk alle som lest'}
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )
          ) : (
            <Link href="/notifications" aria-label="Varsler" data-tour="notifications"
              className="navbar-icon-btn"
              style={{ ...iconBtnStyle(pathname === '/notifications'), position: 'relative' }}>
              <BellIcon />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'var(--terra)', color: 'white',
                  fontSize: 9, fontWeight: 700,
                  minWidth: 14, height: 14, borderRadius: 7,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1,
                  boxShadow: '0 0 0 2px rgba(252,254,255,0.9)',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}

          <Link href="/messages" aria-label="Meldinger" data-tour="messages"
            className="navbar-icon-btn"
            style={iconBtnStyle(pathname === '/messages')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </Link>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(m => !m)} aria-label="Meny"
              className="navbar-icon-btn"
              style={iconBtnStyle(showMenu)}>
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
                  style={{ background: 'var(--glass-bg-heavy)', border: '1px solid var(--glass-border)' }}>
                  <Link href="/profile" onClick={() => setShowMenu(false)}>
                    <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ color: 'var(--terra-dark)' }}>
                      👤 Min profil
                    </div>
                  </Link>
                  <Link href="/settings" onClick={() => setShowMenu(false)}>
                    <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ color: 'var(--terra-dark)', borderTop: '1px solid var(--glass-border)' }}>
                      ⚙️ Innstillinger
                    </div>
                  </Link>
                  <button onClick={signOut} className="w-full px-4 py-3 flex items-center gap-2 text-sm"
                    style={{ color: 'var(--terra)', borderTop: '1px solid var(--glass-border)', cursor: 'pointer' }}>
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
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          if (item.isAdd) {
            return (
              <Link key={item.href} href={item.href} data-tour={item.tour}
                className="nav-add-btn"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
                <div className="nav-add-circle" style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--terra)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -20,
                  boxShadow: '0 4px 14px rgba(46,98,113,0.4)',
                  border: '3px solid rgba(252,254,255,0.9)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="11" y1="4" x2="11" y2="18" />
                    <line x1="4" y1="11" x2="18" y2="11" />
                  </svg>
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
                {item.href === '/' && <HomeIcon active={isActive} />}
                {item.href === '/community/search' && <CommunityIcon active={isActive} />}
                {item.href === '/schedule' && <ScheduleIcon active={isActive} />}
                {item.href === '/profile' && <ProfileIcon active={isActive} />}
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
