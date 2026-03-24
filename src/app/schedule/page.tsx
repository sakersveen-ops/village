'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Loan = {
  id: string
  item_id: string
  owner_id: string
  borrower_id: string
  status: string
  start_date: string
  due_date: string
  role: 'lender' | 'borrower'
  items: { name: string; image_url: string | null; category: string }
  owner_profile: { name: string | null }
  counterpart: { name: string | null; email: string | null; avatar_url: string | null }
}

type GanttRow = {
  item_id: string
  item_name: string
  item_image: string | null
  item_category: string
  owner_name: string | null
  loans: Loan[]
}

type PopupState = {
  loan: Loan
  anchorRect: DOMRect
} | null

type ViewMode = 'gantt' | 'liste'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAST_DAYS   = 3
const FUTURE_DAYS = 27
const TOTAL_DAYS  = PAST_DAYS + FUTURE_DAYS + 1
const COL_WIDTH   = 34
const ROW_HEIGHT  = 64
const LABEL_WIDTH = 116
const HEADER_H    = 46

// Colour scheme:
// confirmed/active   → solid green
// pending (borrower) → light green (solid, lighter opacity)
// pending (lender)   → dashed green outline (action required — you need to respond)
// change_proposed    → terra-mid muted
// returned           → very faded

type BarStyle = {
  background: string
  border?: string
  opacity?: number
  badgeBg: string
  badgeText: string
  label: string
}

function loanBarStyle(status: string, role: 'lender' | 'borrower'): BarStyle {
  if (status === 'active') return {
    background: 'var(--terra-green)',
    badgeBg: 'rgba(74,124,89,0.12)', badgeText: 'var(--terra-green)', label: 'Aktivt lån',
  }
  if (status === 'pending' && role === 'borrower') return {
    background: 'rgba(74,124,89,0.45)',
    badgeBg: 'rgba(74,124,89,0.1)', badgeText: 'var(--terra-green)', label: 'Venter på godkjenning',
  }
  if (status === 'pending' && role === 'lender') return {
    // dashed = action required — owner must respond
    background: 'rgba(74,124,89,0.15)',
    border: '2px dashed rgba(74,124,89,0.6)',
    badgeBg: 'rgba(74,124,89,0.1)', badgeText: 'var(--terra-green)', label: 'Venter på din godkjenning',
  }
  if (status === 'change_proposed') return {
    background: 'rgba(156,123,101,0.55)',
    badgeBg: 'rgba(156,123,101,0.12)', badgeText: 'var(--terra-mid)', label: 'Endringsforslag',
  }
  // returned
  return {
    background: 'rgba(156,123,101,0.22)',
    opacity: 0.6,
    badgeBg: 'rgba(156,123,101,0.08)', badgeText: 'var(--terra-mid)', label: 'Returnert',
  }
}

const CAT_EMOJI: Record<string, string> = {
  'hjem-og-hage': '🏠', 'baby-og-barn': '🧸', 'fest-og-arrangement': '🎉',
  'friluft-og-sport': '⛷️', 'klar-og-mote': '👗', 'boker': '📚',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}
