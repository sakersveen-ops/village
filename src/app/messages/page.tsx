'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track, Events } from '@/lib/track'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Thread = {
  loan_id: string
  loan_status: string
  start_date: string
  due_date: string
  item_id: string
  item_name: string
  owner_id: string
  owner_name: string | null
  borrower_id: string
  borrower_name: string | null
  last_message_body: string | null
  last_message_at: string | null
  unread: boolean
  role: 'lender' | 'borrower'
  requires_action: boolean
  counterpart_name: string | null
  counterpart_avatar: string | null
  item_label: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function possessive(name: string): string {
  if (!name) return ''
  return name.endsWith('s') ? `${name}'` : `${name}s`
}

function itemLabel(ownerName: string | null, userId: string, ownerId: string, itemName: string): string {
  if (ownerId === userId) return `Din ${itemName.toLowerCase()}`
  return `${possessive(ownerName ?? 'Eiers')} ${itemName.toLowerCase()}`
}

function requiresAction(loan_status: string, role: 'lender' | 'borrower'): boolean {
  if (loan_status === 'pending' && role === 'lender') return true
  if (loan_status === 'change_proposed') return true
  return false
}

function isActive(status: string): boolean {
  return ['pending', 'active', 'change_proposed'].includes(status)
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Nå'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}t`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'I går'
  if (days < 7) return ['Man','Tir','Ons','Tor','Fre','Lør','Søn'][new Date(iso).getDay()]
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function chipLabel(status: string, role: 'lender' | 'borrower'): { text: string; style: 'action' | 'change' | 'active' } | null {
  if (status === 'pending' && role === 'lender') return { text: '⏳ Forespørsel venter', style: 'action' }
  if (status === 'change_proposed') return { text: '🔄 Endringsforslag', style: 'change' }
  if (status === 'active') return { text: '✓ Aktivt lån', style: 'active' }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadAll(data.user.id)
    })
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)

    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id, status, start_date, due_date,
        owner_id, borrower_id,
        items ( id, name ),
        owner:profiles!loans_owner_id_fkey ( id, name, avatar_url ),
        borrower:profiles!loans_borrower_id_fkey ( id, name, avatar_url )
      `)
      .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
      .not('status', 'in', '("declined")')
      .order('created_at', { ascending: false })

    const loanIds = (loans ?? []).map((l: any) => l.id)
    let lastMessages: Record<string, { body: string; created_at: string; sender_id: string }> = {}

    if (loanIds.length > 0) {
      const { data: msgs } = await supabase
        .from('loan_messages')
        .select('loan_id, body, created_at, sender_id')
        .in('loan_id', loanIds)
        .order('created_at', { ascending: false })

      for (const m of (msgs ?? [])) {
        if (!lastMessages[m.loan_id]) {
          lastMessages[m.loan_id] = { body: m.body, created_at: m.created_at, sender_id: m.sender_id }
        }
      }
    }

    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_b')
      .eq('user_a', userId)

    setFriendIds(new Set((friendships ?? []).map((f: any) => f.user_b)))

    const normalised: Thread[] = (loans ?? []).map((loan: any) => {
      const role: 'lender' | 'borrower' = loan.owner_id === userId ? 'lender' : 'borrower'
      const counterpart = role === 'lender' ? loan.borrower : loan.owner
      const last = lastMessages[loan.id] ?? null

      return {
        loan_id: loan.id,
        loan_status: loan.status,
        start_date: loan.start_date,
        due_date: loan.due_date,
        item_id: loan.items?.id,
        item_name: loan.items?.name ?? '',
        owner_id: loan.owner_id,
        owner_name: loan.owner?.name ?? null,
        borrower_id: loan.borrower_id,
        borrower_name: loan.borrower?.name ?? null,
        last_message_body: last?.body ?? null,
        last_message_at: last?.created_at ?? loan.created_at,
        unread: last ? last.sender_id !== userId : false,
        role,
        requires_action: requiresAction(loan.status, role),
        counterpart_name: counterpart?.name ?? null,
        counterpart_avatar: counterpart?.avatar_url ?? null,
        item_label: itemLabel(loan.owner?.name, userId, loan.owner_id, loan.items?.name ?? ''),
      }
    })

    // Sort by last_message_at descending (most recent conversation first)
    normalised.sort((a, b) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    )

    setThreads(normalised)
    setLoading(false)
    track('messages_page_viewed')
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filtered = useMemo(() => {
    if (search.length < 2) return threads
    const q = search.toLowerCase()
    return threads.filter(t =>
      t.counterpart_name?.toLowerCase().includes(q) ||
      t.item_name.toLowerCase().includes(q)
    )
  }, [threads, search])

  const totalUnread = threads.filter(t => t.unread).length

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function Chip({ thread }: { thread: Thread }) {
    const chip = chipLabel(thread.loan_status, thread.role)
    if (!chip) return null
    const styles: Record<string, React.CSSProperties> = {
      action: { background: 'rgba(196,103,58,0.1)', color: '#C4673A', border: '1px solid rgba(196,103,58,0.2)' },
      change: { background: 'rgba(217,119,6,0.1)', color: '#B45309', border: '1px solid rgba(217,119,6,0.2)' },
      active: { background: 'rgba(74,124,89,0.1)', color: '#4A7C59', border: '1px solid rgba(74,124,89,0.2)' },
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        borderRadius: 99, padding: '2px 8px', fontSize: 9.5, fontWeight: 600,
        marginTop: 6, ...styles[chip.style]
      }}>
        {chip.text}
      </span>
    )
  }

  function Avatar({ name, avatar }: { name: string | null; avatar: string | null }) {
    if (avatar) {
      return <img src={avatar} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={name ?? ''} />
    }
    const initials = (name ?? '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
    return (
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--terra)', color: 'white', fontSize: 13, fontWeight: 700,
      }}>
        {initials}
      </div>
    )
  }

  function ThreadCard({ thread }: { thread: Thread }) {
    const needsBorder = thread.requires_action
    return (
      <div
        style={{
          borderRadius: 16, overflow: 'hidden',
          borderLeft: needsBorder ? '3px solid var(--terra)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => {
          track('messages_thread_opened', { loan_id: thread.loan_id, requires_action: thread.requires_action })
          router.push(`/items/${thread.item_id}`)
        }}
      >
        <div
          className="glass"
          style={{
            borderRadius: needsBorder ? '0 16px 16px 0' : 16,
            padding: '12px 14px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            opacity: thread.loan_status === 'returned' ? 0.55 : 1,
          }}
        >
          <Avatar name={thread.counterpart_name} avatar={thread.counterpart_avatar} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <span style={{ color: 'var(--terra-dark)', fontSize: 13.5, fontWeight: thread.unread ? 700 : 500 }}>
                {thread.counterpart_name ?? 'Ukjent'}
              </span>
              <span style={{ color: 'var(--terra-mid)', fontSize: 10.5, flexShrink: 0, marginLeft: 8 }}>
                {relativeTime(thread.last_message_at)}
              </span>
            </div>
            <div style={{ color: 'var(--terra-mid)', fontSize: 11.5, marginBottom: 2 }}>
              {thread.item_label}
            </div>
            <div style={{
              color: thread.unread ? 'var(--terra-dark)' : 'var(--terra-mid)',
              fontSize: 11.5,
              fontWeight: thread.unread ? 500 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {thread.last_message_body ?? 'Ingen meldinger ennå'}
            </div>
            <Chip thread={thread} />
          </div>
          {thread.unread && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginTop: 6 }} />
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Meldinger</h1>
          {totalUnread > 0 && (
            <span style={{
              background: 'var(--terra)', color: 'white', fontWeight: 700,
              borderRadius: 99, padding: '2px 8px', fontSize: 12,
            }}>
              {totalUnread}
            </span>
          )}
        </div>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12,
          padding: '8px 12px', background: 'rgba(255,248,243,0.6)',
          border: '1px solid rgba(196,103,58,0.18)',
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round">
            <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
          </svg>
          <input
            type="text"
            placeholder="Søk etter navn eller gjenstand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: 'transparent', outline: 'none',
              color: 'var(--terra-dark)', fontSize: 13, border: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--terra-mid)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          )}
        </div>
      </header>

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass" style={{ borderRadius: 16, height: 76, opacity: 0.5 }} />
          ))
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen meldinger ennå</p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>Her samles alle meldingstråder fra låneavtalene dine.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>🔍</div>
            <p style={{ fontSize: 13 }}>Ingen meldinger matcher søket</p>
          </div>
        ) : (
          filtered.map(t => <ThreadCard key={t.loan_id} thread={t} />)
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
