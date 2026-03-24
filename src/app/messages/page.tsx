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

function itemTitle(role: 'lender' | 'borrower', ownerName: string | null, itemName: string): string {
  if (!itemName) return role === 'lender' ? 'Din gjenstand' : `${possessive(ownerName)} gjenstand`
  if (role === 'lender') return itemName
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

// Status pill — only shown when notable. Fades when read.
type PillVariant = 'green' | 'amber' | 'red' | 'neutral'

function statusPill(status: string, role: 'lender'|'borrower', unread: boolean, lastBody: string | null): {
  label: string; variant: PillVariant
} | null {
  // Active loan — only show if unread or requires attention
  if (status === 'active') {
    // Show last message body instead of a pill for active/read threads
    return null
  }
  if (status === 'pending' && role === 'lender')
    return { label: 'Venter på din godkjenning', variant: unread ? 'amber' : 'neutral' }
  if (status === 'pending' && role === 'borrower')
    return { label: 'Venter på godkjenning', variant: unread ? 'amber' : 'neutral' }
  if (status === 'change_proposed')
    return { label: 'Endringsforslag', variant: unread ? 'amber' : 'neutral' }
  if (status === 'returned')
    return { label: 'Returnert', variant: 'neutral' }
  if (status === 'declined')
    return { label: 'Avslått', variant: 'red' }
  return null
}

// Parse last message body into a human-readable pill label if it's a system message
function systemLabel(body: string | null): { label: string; variant: PillVariant } | null {
  if (!body) return null
  if (body.startsWith('✅') || body.includes('godtatt') || body.includes('aktivt'))
    return { label: body.replace('✅ ', ''), variant: 'green' }
  if (body.startsWith('❌') || body.includes('avslått'))
    return { label: body.replace('❌ ', ''), variant: 'red' }
  return null
}

const PILL_STYLES: Record<PillVariant, { bg: string; color: string; border: string }> = {
  green:   { bg: 'rgba(74,124,89,0.12)',   color: 'var(--terra-green)', border: 'rgba(74,124,89,0.2)'   },
  amber:   { bg: 'rgba(196,103,58,0.1)',   color: 'var(--terra)',       border: 'rgba(196,103,58,0.2)'  },
  red:     { bg: 'rgba(180,60,40,0.08)',   color: '#B43C28',            border: 'rgba(180,60,40,0.15)'  },
  neutral: { bg: 'rgba(156,123,101,0.07)', color: 'var(--terra-mid)',   border: 'rgba(156,123,101,0.15)'},
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

    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id, status, start_date, due_date,
        item_id, owner_id, borrower_id,
        items ( name, image_url ),
        owner:profiles!loans_owner_id_fkey ( id, name, avatar_url ),
        borrower:profiles!loans_borrower_id_fkey ( id, name, avatar_url )
      `)
      .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
      .not('status', 'in', '("declined")')
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
      const role: 'lender' | 'borrower' = loan.owner_id === userId ? 'lender' : 'borrower'
      const counterpart = role === 'lender' ? loan.borrower : loan.owner
      const last = lastMsgs[loan.id] ?? null
      const lastReadAt = readMap.get(loan.id)
      // System messages (godtatt/avslått) count as unread if not read
      const unread = last
        ? last.sender_id !== userId && (!lastReadAt || lastReadAt < last.created_at)
        : false

      return {
        loan_id:          loan.id,
        item_id:          loan.item_id,
        item_name:        loan.items?.name ?? '',
        item_image:       loan.items?.image_url ?? null,
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

    // Group by (item_id, counterpart_id) — one thread per item+person pair
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

    const deduplicated = Array.from(grouped.values())
    deduplicated.sort((a, b) => {
      if (a.requires_action && !b.requires_action) return -1
      if (!a.requires_action && b.requires_action) return 1
      return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    })

    setThreads(deduplicated)
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
  // ThreadCard
  // -------------------------------------------------------------------------

  function ThreadCard({ t }: { t: Thread }) {
    const isRead = !t.unread
    const isDone = t.loan_status === 'returned'

    // Determine what to show in row 3
    // Priority: system message label > status pill > last message body
    const sysLbl = systemLabel(t.last_message_body)
    const stPill = statusPill(t.loan_status, t.role, t.unread, t.last_message_body)

    // Row 3 pill (shown when not just plain message preview)
    const pill: { label: string; variant: PillVariant } | null = sysLbl ?? stPill

    // Plain message preview when active+read — no pill
    const showMessagePreview = !pill && t.last_message_body

    // Card background — only highlight when unread or action needed
    const cardBg = t.requires_action && t.unread
      ? 'rgba(196,103,58,0.06)'
      : 'rgba(255,248,243,0.55)'
    const cardBorder = t.requires_action && t.unread
      ? '1.5px solid rgba(196,103,58,0.22)'
      : '1px solid rgba(196,103,58,0.1)'

    // Counterpart initials for avatar bubble
    const cpName = t.counterpart_name ?? '?'
    const cpInitials = cpName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

    return (
      <div
        onClick={() => { if (!t.loan_id) return; track('messages_thread_opened', { loan_id: t.loan_id }); router.push(`/loans/${t.loan_id}`) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 13px', borderRadius: 16,
          background: cardBg, border: cardBorder,
          cursor: 'pointer', opacity: isDone ? 0.55 : 1,
        }}
      >
        {/* ── Composite thumbnail ─────────────────────────────────── */}
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
          {/* Main: item image or placeholder */}
          {t.item_image
            ? <img src={t.item_image} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
            : <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: 'rgba(196,103,58,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>📦</div>
          }
          {/* Bubble: counterpart avatar bottom-right */}
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(255,248,243,0.9)',
            overflow: 'hidden', flexShrink: 0,
            background: 'var(--terra)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.counterpart_avatar
              ? <img src={t.counterpart_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 8, fontWeight: 700, color: 'white', lineHeight: 1 }}>{cpInitials}</span>
            }
          </div>
        </div>

        {/* ── Text content ────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: item name (title) + timestamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1 }}>
            <span className="font-display" style={{
              fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0, marginRight: 8,
            }}>
              {itemTitle(t.role, t.owner_name, t.item_name)}
            </span>
            <span style={{ fontSize: 11, color: isRead ? 'rgba(156,123,101,0.5)' : 'var(--terra-mid)', flexShrink: 0 }}>
              {relativeTime(t.last_message_at)}
            </span>
          </div>

          {/* Row 2: counterpart name */}
          <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.counterpart_name ?? 'Ukjent'}
          </p>

          {/* Row 3: pill or message preview */}
          {pill ? (() => {
            const ps = PILL_STYLES[isRead ? 'neutral' : pill.variant]
            return (
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: isRead ? 400 : 600,
                padding: '2px 8px', borderRadius: 99,
                background: isRead ? 'transparent' : ps.bg,
                color: isRead ? 'var(--terra-mid)' : ps.color,
                border: `1px solid ${isRead ? 'transparent' : ps.border}`,
              }}>
                {pill.label}
              </span>
            )
          })() : showMessagePreview ? (
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

        {/* Unread dot */}
        {t.unread && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0, marginLeft: 4 }} />
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
            placeholder="Søk etter gjenstand eller navn…"
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
            <div key={i} style={{ height: 76, borderRadius: 16, background: 'rgba(196,103,58,0.05)' }} />
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
