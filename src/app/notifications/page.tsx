// Path of this file: src/app/notifications/page.tsx
'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'
import { notifRefreshEvent } from '@/lib/events'

// Types that require explicit action — never auto-read
const ACTION_TYPES = new Set([
  'friend_request',
  'connection_request',
  'join_request',
])

// Types handled in message threads — filtered out at query level
const MESSAGE_THREAD_TYPES = [
  'loan_request',
  'loan_change_proposal',
  'loan_accepted',
  'loan_declined',
  'proposal_accepted',
  'proposal_declined',
  'loan_message',
]

function formatDate(d: string) {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (date.toDateString() === today.toDateString())
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === yesterday.toDateString()) return 'I går'
  return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function groupByDate(list: any[]) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups: Record<string, any[]> = {}
  for (const n of list) {
    const d = new Date(n.created_at).toDateString()
    const label =
      d === today ? 'I dag'
      : d === yesterday ? 'I går'
      : new Date(n.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return groups
}

const NotifIcon = ({ type }: { type: string }) => {
  if (['friend_accepted', 'join_accepted', 'connection_accepted'].includes(type)) return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
      <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
      <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (['join_declined', 'connection_disconnected'].includes(type)) return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" fill="var(--terra)" opacity="0.1"/>
      <circle cx="11" cy="11" r="9" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M8 8l6 6M14 8l-6 6" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'friend_request') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="8" cy="7" r="2.5" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M3 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 9v6M13 12h6" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'connection_request') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="6" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
      <circle cx="16" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M9 11h4" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'join_request') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M3 10.5L11 4l8 6.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="7" y="12" width="8" height="7" rx="1" stroke="var(--terra)" strokeWidth="1.5"/>
    </svg>
  )
  if (type === 'friend_wishlist') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M11 18s-7-5-7-9.5a4 4 0 0 1 7-2.6A4 4 0 0 1 18 8.5c0 4.5-7 9.5-7 9.5z" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M15 7l1.5 1.5 3-3" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'near_friend_marked') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M11 18s-7-5-7-9.5a4 4 0 0 1 7-2.6A4 4 0 0 1 18 8.5c0 4.5-7 9.5-7 9.5z" fill="var(--terra)" opacity="0.2" stroke="var(--terra)" strokeWidth="1.5"/>
    </svg>
  )
  if (type === 'near_friend_post') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="8" cy="7" r="2.5" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M3 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="13" y="10" width="7" height="8" rx="1.5" stroke="var(--terra)" strokeWidth="1.5"/>
    </svg>
  )
  if (type === 'community_update' || type === 'community_role_change') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M3 10.5L11 4l8 6.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" stroke="var(--terra)" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="8.5" y="13" width="5" height="7" rx="0.75" stroke="var(--terra)" strokeWidth="1.3"/>
    </svg>
  )
  if (type === 'import_ready') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="4" width="12" height="15" rx="1.5" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M7 8h6M7 11h4" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 14l-3 3-1.5-1.5" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'loan_start_owner' || type === 'loan_start_borrower') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="6" width="13" height="4" rx="1.5" fill="var(--terra)"/>
      <path d="M18 6v8" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 12l-2 2.5L16 12" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'loan_return_owner' || type === 'loan_return_borrower') return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="6" width="13" height="4" rx="1.5" fill="var(--terra)" opacity="0.5"/>
      <path d="M18 14V6" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 8l2-2.5L20 8" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M11 3a5 5 0 00-5 5v4l-1.5 2.5h13L16 12V8a5 5 0 00-5-5z" stroke="var(--terra)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 17.5a2 2 0 004 0" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

