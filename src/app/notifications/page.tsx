'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'

const ACTION_TYPES = new Set([
  'loan_request',
  'loan_change_proposal',
  'friend_request',
  'connection_request',
  'join_request',
])

type FilterCategory = 'all' | 'mine_items' | 'their_items' | 'friends' | 'communities'

const CATEGORY_TYPES: Record<FilterCategory, string[]> = {
  all:         [],
  mine_items:  ['loan_request', 'loan_change_proposal'],
  their_items: ['loan_accepted', 'loan_declined', 'proposal_accepted', 'proposal_declined', 'loan_message'],
  friends:     ['friend_request', 'friend_accepted', 'connection_request', 'connection_accepted', 'connection_disconnected'],
  communities: ['join_request', 'join_accepted', 'join_declined'],
}

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  all:         'Alle',
  mine_items:  'Mine gjenstander',
  their_items: 'Andres gjenstander',
  friends:     'Venner',
  communities: 'Kretser',
}

const NotifIcon = ({ type }: { type: string }) => {
  if (type === 'loan_request' || type === 'loan_change_proposal') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="13" width="14" height="3" rx="1.5" fill="var(--terra)" opacity="0.25"/>
      <rect x="4" y="9" width="12" height="3" rx="1.5" fill="var(--terra)" opacity="0.45"/>
      <rect x="3" y="5" width="13" height="4" rx="1.5" fill="var(--terra)"/>
      <path d="M18 5v10" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 15l-2 2.5L16 15" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (['loan_accepted','proposal_accepted','join_accepted','connection_accepted'].includes(type)) return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
      <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
      <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (['loan_declined','proposal_declined','join_declined'].includes(type)) return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" fill="var(--terra)" opacity="0.1"/>
      <circle cx="11" cy="11" r="9" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M8 8l6 6M14 8l-6 6" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'friend_request') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 14c0-2.5 1.5-4 3.5-4h1L11 8h2l2 2h1c2 0 3 1.5 3 3" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 10l-3 3.5c-.5.6-.3 1.5.5 1.8l6 2.5c.7.3 1.4 0 1.7-.7l2-4.6" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.5 12l2.5 3c.5.7 0 1.6-.8 1.6H14" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="5.5" r="1.5" fill="var(--terra)" opacity="0.5"/>
      <circle cx="13" cy="5.5" r="1.5" fill="var(--terra)" opacity="0.5"/>
    </svg>
  )
  if (type === 'friend_accepted') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="8" cy="7" r="2.5" stroke="var(--terra-green)" strokeWidth="1.5"/>
      <path d="M3 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 10l1.5 1.5 3-3" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'join_request') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 10.5L11 4l8 6.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="7" y="12" width="8" height="7" rx="1" stroke="var(--terra)" strokeWidth="1.5"/>
      <rect x="9.5" y="15" width="3" height="4" rx="0.5" fill="var(--terra)" opacity="0.35"/>
    </svg>
  )
  if (['connection_request','connection_disconnected'].includes(type)) return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="6" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
      <circle cx="16" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
      <path d="M9 11h4" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'loan_message') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M19 13a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3a5 5 0 00-5 5v4l-1.5 2.5h13L16 12V8a5 5 0 00-5-5z" stroke="var(--terra)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 17.5a2 2 0 004 0" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function groupByDate(list: any[]) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups: Record<string, any[]> = {}
  for (const n of list) {
    const d = new Date(n.created_at).toDateString()
    const label = d === today ? 'I dag'
      : d === yesterday ? 'I går'
      : new Date(n.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return groups
}

function deduplicateActions(list: any[]): any[] {
  const seenLoanIds = new Set<string>()
  const result: any[] = []
  for (const n of list) {
    if (n.loan_id) {
      if (seenLoanIds.has(n.loan_id)) continue
      seenLoanIds.add(n.loan_id)
    }
    result.push(n)
  }
  return result
}

// Inline button styles — safe fallback independent of globals.css cascade
const btnAccept: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 99,
  background: 'var(--terra-green)', color: 'white', border: 'none', cursor: 'pointer',
}
const btnDecline: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 99,
  background: 'transparent', color: 'var(--terra-mid)',
  border: '1px solid rgba(156,123,101,0.35)', cursor: 'pointer',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [tab, setTab] = useState<'actions' | 'updates'>('actions')
  const [filter, setFilter] = useState<FilterCategory>('all')
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [handled, setHandled] = useState<Map<string, 'accepted' | 'declined'>>(new Map())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      const { data: prof } = await supabase.from('profiles').select('id, name').eq('id', user.id).single()
      setCurrentProfile(prof)

      const { data } = await supabase
        .from('notifications')
        .select(`*, loans(item_id, items(name), community_id, communities(name, avatar_emoji))`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])

      // Only auto-mark non-action types as read on page visit
      const actionList = Array.from(ACTION_TYPES).map(t => `"${t}"`).join(',')
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .not('type', 'in', `(${actionList})`)

      setLoading(false)
    }
    load()
  }, [])

  const markNotifRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(x => x.id === id ? { ...x, read: true } : x))
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  const handleFriendRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Try to find the specific request using from_id in notification metadata
    const fromId = n.metadata?.from_id
    let req: any = null

    if (fromId) {
      const { data } = await supabase
        .from('friend_requests').select('id, from_id, status')
        .eq('to_id', user.id).eq('from_id', fromId)
        .order('created_at', { ascending: false }).limit(1).single()
      req = data
    }

    // Fallback: latest pending request
    if (!req) {
      const { data } = await supabase
        .from('friend_requests').select('id, from_id, status')
        .eq('to_id', user.id).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).single()
      req = data
    }

    if (req && req.status === 'pending') {
      await supabase.from('friend_requests')
        .update({ status: accept ? 'accepted' : 'declined' }).eq('id', req.id)
    }

    if (accept && req) {
      // upsert both directions — safe if friendship already exists
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

  // --- Derived lists ---
  const rawActions = useMemo(
    () => deduplicateActions(notifications.filter(n => ACTION_TYPES.has(n.type) && !handled.has(n.id))),
    [notifications, handled]
  )

  const rawUpdates = useMemo(() => {
    const receipts = notifications
      .filter(n => handled.has(n.id))
      .map(n => ({ ...n, _receipt: true, _outcome: handled.get(n.id), read: true }))
    return [
      ...receipts,
      ...notifications.filter(n => !ACTION_TYPES.has(n.type)),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [notifications, handled])

  const applyFilter = (list: any[]) =>
    filter === 'all' ? list : list.filter(n => CATEGORY_TYPES[filter].includes(n.type))

  const actions = applyFilter(rawActions)
  const updates = applyFilter(rawUpdates)
  const unreadActions = rawActions.filter(n => !n.read).length
  const unreadUpdates = rawUpdates.filter(n => !n.read).length
  const currentUnread = tab === 'actions' ? unreadActions : unreadUpdates
  const current = tab === 'actions' ? actions : updates
  const groups = groupByDate(current)

  const availableFilters = useMemo<FilterCategory[]>(() => {
    const base = tab === 'actions' ? rawActions : rawUpdates
    return (['all', 'mine_items', 'their_items', 'friends', 'communities'] as FilterCategory[])
      .filter(cat => cat === 'all' || base.some(n => CATEGORY_TYPES[cat].includes(n.type)))
  }, [tab, rawActions, rawUpdates])

  const handleTabSwitch = (t: 'actions' | 'updates') => {
    setTab(t)
    setFilter('all')
  }

  // --- Card ---
  const NotifCard = ({ n }: { n: any }) => {
    const needsBorder = tab === 'actions' && !n.read
    const outerStyle: React.CSSProperties = {
      borderRadius: '16px', overflow: 'hidden',
      borderLeft: needsBorder ? '3px solid var(--terra)' : undefined,
    }
    const innerStyle: React.CSSProperties = {
      borderRadius: needsBorder ? '0 16px 16px 0' : '16px',
      padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '12px',
    }
    const dot = !n.read
      ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />
      : null

    if (n._receipt) return (
      <div style={outerStyle}>
        <div className="glass" style={innerStyle}>
          <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
            <p style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: n._outcome === 'accepted' ? 'var(--terra-green)' : 'var(--terra-mid)' }}>
              {n._outcome === 'accepted' ? '✓ Godtatt' : '✕ Avslått'}
            </p>
          </div>
        </div>
      </div>
    )

    if (n.type === 'friend_request') return (
      <div style={outerStyle}>
        <div className="glass" style={innerStyle}>
          <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => handleFriendRequest(n, true)} style={btnAccept}>✓ Godta</button>
              <button onClick={() => handleFriendRequest(n, false)} style={btnDecline}>Avslå</button>
            </div>
          </div>
          {dot}
        </div>
      </div>
    )

    if (n.type === 'connection_request') return (
      <div style={outerStyle}>
        <div className="glass" style={innerStyle}>
          <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => handleConnectionRequest(n, true)} style={btnAccept}>🔗 Godta</button>
              <button onClick={() => handleConnectionRequest(n, false)} style={btnDecline}>Avslå</button>
            </div>
          </div>
          {dot}
        </div>
      </div>
    )

    const href = n.type === 'join_request' && n.loans?.community_id
      ? `/community/${n.loans.community_id}`
      : ['connection_accepted', 'connection_disconnected'].includes(n.type) ? '/settings'
      : n.loans?.item_id ? `/items/${n.loans.item_id}` : '#'

    return (
      <Link href={href}>
        <div style={outerStyle}>
          <div className="glass" style={innerStyle}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
              <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
              {n.loans?.items?.name && (
                <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 2, fontStyle: 'italic' }}>{n.loans.items.name}</p>
              )}
              <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
            </div>
            {dot}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header: title + tabs only */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Varsler</h1>
          {currentUnread > 0 && (
            <button onClick={handleMarkAllRead} disabled={markingAll}
              style={{ fontSize: 12, color: 'var(--terra)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', opacity: markingAll ? 0.5 : 1 }}>
              {markingAll ? 'Markerer…' : 'Merk alle som lest'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['actions', 'updates'] as const).map(t => {
            const count = t === 'actions' ? unreadActions : unreadUpdates
            return (
              <button key={t} onClick={() => handleTabSwitch(t)} className={`pill ${tab === t ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t === 'actions' ? 'Handlinger' : 'Oppdateringer'}
                {count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: tab === t ? 'rgba(255,255,255,0.22)' : 'rgba(196,103,58,0.12)', color: tab === t ? 'white' : 'var(--terra)' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* Filter row — outside header, scrolls with content */}
      {availableFilters.length > 1 && (
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {availableFilters.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`pill ${filter === cat ? 'active' : ''}`}
              style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass" style={{ borderRadius: 16, height: 72, opacity: 0.5 }} />
          ))
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏘️</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen varsler ennå</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>Her dukker det opp varsler knyttet til dine låneavtaler, meldingsutvekslinger og venneforespørsler.</p>
          </div>
        ) : current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            {tab === 'actions' ? (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Alt er i orden!</p>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>Du har ingen utestående handlinger.</p>
              </>
            ) : filter !== 'all' ? (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen varsler i denne kategorien</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen oppdateringer</p>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>Statusendringer på dine lån vises her.</p>
              </>
            )}
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                {label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
