'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Thread = {
  loan_id: string
  item_id: string
  item_name: string
  owner_id: string
  owner_name: string | null
  loan_status: string
  start_date: string | null
  due_date: string | null
  role: 'lender' | 'borrower'
  counterpart_name: string | null
  counterpart_avatar: string | null
  last_message_body: string | null
  last_message_at: string | null
  unread: boolean
  requires_action: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function possessive(name: string | null): string {
  if (!name) return 'Eiers'
  return name.endsWith('s') ? `${name}'` : `${name}s`
}

function threadTitle(role: 'lender' | 'borrower', ownerName: string | null, itemName: string): string {
  if (!itemName) return role === 'lender' ? 'Din gjenstand' : `${possessive(ownerName)} gjenstand`
  if (role === 'lender') return `Din ${itemName.toLowerCase()}`
  return `${possessive(ownerName)} ${itemName.toLowerCase()}`
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

// Only show a status badge when it's truly actionable/notable
function statusBadge(status: string, role: 'lender'|'borrower'): { label: string; color: string; bg: string } | null {
  if (status === 'pending' && role === 'lender')
    return { label: 'Venter på deg', color: 'var(--terra)', bg: 'rgba(196,103,58,0.1)' }
  if (status === 'change_proposed')
    return { label: 'Endringsforslag', color: 'var(--terra)', bg: 'rgba(196,103,58,0.1)' }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [threads, setThreads] = useState<Thread[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      loadAll(data.user.id)
    })
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)

    // Fetch loans — use item_id column directly, not via join id
    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id, status, start_date, due_date,
        item_id, owner_id, borrower_id,
        items ( name ),
        owner:profiles!loans_owner_id_fkey ( id, name, avatar_url ),
        borrower:profiles!loans_borrower_id_fkey ( id, name, avatar_url )
      `)
      .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
      .not('status', 'in', '("declined")')
      .order('created_at', { ascending: false })

    // Filter out any null/malformed rows defensively
    const validLoans = (loans ?? []).filter((l: any) => l && l.id && l.owner_id)

    // Fetch last messages + read receipts in parallel
    const loanIds = validLoans.map((l: any) => l.id)
    const lastMsgs: Record<string, { body: string; created_at: string; sender_id: string }> = {}

    const [msgsResult, readsResult] = await Promise.all([
      loanIds.length > 0
        ? supabase.from('loan_messages').select('loan_id, body, created_at, sender_id').in('loan_id', loanIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('loan_message_reads').select('loan_id, read_at').eq('user_id', userId),
    ])

    for (const m of (msgsResult.data ?? [])) {
      if (!lastMsgs[m.loan_id]) lastMsgs[m.loan_id] = m
    }

    const readMap = new Map<string, string>(
      (readsResult.data ?? []).map((r: any) => [r.loan_id, r.read_at] as [string, string])
    )

    const normalised: Thread[] = validLoans.map((loan: any) => {
      const role: 'lender' | 'borrower' = loan.owner_id === userId ? 'lender' : 'borrower'
      const counterpart = role === 'lender' ? loan.borrower : loan.owner
      const last = lastMsgs[loan.id] ?? null
      const lastReadAt = readMap.get(loan.id)
      const unread = last
        ? last.sender_id !== userId && (!lastReadAt || lastReadAt < last.created_at)
        : false

      return {
        loan_id:          loan.id,
        item_id:          loan.item_id,
        item_name:        loan.items?.name ?? '',
        owner_id:         loan.owner_id,
        owner_name:       loan.owner?.name ?? null,
        loan_status:      loan.status,
        start_date:       loan.start_date,
        due_date:         loan.due_date,
        role,
        counterpart_name:   counterpart?.name ?? null,
        counterpart_avatar: counterpart?.avatar_url ?? null,
        last_message_body:  last?.body ?? null,
        last_message_at:    last?.created_at ?? loan.created_at,
        unread,
        requires_action:    (loan.status === 'pending' && role === 'lender') || loan.status === 'change_proposed',
      }
    })

    normalised.sort((a, b) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    )

    setThreads(normalised)
    setLoading(false)
    track('messages_page_viewed')
  }

  // -------------------------------------------------------------------------
  // Filter
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
  // Sub-components
  // -------------------------------------------------------------------------

  function Avatar({ name, avatar }: { name: string | null; avatar: string | null }) {
    const initials = (name ?? '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
    return avatar
      ? <img src={avatar} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
      : <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'var(--terra)', color: 'white', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {initials}
        </div>
  }

  function ThreadCard({ t }: { t: Thread }) {
    const badge   = statusBadge(t.loan_status, t.role)
    const isRead  = !t.unread
    const isDone  = t.loan_status === 'returned'

    return (
      <div
        onClick={() => {
          if (!t.loan_id) return
          track('messages_thread_opened', { loan_id: t.loan_id })
          router.push(`/loans/${t.loan_id}`)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          borderRadius: 16,
          background: t.requires_action
            ? 'rgba(196,103,58,0.06)'
            : 'rgba(255,248,243,0.7)',
          border: t.requires_action
            ? '1.5px solid rgba(196,103,58,0.25)'
            : '1px solid rgba(196,103,58,0.12)',
          cursor: t.loan_id ? 'pointer' : 'default',
          opacity: isDone ? 0.6 : 1,
        }}
      >
        {/* Avatar */}
        <Avatar name={t.counterpart_name} avatar={t.counterpart_avatar} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1 }}>
            <span style={{ fontSize: 14, fontWeight: isRead ? 500 : 700, color: 'var(--terra-dark)' }}>
              {t.counterpart_name ?? 'Ukjent'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--terra-mid)', flexShrink: 0, marginLeft: 8 }}>
              {relativeTime(t.last_message_at)}
            </span>
          </div>

          {/* Row 2: item title */}
          <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {threadTitle(t.role, t.owner_name, t.item_name)}
          </p>

          {/* Row 3: last message preview OR status badge */}
          {badge ? (
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          ) : (
            <p style={{
              fontSize: 12, margin: 0,
              color: t.unread ? 'var(--terra-dark)' : 'var(--terra-mid)',
              fontWeight: t.unread ? 500 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {t.last_message_body ?? '—'}
            </p>
          )}
        </div>

        {/* Unread dot */}
        {t.unread && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0 }} />
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Meldinger</h1>
          {totalUnread > 0 && (
            <span style={{ background: 'var(--terra)', color: 'white', fontWeight: 700, borderRadius: 99, padding: '1px 8px', fontSize: 12 }}>
              {totalUnread}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, padding: '7px 12px', background: 'rgba(255,248,243,0.6)', border: '1px solid rgba(196,103,58,0.15)' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round">
            <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
          </svg>
          <input
            type="text"
            placeholder="Søk etter navn eller gjenstand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'transparent', outline: 'none', color: 'var(--terra-dark)', fontSize: 13, border: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--terra-mid)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          )}
        </div>
      </header>

      <div style={{ padding: '10px 14px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 72, borderRadius: 16, background: 'rgba(196,103,58,0.06)', opacity: 0.5 }} />
          ))
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen meldinger ennå</p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>Meldingstråder fra låneavtalene dine samles her.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--terra-mid)', fontSize: 13 }}>Ingen treff på «{search}»</div>
        ) : (
          filtered.map(t => <ThreadCard key={t.loan_id} t={t} />)
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