function fmtMed(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}
function monthGroups(days: Date[]) {
  const out: { label: string; count: number }[] = []
  let cur = ''
  for (const d of days) {
    const m = d.toLocaleDateString('no-NO', { month: 'short' }).replace('.','').toUpperCase()
    if (m !== cur) { out.push({ label: m, count: 1 }); cur = m }
    else out[out.length-1].count++
  }
  return out
}
function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (d < 0) return { text: `${Math.abs(d)}d over tid`, urgent: true }
  if (d === 0) return { text: 'I dag', urgent: true }
  if (d === 1) return { text: 'I morgen', urgent: false }
  return { text: `Om ${d} d`, urgent: false }
}
function possessive(n: string) { return n.endsWith('s') ? `${n}'` : `${n}s` }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const [myLoans, setMyLoans]       = useState<Loan[]>([])
  const [theirLoans, setTheirLoans] = useState<Loan[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'mine' | 'andres'>('andres')  // default = andres
  const [viewMode, setViewMode]     = useState<ViewMode>('gantt')
  const [popup, setPopup]           = useState<PopupState>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const today = new Date(); today.setHours(0,0,0,0)
  const startDay = addDays(today, -PAST_DAYS)
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(startDay, i))

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const statuses = ['pending','active','change_proposed','returned']

      const { data: lendRows } = await supabase
        .from('loans')
        .select(`*, items(name,image_url,category),
          owner_profile:profiles!loans_owner_id_fkey(name),
          counterpart:profiles!loans_borrower_id_fkey(name,email,avatar_url)`)
        .eq('owner_id', user.id).in('status', statuses).order('start_date')

      const { data: borrowRows } = await supabase
        .from('loans')
        .select(`*, items(name,image_url,category),
          owner_profile:profiles!loans_owner_id_fkey(name),
          counterpart:profiles!loans_owner_id_fkey(name,email,avatar_url)`)
        .eq('borrower_id', user.id).in('status', statuses).order('start_date')

      const norm = (rows: any[], role: 'lender'|'borrower'): Loan[] =>
        (rows||[]).map(r => ({ ...r, role, owner_profile: r.owner_profile, counterpart: r.counterpart }))

      setMyLoans(norm(lendRows||[], 'lender'))
      setTheirLoans(norm(borrowRows||[], 'borrower'))
      setLoading(false)
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = PAST_DAYS * COL_WIDTH - 8
      }, 80)
    }
    load()
  }, [])

  // -------------------------------------------------------------------------
  // Quick actions from popup
  // -------------------------------------------------------------------------

  async function handleAcceptLoan(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'active' }).eq('id', loanId).eq('status', 'pending')
    await supabase.from('items').update({ available: false })
      .eq('id', popup?.loan.item_id ?? '')
    setMyLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'active' } : l))
    setActionLoading(false)
    setPopup(null)
  }

  async function handleDeclineLoan(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'declined' }).eq('id', loanId).eq('status', 'pending')
    setMyLoans(prev => prev.filter(l => l.id !== loanId))
    setActionLoading(false)
    setPopup(null)
  }

  async function handleMarkReturned(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    await supabase.from('items').update({ available: true })
      .eq('id', popup?.loan.item_id ?? '')
    setMyLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'returned' } : l))
    setActionLoading(false)
    setPopup(null)
  }

  // -------------------------------------------------------------------------
  // Build Gantt rows
  // -------------------------------------------------------------------------

  function buildRows(loans: Loan[]): GanttRow[] {
    const map = new Map<string, GanttRow>()
    for (const l of loans) {
      if (!map.has(l.item_id)) map.set(l.item_id, {
        item_id: l.item_id, item_name: l.items?.name ?? '',
        item_image: l.items?.image_url ?? null, item_category: l.items?.category ?? '',
        owner_name: l.owner_profile?.name ?? null, loans: [],
      })
      map.get(l.item_id)!.loans.push(l)
    }
    return Array.from(map.values())
  }

  function barGeo(loan: Loan): { left: number; width: number } | null {
    if (!loan.start_date || !loan.due_date) return null
    const ws = toYMD(startDay), we = toYMD(addDays(startDay, TOTAL_DAYS-1))
    const s = loan.start_date < ws ? ws : loan.start_date
    const e = loan.due_date > we ? we : loan.due_date
    if (s > we || e < ws) return null
    return { left: daysBetween(ws, s)*COL_WIDTH + 2, width: Math.max((daysBetween(s,e)+1)*COL_WIDTH-4, 22) }
  }

  function handleBarTap(e: React.MouseEvent, loan: Loan) {
    e.stopPropagation()
    setPopup({ loan, anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect() })
  }

  const currentLoans = tab === 'mine' ? myLoans : theirLoans
  const rows = buildRows(currentLoans)
  const months = monthGroups(days)

  // Sort list view by start_date, active first
  const listLoans = [...currentLoans].sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, change_proposed: 1, pending: 2, returned: 3 }
    const so = (statusOrder[a.status]??9) - (statusOrder[b.status]??9)
    if (so !== 0) return so
    return (a.start_date||'').localeCompare(b.start_date||'')
  })

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)', fontSize: 14 }}>Laster…</div>
  )

  // -------------------------------------------------------------------------
  // Popup
  // -------------------------------------------------------------------------

  function PopupCard() {
    if (!popup) return null
    const { loan, anchorRect } = popup
    const bs = loanBarStyle(loan.status, loan.role)
    const cpName = loan.counterpart?.name ?? loan.counterpart?.email?.split('@')[0] ?? 'Ukjent'
    const ownerName = loan.owner_profile?.name ?? 'Ukjent'
    const top  = Math.min(anchorRect.bottom + 8, window.innerHeight - 280)
    const left = Math.max(12, Math.min(anchorRect.left - 8, window.innerWidth - 288))

    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setPopup(null)} />
        <div
          className="glass-heavy"
          style={{ position: 'fixed', top, left, width: 276, zIndex: 51, borderRadius: 18, padding: '15px 16px', boxShadow: '0 12px 40px rgba(44,26,14,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Status + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ borderRadius: 99, padding: '3px 10px', fontSize: 10.5, fontWeight: 700, background: bs.badgeBg, color: bs.badgeText }}>
              {bs.label}
            </span>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: 'var(--terra-mid)', fontSize: 16, cursor: 'pointer', padding: 2 }}>✕</button>
          </div>

          {/* Item + owner */}
          <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 2px' }}>
            {loan.items?.name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '0 0 11px' }}>
            {loan.role === 'lender'
              ? `Lånt ut til ${cpName}`
              : `${possessive(ownerName)} gjenstand · lånt til deg`}
          </p>

          {/* Details */}
          <div style={{ borderTop: '1px solid rgba(196,103,58,0.1)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Fra',      value: fmtMed(loan.start_date) },
              { label: 'Til',      value: fmtMed(loan.due_date)   },
              { label: 'Varighet', value: `${daysBetween(loan.start_date, loan.due_date)+1} dager` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--terra-dark)', fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Context actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 13 }}>
            {/* Lender + pending: accept / decline */}
            {loan.role === 'lender' && loan.status === 'pending' && (
              <>
                <button
                  disabled={actionLoading}
                  onClick={() => handleAcceptLoan(loan.id)}
                  style={{ padding: '9px 0', borderRadius: 11, background: 'var(--terra-green)', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  ✓ Godta forespørsel
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleDeclineLoan(loan.id)}
                  style={{ padding: '9px 0', borderRadius: 11, background: 'transparent', color: 'var(--terra-mid)', border: '1px solid rgba(156,123,101,0.3)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                >
                  Avslå
                </button>
              </>
            )}
            {/* Lender + active: mark returned */}
            {loan.role === 'lender' && loan.status === 'active' && (
              <button
                disabled={actionLoading}
                onClick={() => handleMarkReturned(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: 'rgba(74,124,89,0.1)', color: 'var(--terra-green)', border: '1px solid rgba(74,124,89,0.2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                ✓ Marker som returnert
              </button>
            )}
            {/* Always: open item page (use router.push, not Link, to avoid nesting issues) */}
            <button
              onClick={() => { setPopup(null); router.push(`/items/${loan.item_id}`) }}
              style={{ padding: '9px 0', borderRadius: 11, background: 'var(--terra)', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {loan.role === 'borrower' && ['active','change_proposed'].includes(loan.status)
                ? 'Forleng / endre avtale →'
                : 'Åpne avtale →'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // -------------------------------------------------------------------------
  // List card
  // -------------------------------------------------------------------------

  function ListCard({ loan }: { loan: Loan }) {
    const bs = loanBarStyle(loan.status, loan.role)
    const cpName = loan.counterpart?.name ?? loan.counterpart?.email?.split('@')[0] ?? 'Ukjent'
    const ownerName = loan.owner_profile?.name ?? null
    const { text: dueText, urgent } = daysUntil(loan.due_date)
    const emoji = CAT_EMOJI[loan.items?.category] ?? '📦'

    return (
      <div
        className="glass"
        style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}
        onClick={() => router.push(`/items/${loan.item_id}`)}
      >
        {loan.items?.image_url
          ? <img src={loan.items.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(196,103,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loan.items?.name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '0 0 4px' }}>
            {loan.role === 'lender'
              ? `Lånt ut til ${cpName}`
              : ownerName ? `${possessive(ownerName)} gjenstand` : 'Andres gjenstand'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--terra-mid)', margin: 0 }}>
            {fmtShort(loan.start_date)} → {fmtShort(loan.due_date)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bs.badgeBg, color: bs.badgeText }}>
            {bs.label}
          </span>
          {loan.due_date && (
            <span style={{ fontSize: 10.5, color: urgent ? 'var(--terra)' : 'var(--terra-mid)' }}>
              {dueText}
            </span>
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto" onClick={() => setPopup(null)}>

      {/* Header — compact to avoid overlap with navbar title */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        {/* Row 1: tabs + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['andres','mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`pill ${tab===t?'active':''}`} style={{ fontSize: 12 }}>
                {t === 'mine' ? 'Mine' : 'Andres'}
              </button>
            ))}
          </div>
          {/* View mode toggle */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(196,103,58,0.2)' }}>
            {(['gantt','liste'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: '5px 11px', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === m ? 'var(--terra)' : 'transparent',
                  color: viewMode === m ? 'white' : 'var(--terra-mid)',
                  transition: 'background 150ms',
                }}
              >
                {m === 'gantt' ? '▦ Gantt' : '☰ Liste'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>
            {tab === 'mine' ? 'Ingen utlån' : 'Ingen innlån'}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {tab === 'mine' ? 'Låneavtaler for dine gjenstander vises her.' : 'Gjenstander du har lånt vises her.'}
          </p>
        </div>
      ) : viewMode === 'liste' ? (
        // ── LIST VIEW ──────────────────────────────────────────────────────
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listLoans.map(l => <ListCard key={l.id} loan={l} />)}
        </div>
      ) : (
        // ── GANTT VIEW ─────────────────────────────────────────────────────
        <>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, padding: '10px 14px 6px', flexWrap: 'wrap' }}>
            {[
              { bg: 'var(--terra-green)',        label: 'Bekreftet' },
              { bg: 'rgba(74,124,89,0.45)',       label: 'Venter bekreftelse' },
              { bg: 'rgba(74,124,89,0.15)', border: '2px dashed rgba(74,124,89,0.6)', label: 'Handling kreves' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 10, borderRadius: 3, background: l.bg, border: l.border, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--terra-mid)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ display: 'flex', overflow: 'hidden' }}>

            {/* Fixed label col */}
            <div style={{ width: LABEL_WIDTH, flexShrink: 0, background: 'rgba(255,248,243,0.92)' }}>
              <div style={{ height: HEADER_H, borderBottom: '1px solid rgba(196,103,58,0.1)' }} />
              {rows.map(row => (
                <div
                  key={row.item_id}
                  style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 12px', borderBottom: '1px solid rgba(196,103,58,0.07)', cursor: 'pointer' }}
                  onClick={() => router.push(`/items/${row.item_id}`)}
                >
                  {row.item_image
                    ? <img src={row.item_image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(196,103,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {CAT_EMOJI[row.item_category] ?? '📦'}
                      </div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--terra-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.item_name}
                    </p>
                    {tab === 'andres' && row.owner_name && (
                      <p style={{ fontSize: 10, color: 'var(--terra-mid)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {possessive(row.owner_name)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Scrollable grid */}
            <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ width: TOTAL_DAYS * COL_WIDTH }}>

                {/* Month row */}
                <div style={{ display: 'flex', height: 22, borderBottom: '1px solid rgba(196,103,58,0.1)' }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ width: m.count*COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 9, fontWeight: 800, color: 'var(--terra-mid)', letterSpacing: '0.07em' }}>
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Day row */}
                <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(196,103,58,0.12)' }}>
                  {days.map((d, i) => {
                    const isToday = i === PAST_DAYS
                    return (
                      <div key={i} style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: isToday ? 'var(--terra)' : 'var(--terra-mid)', fontWeight: isToday ? 800 : 400, background: isToday ? 'rgba(196,103,58,0.06)' : undefined }}>
                        {d.getDate()}
                      </div>
                    )
                  })}
                </div>

                {/* Data rows */}
                {rows.map(row => (
                  <div key={row.item_id} style={{ height: ROW_HEIGHT, position: 'relative', borderBottom: '1px solid rgba(196,103,58,0.06)' }}>
                    {/* Today highlight */}
                    <div style={{ position: 'absolute', left: PAST_DAYS*COL_WIDTH, top: 0, width: COL_WIDTH, height: '100%', background: 'rgba(196,103,58,0.04)', borderLeft: '1px solid rgba(196,103,58,0.16)', pointerEvents: 'none' }} />

                    {row.loans.map(loan => {
                      const geo = barGeo(loan)
                      if (!geo) return null
                      const bs = loanBarStyle(loan.status, loan.role)
                      const textColor = loan.status === 'pending' && loan.role === 'lender' ? 'var(--terra-green)' : 'white'
                      return (
                        <div
                          key={loan.id}
                          onClick={e => handleBarTap(e, loan)}
                          style={{
                            position: 'absolute', left: geo.left, width: geo.width,
                            top: 13, height: ROW_HEIGHT - 26,
                            borderRadius: 8, background: bs.background,
                            border: bs.border, opacity: bs.opacity,
                            cursor: 'pointer', overflow: 'hidden',
                            display: 'flex', alignItems: 'center', paddingLeft: 7,
                            boxShadow: '0 1px 3px rgba(44,26,14,0.08)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {loan.counterpart?.name ?? ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--terra-mid)', textAlign: 'center', padding: '8px 0' }}>
            {fmtShort(toYMD(startDay))} – {fmtShort(toYMD(addDays(startDay, TOTAL_DAYS-1)))}
          </p>
        </>
      )}

      <PopupCard />
      <div className="nav-spacer" />
    </div>
  )
}
