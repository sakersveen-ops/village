'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ACTION_TYPES = ['loan_request', 'friend_request', 'join_request', 'friend_accepted']

// Contextual SVG icons per notification type
const NotifIcon = ({ type }: { type: string }) => {
  if (type === 'loan_request') {
    // Book stack / lending
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
    // Checkmark circle
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra-green)" opacity="0.15"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M7 11.5l2.5 2.5 5.5-5.5" stroke="var(--terra-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'loan_declined') {
    // X circle
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="9" fill="var(--terra)" opacity="0.1"/>
        <circle cx="11" cy="11" r="9" stroke="var(--terra)" strokeWidth="1.5"/>
        <path d="M8 8l6 6M14 8l-6 6" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  }
  if (type === 'friend_request') {
    // Handshake / wave
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
    // Two people / checkmark
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="7" r="2.5" stroke="var(--terra-green)" strokeWidth="1.5"/>
        <path d="M3 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M15 10l1.5 1.5 3-3" stroke="var(--terra-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (type === 'join_request') {
    // House / community
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
    // Swap arrows
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
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select(`
          *,
          loans(
            item_id,
            items(name),
            community_id,
            communities(name, avatar_emoji)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setLoading(false)
    }
    load()
  }, [])

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('no-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const [handledRequests, setHandledRequests] = useState<Set<string>>(new Set())

  const handleFriendRequest = async (n: any, accept: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: req } = await supabase
      .from('friend_requests')
      .select('id, from_id')
      .eq('to_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

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

  // Action-tab cards get the left-border treatment; updates do not
  const isActionTab = tab === 'actions'

  const NotifCard = ({ n }: { n: any }) => {
    const handled = handledRequests.has(n.id)
    const needsAction = isActionTab && !n.read

    if (n.type === 'friend_request') {
      return (
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          borderLeft: needsAction ? '3px solid var(--terra)' : undefined,
        }}>
        <div
          className="glass"
          style={{
            borderRadius: needsAction ? '0 16px 16px 0' : '16px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>
            <NotifIcon type={n.type} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
            {!handled ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => handleFriendRequest(n, true)}
                  className="btn-sm btn-accept"
                >
                  ✓ Godta
                </button>
                <button
                  onClick={() => handleFriendRequest(n, false)}
                  className="btn-sm btn-decline"
                >
                  Avslå
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--terra-green)', marginTop: 8, fontWeight: 600 }}>✓ Håndtert</p>
            )}
          </div>
          {!n.read && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />
          )}
        </div>
        </div>
      )
    }

    return (
      <Link
        href={
          n.type === 'join_request' && n.loans?.community_id
            ? `/community/${n.loans.community_id}`
            : n.loans?.item_id
            ? `/items/${n.loans.item_id}`
            : '#'
        }
      >
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          borderLeft: needsAction ? '3px solid var(--terra)' : undefined,
        }}>
        <div
          className="glass"
          style={{
            borderRadius: needsAction ? '0 16px 16px 0' : '16px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>
            <NotifIcon type={n.type} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginTop: 2 }}>{n.body}</p>
            {n.loans?.items?.name && (
              <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 2, fontStyle: 'italic' }}>
                {n.loans.items.name}
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
          </div>
          {!n.read && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />
          )}
        </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Sticky header */}
      <header
        className="page-header glass"
        style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Varsler</h1>
          {currentUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              style={{
                fontSize: 12,
                color: 'var(--terra)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                opacity: markingAll ? 0.5 : 1,
              }}
            >
              {markingAll ? 'Markerer…' : 'Merk alle som lest'}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTab('actions')}
            className={`pill ${tab === 'actions' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Handlinger
            {unreadActions > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 99,
                  background: tab === 'actions' ? 'rgba(255,255,255,0.22)' : 'rgba(196,103,58,0.12)',
                  color: tab === 'actions' ? 'white' : 'var(--terra)',
                }}
              >
                {unreadActions}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('updates')}
            className={`pill ${tab === 'updates' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Oppdateringer
            {unreadUpdates > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 99,
                  background: tab === 'updates' ? 'rgba(255,255,255,0.22)' : 'rgba(196,103,58,0.12)',
                  color: tab === 'updates' ? 'white' : 'var(--terra)',
                }}
              >
                {unreadUpdates}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass" style={{ borderRadius: 16, height: 72, opacity: 0.5 }} />
          ))
        ) : current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{tab === 'actions' ? '✅' : '🔔'}</div>
            <p style={{ fontSize: 14 }}>{tab === 'actions' ? 'Ingen handlinger å gjøre' : 'Ingen oppdateringer'}</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              {/* Date group header — 11px uppercase */}
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--terra-mid)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 8,
                }}
              >
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
