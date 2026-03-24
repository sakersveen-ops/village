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
  item_image: string | null
  item_category: string
  owner_id: string
  owner_name: string | null
  loan_status: string
  start_date: string | null
  due_date: string | null
  role: 'lender' | 'borrower'
  counterpart_id: string | null
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

function itemTitle(role: 'lender'|'borrower', ownerName: string|null, itemName: string, category?: string): string {
  if (!itemName) return role === 'lender' ? 'Din gjenstand' : `${possessive(ownerName)} gjenstand`
  if (role === 'lender') return itemName
  if (category === 'boker') return `${possessive(ownerName)} bok «${itemName}»`
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

type PillVariant = 'green' | 'light-green' | 'yellow' | 'red' | 'neutral'

const PILL_STYLES: Record<PillVariant, { bg: string; color: string; border: string }> = {
  'green':       { bg: 'rgba(74,124,89,0.13)',  color: 'var(--terra-green)', border: 'rgba(74,124,89,0.22)'  },
  'light-green': { bg: 'rgba(74,124,89,0.07)',  color: '#5a9670',            border: 'rgba(74,124,89,0.15)'  },
  'yellow':      { bg: 'rgba(202,163,20,0.12)', color: '#8a6d00',            border: 'rgba(202,163,20,0.28)' },
  'red':         { bg: 'rgba(180,60,40,0.08)',  color: '#B43C28',            border: 'rgba(180,60,40,0.18)'  },
  'neutral':     { bg: 'transparent',           color: 'var(--terra-mid)',   border: 'transparent'           },
}

function todayYMD() { return new Date().toISOString().split('T')[0] }

function derivePill(t: Thread): { label: string; variant: PillVariant } | null {
  const today = todayYMD()
  const isRead = !t.unread

  // Parse last message for system signals
  const body = t.last_message_body ?? ''
  const isAcceptedSystem  = body.includes('godtatt') || body.startsWith('✅')
  const isDeclinedSystem  = body.includes('avslått') && !body.includes('Endringsforslag')
  const isProposalDecline = body.includes('Endringsforslag avslått')
  const isNewRequest      = body.includes('Låneforespørsel') || (t.loan_status === 'pending' && !body)

  // Declined loan
  if (t.loan_status === 'declined')
    return { label: 'Avslått', variant: isRead ? 'neutral' : 'red' }

  // Returned
  if (t.loan_status === 'returned')
    return { label: 'Returnert', variant: 'neutral' }

  // New loan request (pending, first message or body contains "Låneforespørsel")
  if (t.loan_status === 'pending')
    return { label: 'Låneforespørsel', variant: isRead ? 'neutral' : 'green' }

  // Change proposed
  if (t.loan_status === 'change_proposed')
    return { label: 'Endringsforslag', variant: isRead ? 'neutral' : 'yellow' }

  // Active loan — accepted system message
  if (isAcceptedSystem && t.loan_status === 'active') {
    // Future start = planned
    if (t.start_date && t.start_date > today)
      return { label: 'Planlagt lån bekreftet', variant: isRead ? 'neutral' : 'light-green' }
    return { label: 'Aktivt lån', variant: isRead ? 'neutral' : 'green' }
  }

  // Active loan — no notable system message, show message preview (return null = use body)
  if (t.loan_status === 'active') return null

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [threads, setThreads]     = useState<Thread[]>([])
  const [search, setSearch]       = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      loadAll(data.user.id)
    })
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)

    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id, status, start_date, due_date,
        item_id, owner_id, borrower_id,
        items ( name, image_url, category ),
        owner:profiles!loans_owner_id_fkey ( id, name, avatar_url ),
        borrower:profiles!loans_borrower_id_fkey ( id, name, avatar_url )
      `)
      .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    const validLoans = (loans ?? []).filter((l: any) => l && l.id && l.owner_id)
    const loanIds = validLoans.map((l: any) => l.id)
    const lastMsgs: Record<string, { body: string; created_at: string; sender_id: string; type: string }> = {}

    const [msgsResult, readsResult] = await Promise.all([
      loanIds.length > 0
        ? supabase.from('loan_messages').select('loan_id, body, created_at, sender_id, type').in('loan_id', loanIds).order('created_at', { ascending: false })
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
      const role: 'lender'|'borrower' = loan.owner_id === userId ? 'lender' : 'borrower'
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
        item_image:       loan.items?.image_url ?? null,
        item_category:    loan.items?.category ?? '',
        owner_id:         loan.owner_id,
        owner_name:       loan.owner?.name ?? null,
        loan_status:      loan.status,
        start_date:       loan.start_date,
        due_date:         loan.due_date,
        role,
        counterpart_id:     counterpart?.id ?? null,
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

    // Group by (item_id, counterpart_id)
    const grouped = new Map<string, Thread>()
    for (const t of normalised) {
      const key = `${t.item_id}::${t.counterpart_id}`
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, t)
      } else if (t.requires_action && !existing.requires_action) {
        grouped.set(key, t)
      }
    }

    const deduped = Array.from(grouped.values())
    deduped.sort((a, b) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    )

    setThreads(deduped)
    setLoading(false)
    track('messages_page_viewed')
  }

  const totalUnread = threads.filter(t => t.unread).length

  const filtered = useMemo(() => {
    let list = threads
    if (unreadOnly) list = list.filter(t => t.unread)
    if (search.length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.counterpart_name?.toLowerCase().includes(q) ||
        t.item_name.toLowerCase().includes(q)
      )
    }
    return list
  }, [threads, search, unreadOnly])

  // ---------------------------------------------------------------------------
  // ThreadCard
  // ---------------------------------------------------------------------------

  function ThreadCard({ t }: { t: Thread }) {
    const pill = derivePill(t)
    const isDone = t.loan_status === 'returned'
    const cpName = t.counterpart_name ?? '?'
    const cpInitials = cpName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    const cardHighlight = t.requires_action && t.unread

    return (
      <div
        onClick={() => { if (!t.loan_id) return; track('messages_thread_opened', { loan_id: t.loan_id }); router.push(`/loans/${t.loan_id}`) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 13px', borderRadius: 16,
          background: cardHighlight ? 'rgba(196,103,58,0.05)' : 'rgba(255,248,243,0.55)',
          border: cardHighlight ? '1.5px solid rgba(196,103,58,0.2)' : '1px solid rgba(196,103,58,0.1)',
          cursor: 'pointer', opacity: isDone ? 0.5 : 1,
        }}
      >
        {/* Composite thumbnail */}
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
          {t.item_image
            ? <img src={t.item_image} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(196,103,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
          }
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(255,248,243,0.95)',
            overflow: 'hidden', background: 'var(--terra)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.counterpart_avatar
              ? <img src={t.counterpart_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 7, fontWeight: 700, color: 'white', lineHeight: 1 }}>{cpInitials}</span>
            }
          </div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1 }}>
            <span className="font-display" style={{
              fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0, marginRight: 8,
            }}>
              {itemTitle(t.role, t.owner_name, t.item_name, t.item_category)}
            </span>
            <span style={{ fontSize: 11, color: t.unread ? 'var(--terra-mid)' : 'rgba(156,123,101,0.45)', flexShrink: 0 }}>
              {relativeTime(t.last_message_at)}
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.counterpart_name ?? 'Ukjent'}
          </p>

          {pill ? (() => {
            const ps = PILL_STYLES[pill.variant]
            return (
              <span style={{
                display: 'inline-block', fontSize: 11,
                fontWeight: t.unread ? 600 : 400,
                padding: pill.variant === 'neutral' ? '0' : '2px 8px',
                borderRadius: 99,
                background: ps.bg,
                color: ps.color,
                border: `1px solid ${ps.border}`,
              }}>
                {pill.label}
              </span>
            )
          })() : t.last_message_body ? (
            <p style={{
              fontSize: 12, margin: 0,
              color: t.unread ? 'var(--terra-dark)' : 'var(--terra-mid)',
              fontWeight: t.unread ? 500 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {t.last_message_body}
            </p>
          ) : null}
        </div>

        {t.unread && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginLeft: 2 }} />
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto">

      {/* Sticky header — flush to top, no gap below */}
      <header className="page-header glass" style={{
        borderRadius: '0 0 20px 20px',
        position: 'sticky', top: 0, zIndex: 40,
        paddingBottom: 12,
      }}>
        {/* Row 1: title + unread badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h1 className="page-header-title font-display" style={{ margin: 0 }}>Meldinger</h1>
          {totalUnread > 0 && (
            <span style={{
              background: 'var(--terra)', color: 'white', fontWeight: 700,
              borderRadius: 99, padding: '1px 7px', fontSize: 12,
              lineHeight: '18px', display: 'inline-block',
            }}>
              {totalUnread}
            </span>
          )}
        </div>

        {/* Row 2: unread toggle + search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Uleste toggle */}
          <button
            onClick={() => setUnreadOnly(v => !v)}
            style={{
              flexShrink: 0, padding: '7px 12px', borderRadius: 11, fontSize: 12, fontWeight: 600,
              border: unreadOnly ? '1.5px solid rgba(196,103,58,0.45)' : '1px solid rgba(196,103,58,0.18)',
              background: unreadOnly ? 'rgba(196,103,58,0.1)' : 'rgba(255,248,243,0.6)',
              color: unreadOnly ? 'var(--terra)' : 'var(--terra-mid)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {unreadOnly ? '● Uleste' : 'Uleste'}
          </button>

          {/* Search */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: 11, padding: '7px 12px',
            background: 'rgba(255,248,243,0.6)', border: '1px solid rgba(196,103,58,0.15)',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round">
              <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
            </svg>
            <input
              type="text"
              placeholder="Søk…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', outline: 'none', color: 'var(--terra-dark)', fontSize: 13, border: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ color: 'var(--terra-mid)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        </div>
      </header>

      {/* Thread list — directly under header, no top gap */}
      <div style={{ padding: '8px 14px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 76, borderRadius: 16, background: 'rgba(196,103,58,0.05)' }} />
          ))
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>Ingen meldinger ennå</p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>Meldingstråder fra låneavtalene dine samles her.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--terra-mid)', fontSize: 13 }}>
            {unreadOnly ? 'Ingen uleste meldinger' : `Ingen treff på «${search}»`}
          </div>
        ) : (
          filtered.map(t => <ThreadCard key={t.loan_id} t={t} />)
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