const btnAccept: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 99,
  background: 'var(--terra-green)', color: 'white', border: 'none', cursor: 'pointer',
}
const btnDecline: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 99,
  background: 'transparent', color: 'var(--terra-mid)',
  border: '1px solid rgba(107,122,130,0.35)', cursor: 'pointer',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [handled, setHandled] = useState<Map<string, 'accepted' | 'declined'>>(new Map())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  // Tracks IDs already queued for auto-read to prevent double-firing
  const seenRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const router = useRouter()

  // ── Mark a single notification as read ──────────────────────────────────
  const markNotifRead = useCallback(async (id: string) => {
    if (seenRef.current.has(id)) return
    seenRef.current.add(id)
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(x => x.id === id ? { ...x, read: true } : x))
    notifRefreshEvent?.dispatchEvent(new Event('refresh'))
  }, [])

  // ── IntersectionObserver: auto-read non-action cards on scroll ───────────
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const id = (entry.target as HTMLElement).dataset.notifId
          if (!id) return
          // Small delay so a fast scroll-past doesn't count
          setTimeout(() => {
            if (document.contains(entry.target)) markNotifRead(id)
          }, 800)
        })
      },
      { threshold: 0.8 },
    )
    return () => observerRef.current?.disconnect()
  }, [markNotifRead])

  // Attach IntersectionObserver to a card element (skip action cards)
  const observeCard = useCallback((el: HTMLElement | null, id: string, isAction: boolean) => {
    if (!el || isAction || seenRef.current.has(id)) return
    el.dataset.notifId = id
    observerRef.current?.observe(el)
  }, [])

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      const { data: prof } = await supabase
        .from('profiles').select('id, name').eq('id', user.id).single()
      setCurrentProfile(prof)

      const { data } = await supabase
        .from('notifications')
        .select(`*, loans(item_id, items(name), community_id, communities(name, avatar_emoji))`)
        .eq('user_id', user.id)
        // Never show message-thread types here
        .not('type', 'in', `(${MESSAGE_THREAD_TYPES.map(t => `"${t}"`).join(',')})`)
        // FIX: action types that are already read (= handled) are excluded from the feed.
        // Non-action types always show regardless of read state (they fade via dot indicator).
        .or(`type.not.in.(${[...ACTION_TYPES].map(t => `"${t}"`).join(',')}),read.eq.false`)
        .order('created_at', { ascending: false })

      setNotifications(data || [])
      // Pre-seed seenRef so already-read items don't re-trigger the observer
      ;(data || []).filter((n: any) => n.read).forEach((n: any) => seenRef.current.add(n.id))
      setLoading(false)
    }
    load()
  }, [])

  // Listen for "marked-all-read" fired by NavBar
  useEffect(() => {
    const handler = () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setHandled(new Map())
    }
    notifRefreshEvent?.addEventListener('marked-all-read', handler)
    return () => notifRefreshEvent?.removeEventListener('marked-all-read', handler)
  }, [])

  // ── Action handlers ──────────────────────────────────────────────────────
  const handleFriendRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const fromId = n.metadata?.from_id
    let req: any = null
    if (fromId) {
      const { data } = await supabase.from('friend_requests').select('id, from_id, status')
        .eq('to_id', user.id).eq('from_id', fromId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      req = data
    }
    if (!req) {
      const { data } = await supabase.from('friend_requests').select('id, from_id, status')
        .eq('to_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      req = data
    }
    if (req?.status === 'pending') {
      await supabase.from('friend_requests')
        .update({ status: accept ? 'accepted' : 'declined' }).eq('id', req.id)
    }
    if (accept && req) {
      await supabase.from('friendships').upsert([
        { user_a: user.id, user_b: req.from_id },
        { user_a: req.from_id, user_b: user.id },
      ], { onConflict: 'user_a,user_b', ignoreDuplicates: true })
      await supabase.from('notifications').insert({
        user_id: req.from_id, type: 'friend_accepted',
        title: 'Venneforespørsel godtatt!', body: 'Dere er nå venner',
      })
    }
    track(Events.FRIEND_REQUEST_HANDLED, { accepted: accept })
    await markNotifRead(n.id)
    setHandled(prev => new Map(prev).set(n.id, accept ? 'accepted' : 'declined'))
  }

  const handleConnectionRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: conn } = await supabase
      .from('profile_connections').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('status', 'pending').neq('initiated_by', user.id)
      .limit(1).single()
    if (!conn) return
    if (accept) {
      await supabase.from('profile_connections')
        .update({ status: 'active', accepted_at: new Date().toISOString() }).eq('id', conn.id)
      await supabase.from('items')
        .update({ connected_profile_id: conn.user_b === user.id ? conn.user_a : conn.user_b })
        .eq('owner_id', user.id)
      await supabase.from('items').update({ connected_profile_id: user.id }).eq('owner_id', conn.initiated_by)
      await supabase.from('notifications').insert({
        user_id: conn.initiated_by, type: 'connection_accepted',
        title: 'Tilkobling godtatt!',
        body: `${currentProfile?.name || currentUser?.email?.split('@')[0]} koblet til profilen din`,
        action_url: '/settings',
      })
      track(Events.CONNECTION_ACCEPTED, { connection_id: conn.id })
    } else {
      await supabase.from('profile_connections').update({ status: 'disconnected' }).eq('id', conn.id)
      track(Events.CONNECTION_DECLINED, { connection_id: conn.id })
    }
    await markNotifRead(n.id)
    setHandled(prev => new Map(prev).set(n.id, accept ? 'accepted' : 'declined'))
  }

  const handleJoinRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const requestId = n.metadata?.request_id
    if (requestId) {
      await supabase.from('join_requests')
        .update({ status: accept ? 'accepted' : 'declined' }).eq('id', requestId)
      if (accept) {
        const { data: req } = await supabase
          .from('join_requests').select('user_id, community_id').eq('id', requestId).single()
        if (req) {
          await supabase.from('community_members')
            .insert({ user_id: req.user_id, community_id: req.community_id })
          await supabase.from('notifications').insert({
            user_id: req.user_id, type: 'join_accepted',
            title: 'Du er med i kretsen!', body: 'Forespørselen din ble godtatt',
          })
        }
      }
    }
    await markNotifRead(n.id)
    setHandled(prev => new Map(prev).set(n.id, accept ? 'accepted' : 'declined'))
  }

  // ── Feed composition ─────────────────────────────────────────────────────
  const feed = useMemo(() => {
    const withReceipts = notifications.map(n =>
      handled.has(n.id)
        ? { ...n, _receipt: true, _outcome: handled.get(n.id), read: true }
        : n
    )
    const pendingActions = withReceipts.filter(n => ACTION_TYPES.has(n.type) && !n._receipt)
    const rest = withReceipts.filter(n => !ACTION_TYPES.has(n.type) || n._receipt)
    const byTime = (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return [...pendingActions.sort(byTime), ...rest.sort(byTime)]
  }, [notifications, handled])

  const groups = groupByDate(feed)

  // ── Card ─────────────────────────────────────────────────────────────────
  const NotifCard = ({ n }: { n: any }) => {
    const isAction = ACTION_TYPES.has(n.type) && !n._receipt
    const needsBorder = isAction && !n.read

    const outer: React.CSSProperties = {
      borderRadius: 14, overflow: 'hidden',
      borderLeft: needsBorder ? '3px solid var(--terra)' : undefined,
    }
    const inner: React.CSSProperties = {
      borderRadius: needsBorder ? '0 14px 14px 0' : 14,
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }

    const dot = !n.read && !isAction
      ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0 }} />
      : null

    const Meta = () => (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--terra-dark)', margin: 0, lineHeight: 1.3 }}>{n.title}</p>
          <span style={{ fontSize: 10, color: 'var(--terra-mid)', flexShrink: 0 }}>{formatDate(n.created_at)}</span>
        </div>
        {n.body && (
          <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '2px 0 0', lineHeight: 1.35 }}>{n.body}</p>
        )}
        {n.loans?.items?.name && (
          <p style={{ fontSize: 11, color: 'var(--terra-mid)', margin: '1px 0 0', fontStyle: 'italic' }}>{n.loans.items.name}</p>
        )}
      </div>
    )

    // Receipt card (just handled this session)
    if (n._receipt) return (
      <div ref={el => observeCard(el, n.id, false)} style={outer}>
        <div className="glass" style={inner}>
          <NotifIcon type={n.type} />
          <Meta />
          <span style={{
            fontSize: 11, fontWeight: 600, flexShrink: 0,
            color: n._outcome === 'accepted' ? 'var(--terra-green)' : 'var(--terra-mid)',
          }}>
            {n._outcome === 'accepted' ? '✓' : '✕'}
          </span>
        </div>
      </div>
    )

    // Action card (pending godta/avslå)
    if (isAction) return (
      <div style={outer}>
        <div className="glass" style={{ ...inner, flexWrap: 'wrap' as const }}>
          <NotifIcon type={n.type} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--terra-dark)', margin: 0, lineHeight: 1.3 }}>{n.title}</p>
              <span style={{ fontSize: 10, color: 'var(--terra-mid)', flexShrink: 0 }}>{formatDate(n.created_at)}</span>
            </div>
            {n.body && <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '2px 0 0' }}>{n.body}</p>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => {
                const h = n.type === 'friend_request' ? handleFriendRequest
                  : n.type === 'connection_request' ? handleConnectionRequest
                  : handleJoinRequest
                h(n, true)
              }} style={btnAccept}>✓ Godta</button>
              <button onClick={() => {
                const h = n.type === 'friend_request' ? handleFriendRequest
                  : n.type === 'connection_request' ? handleConnectionRequest
                  : handleJoinRequest
                h(n, false)
              }} style={btnDecline}>Avslå</button>
            </div>
          </div>
        </div>
      </div>
    )

    // Regular info card — tappable, auto-read on scroll
    const href =
      n.type === 'import_ready' ? (n.action_url ?? '/add')
      : ['connection_accepted', 'connection_disconnected'].includes(n.type) ? '/settings'
      : n.loans?.community_id ? `/community/${n.loans.community_id}`
      : n.loans?.item_id ? `/items/${n.loans.item_id}`
      : '#'

    return (
      <Link href={href}>
        <div ref={el => observeCard(el, n.id, false)} style={outer}>
          <div className="glass" style={inner}>
            <NotifIcon type={n.type} />
            <Meta />
            {dot}
          </div>
        </div>
      </Link>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // No <header> here — NavBar owns the top bar
  return (
    <div className="max-w-lg mx-auto" style={{ marginTop: 0 }}>
      <div style={{ padding: '0 14px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass" style={{ borderRadius: 14, height: 58, opacity: 0.4 }} />
          ))
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏘️</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen varsler ennå</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>Her dukker det opp varsler om venner, kretser og lån.</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'var(--terra-mid)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                {label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(n => <NotifCard key={n.id} n={n} />)}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="nav-spacer" />
    </div>
  )
}
