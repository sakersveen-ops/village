'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'

const ACTION_TYPES = ['loan_request', 'friend_request', 'join_request', 'friend_accepted', 'connection_request']

const NotifIcon = ({ type }: { type: string }) => {
  if (type === 'loan_request') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="13" width="14" height="3" rx="1.5" fill="var(--terra)" opacity="0.25"/>
        <rect x="4" y="9" width="12" height="3" rx="1.5" fill="var(--terra)" opacity="0.45"/>
        <rect x="3" y="5" width="13" height="4" rx="1.5" fill="var(--terra)"/>
        <path d="M18 5v10" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M20 15l-2 2.5L16 15" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'loan_accepted') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'loan_declined') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra)" opacity="0.1"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra)" strokeWidth="1.5"/>
        <path d="M8 8l6 6M14 8l-6 6" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  }
  if (type === 'friend_request') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 14c0-2.5 1.5-4 3.5-4h1L11 8h2l2 2h1c2 0 3 1.5 3 3" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.5 10l-3 3.5c-.5.6-.3 1.5.5 1.8l6 2.5c.7.3 1.4 0 1.7-.7l2-4.6" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.5 12l2.5 3c.5.7 0 1.6-.8 1.6H14" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="5.5" r="1.5" fill="var(--terra)" opacity="0.5"/>
        <circle cx="13" cy="5.5" r="1.5" fill="var(--terra)" opacity="0.5"/>
      </svg>
    )
  }
  if (type === 'friend_accepted') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="7" r="2.5" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M3 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M15 10l1.5 1.5 3-3" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'join_request') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 10.5L11 4l8 6.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="7" y="12" width="8" height="7" rx="1" stroke="var(--terra)" strokeWidth="1.5"/>
        <rect x="9.5" y="15" width="3" height="4" rx="0.5" fill="var(--terra)" opacity="0.35"/>
        <path d="M14 7h2v3" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'join_accepted') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'change_proposal') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 8h14M14 5l4 3-4 3" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 14H4M8 11l-4 3 4 3" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'proposal_accepted') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'connection_request' || type === 'connection_accepted') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
        <circle cx="16" cy="11" r="3" stroke="var(--terra)" strokeWidth="1.5"/>
        <path d="M9 11h4" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 8.5C9 7 10 5.5 11 5.5S13 7 13 8.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 13.5C9 15 10 16.5 11 16.5S13 15 13 13.5" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  if (type === 'connection_disconnected') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="11" r="3" stroke="var(--terra-mid)" strokeWidth="1.5"/>
        <circle cx="16" cy="11" r="3" stroke="var(--terra-mid)" strokeWidth="1.5"/>
        <path d="M9.5 9.5l3 3M12.5 9.5l-3 3" stroke="var(--terra-mid)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  // Generic bell fallback
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 3a5 5 0 00-5 5v4l-1.5 2.5h13L16 12V8a5 5 0 00-5-5z" stroke="var(--terra)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 17.5a2 2 0 004 0" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [tab, setTab] = useState<'actions' | 'updates'>('actions')
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [handledRequests, setHandledRequests] = useState<Set<string>>(new Set())
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

      // Merk kun ikke-handlingsvarsler som lest ved sidebesøk
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false)
          .not('type', 'in', '("loan_request","friend_request","connection_request")')

      setLoading(false)
    }
    load()
  }, [])

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const handleFriendRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: req } = await supabase
      .from('friend_requests').select('id, from_id')
      .eq('to_id', user.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).single()
    if (!req) return

    await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', req.id)
    if (accept) {
      await supabase.from('friendships').insert([
        { user_a: user.id, user_b: req.from_id },
        { user_a: req.from_id, user_b: user.id },
      ])
      await supabase.from('notifications').insert({
        user_id: req.from_id,
        type: 'friend_accepted',
        title: '✓ Venneforespørsel godtatt!',
        body: 'Dere er nå venner',
      })
    }

    // Merk varselet som lest
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))

    track(Events.FRIEND_REQUEST_HANDLED, { accepted: accept })
    setHandledRequests(prev => new Set([...prev, n.id]))
  }

  const handleConnectionRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: conn } = await supabase
      .from('profile_connections')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('status', 'pending')
      .neq('initiated_by', user.id)
      .limit(1)
      .single()

    if (!conn) return

    if (accept) {
      await supabase.from('profile_connections')
        .update({ status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', conn.id)

      await supabase.from('items').update({ connected_profile_id: conn.user_b === user.id ? conn.user_a : conn.user_b })
        .eq('owner_id', user.id)
      await supabase.from('items').update({ connected_profile_id: user.id })
        .eq('owner_id', conn.initiated_by)

      await supabase.from('notifications').insert({
        user_id: conn.initiated_by,
        type: 'connection_accepted',
        title: '🔗 Tilkobling godtatt!',
        body: `${currentProfile?.name || user.email?.split('@')[0]} koblet til profilen din`,
        action_url: '/settings',
      })
      track(Events.CONNECTION_ACCEPTED, { connection_id: conn.id })
    } else {
      await supabase.from('profile_connections').update({ status: 'disconnected' }).eq('id', conn.id)
      track(Events.CONNECTION_DECLINED, { connection_id: conn.id })
    }

    // Merk varselet som lest
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))

    setHandledRequests(prev => new Set([...prev, n.id]))
  }
  const groupByDate = (list: any[]) => {
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

  const actions = notifications.filter(n => ACTION_TYPES.includes(n.type))
  const updates = notifications.filter(n => !ACTION_TYPES.includes(n.type))
  const unreadActions = actions.filter(n => !n.read).length
  const unreadUpdates = updates.filter(n => !n.read).length
  const currentUnread = tab === 'actions' ? unreadActions : unreadUpdates
  const current = tab === 'actions' ? actions : updates
  const groups = groupByDate(current)
  const isActionTab = tab === 'actions'

  const NotifCard = ({ n }: { n: any }) => {
    const handled = handledRequests.has(n.id)
    const needsAction = isActionTab && !n.read

    const cardStyle = {
      borderRadius: '16px',
      overflow: 'hidden',
      borderLeft: needsAction ? '3px solid var(--terra)' : undefined,
    }
    const innerStyle = {
      borderRadius: needsAction ? '0 16px 16px 0' : '16px',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start' as const,
      gap: '12px',
    }

    // Friend request
    if (n.type === 'friend_request') {
      return (
        <div style={cardStyle}>
          <div className="glass" style={innerStyle}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
              <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
              <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
              {!handled ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => handleFriendRequest(n, true)} className="btn-sm btn-accept">✓ Godta</button>
                  <button onClick={() => handleFriendRequest(n, false)} className="btn-sm btn-decline">Avslå</button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--terra-green)', marginTop: 8, fontWeight: 600 }}>✓ Håndtert</p>
              )}
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        </div>
      )
    }

    // Connection request
    if (n.type === 'connection_request') {
      return (
        <div style={cardStyle}>
          <div className="glass" style={innerStyle}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><NotifIcon type={n.type} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
              <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
              <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
              {!handled ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => handleConnectionRequest(n, true)} className="btn-sm btn-accept">🔗 Godta</button>
                  <button onClick={() => handleConnectionRequest(n, false)} className="btn-sm btn-decline">Avslå</button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--terra-green)', marginTop: 8, fontWeight: 600 }}>✓ Håndtert</p>
              )}
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        </div>
      )
    }

    // All other notifications — linked
    return (
      <Link href={
        n.type === 'join_request' && n.loans?.community_id
          ? `/community/${n.loans.community_id}`
          : n.type === 'connection_accepted' || n.type === 'connection_disconnected'
          ? '/settings'
          : n.loans?.item_id
          ? `/items/${n.loans.item_id}`
          : '#'
      }>
        <div style={cardStyle}>
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
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Varsler</h1>
          {currentUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              style={{ fontSize: 12, color: 'var(--terra)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', opacity: markingAll ? 0.5 : 1 }}
            >
              {markingAll ? 'Markerer…' : 'Merk alle som lest'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['actions', 'updates'] as const).map(t => {
            const count = t === 'actions' ? unreadActions : unreadUpdates
            const label = t === 'actions' ? 'Handlinger' : 'Oppdateringer'
            return (
              <button key={t} onClick={() => setTab(t)} className={`pill ${tab === t ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
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

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              <><div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div><p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Alt er i orden!</p><p style={{ fontSize: 13, lineHeight: 1.5 }}>Du har ingen utestående handlinger.</p></>
            ) : (
              <><div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div><p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen oppdateringer</p><p style={{ fontSize: 13, lineHeight: 1.5 }}>Statusendringer på dine lån vises her.</p></>
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
