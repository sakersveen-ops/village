// Path of this file: src/app/schedule/page.tsx
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

type TimelineRow = {
  item_id: string
  item_name: string
  item_image: string | null
  item_category: string
  owner_name: string | null
  loans: Loan[]
}

type PopupState = { loan: Loan; anchorRect: DOMRect } | null
type ViewMode = 'tidslinje' | 'liste'
type ListGroup = 'gjenstand' | 'utlansdato' | 'person'
type LoanFilter = 'pagaende' | 'historikk'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAST_DAYS   = 60
const FUTURE_DAYS = 27
const TOTAL_DAYS  = PAST_DAYS + FUTURE_DAYS + 1
const COL_WIDTH   = 34
const ROW_HEIGHT  = 64
const LABEL_WIDTH = 116
const HEADER_H    = 46

// ---------------------------------------------------------------------------
// Status colour system
//
//   pending          → amber  (forespurt, ingen handling ennå)
//   confirmed        → blå    (godtatt, venter henting)
//   active           → grønn  (aktivt lån)
//   change_proposed  → amber  (endringsforslag)
//   pending_return   → blå    (låntaker merket levert, venter bekreftelse)
//   overdue          → rød    (forfalt)
//   declined         → grå
//   returned         → grå dempet
// ---------------------------------------------------------------------------

type BarStyle = {
  background: string
  border?: string
  opacity?: number
  badgeBg: string
  badgeColor: string
  label: string
  pillClass: 'amber' | 'blue' | 'green' | 'red' | 'gray'
}

function loanBarStyle(status: string, role: 'lender' | 'borrower'): BarStyle {
  switch (status) {
    case 'pending':
      return role === 'lender'
        ? { background: 'rgba(46,98,113,0.18)', border: '2px dashed rgba(46,98,113,0.55)',
            badgeBg: '#FAEEDA', badgeColor: '#633806', label: 'Handling kreves', pillClass: 'amber' }
        : { background: 'rgba(46,98,113,0.35)',
            badgeBg: '#FAEEDA', badgeColor: '#633806', label: 'Venter godkjenning', pillClass: 'amber' }

    case 'confirmed':
      return { background: 'rgba(56,138,221,0.45)',
        badgeBg: '#E6F1FB', badgeColor: '#185FA5', label: 'Klar til henting', pillClass: 'blue' }

    case 'active':
      return { background: 'var(--terra-green)',
        badgeBg: '#EAF3DE', badgeColor: '#27500A', label: 'Aktivt lån', pillClass: 'green' }

    case 'change_proposed':
      return { background: 'rgba(46,98,113,0.45)',
        badgeBg: '#FAEEDA', badgeColor: '#633806', label: 'Endringsforslag', pillClass: 'amber' }

    case 'pending_return':
      return { background: 'rgba(56,138,221,0.55)',
        badgeBg: '#E6F1FB', badgeColor: '#185FA5', label: 'Venter retur-bekreftelse', pillClass: 'blue' }

    case 'overdue':
      return { background: 'rgba(226,75,74,0.7)',
        badgeBg: '#FCEBEB', badgeColor: '#791F1F', label: 'Forfalt', pillClass: 'red' }

    case 'declined':
      return { background: 'rgba(107,122,130,0.3)',
        badgeBg: 'var(--glass-bg)', badgeColor: '#5F5E5A', label: 'Avslått', pillClass: 'gray' }

    default: // returned
      return { background: 'rgba(107,122,130,0.2)', opacity: 0.55,
        badgeBg: 'var(--glass-bg)', badgeColor: '#5F5E5A', label: 'Returnert', pillClass: 'gray' }
  }
}

const STATUS_ORDER: Record<string, number> = {
  overdue: 0, pending: 1, change_proposed: 2,
  confirmed: 3, pending_return: 4, active: 5, returned: 6, declined: 7,
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
    const m = d.toLocaleDateString('no-NO', { month: 'short' }).replace('.', '').toUpperCase()
    if (m !== cur) { out.push({ label: m, count: 1 }); cur = m }
    else out[out.length - 1].count++
  }
  return out
}
function daysUntil(iso: string): { text: string; urgent: boolean } {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (d < 0)  return { text: `${Math.abs(d)}d over tid`, urgent: true }
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
  const [tab, setTab]               = useState<'mine_utlan' | 'mine_lan'>('mine_utlan')
  const [viewMode, setViewMode]     = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('schedule_view') as ViewMode) || 'tidslinje'
    }
    return 'tidslinje'
  })
  const [listGroup, setListGroup]   = useState<ListGroup>('utlansdato')
  const [loanFilter, setLoanFilter] = useState<LoanFilter>('pagaende')
  const [popup, setPopup]           = useState<PopupState>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  function handleSetViewMode(m: ViewMode) {
    setViewMode(m)
    if (typeof window !== 'undefined') sessionStorage.setItem('schedule_view', m)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const startDay = addDays(today, -PAST_DAYS)   // grid starts 60d ago
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(startDay, i))

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const activeStatuses = ['pending', 'confirmed', 'active', 'change_proposed', 'pending_return', 'overdue']
      const historyStatuses = ['returned', 'declined']
      const allStatuses = [...activeStatuses, ...historyStatuses]

      const { data: lendRows } = await supabase
        .from('loans')
        .select(`*, items(name,image_url,category),
          owner_profile:profiles!loans_owner_id_fkey(name),
          counterpart:profiles!loans_borrower_id_fkey(name,email,avatar_url)`)
        .eq('owner_id', user.id).in('status', allStatuses).order('start_date')

      const { data: borrowRows } = await supabase
        .from('loans')
        .select(`*, items(name,image_url,category),
          owner_profile:profiles!loans_owner_id_fkey(name),
          counterpart:profiles!loans_owner_id_fkey(name,email,avatar_url)`)
        .eq('borrower_id', user.id).in('status', allStatuses).order('start_date')

      const norm = (rows: any[], role: 'lender' | 'borrower'): Loan[] =>
        (rows || []).map(r => ({ ...r, role }))

      setMyLoans(norm(lendRows || [], 'lender'))
      setTheirLoans(norm(borrowRows || [], 'borrower'))
      setLoading(false)
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = PAST_DAYS * COL_WIDTH - 16
      }, 80)
    }
    load()
  }, [])

  // ── Quick actions from popup ──────────────────────────────────────────────

  async function handleConfirmPickup(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'active' }).eq('id', loanId)
    await supabase.from('items').update({ available: false }).eq('id', popup?.loan.item_id ?? '')
    setMyLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'active' } : l))
    setActionLoading(false)
    setPopup(null)
  }

  async function handleAcceptLoan(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'confirmed' }).eq('id', loanId).eq('status', 'pending')
    setMyLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'confirmed' } : l))
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

  async function handleConfirmReturn(loanId: string) {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    await supabase.from('items').update({ available: true }).eq('id', popup?.loan.item_id ?? '')
    setMyLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'returned' } : l))
    setActionLoading(false)
    setPopup(null)
  }

  // ── Build Gantt rows ──────────────────────────────────────────────────────

  function buildRows(loans: Loan[]): TimelineRow[] {
    const map = new Map<string, TimelineRow>()
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
    const ws = toYMD(startDay), we = toYMD(addDays(startDay, TOTAL_DAYS - 1))
    const s = loan.start_date < ws ? ws : loan.start_date
    const e = loan.due_date > we ? we : loan.due_date
    if (s > we || e < ws) return null
    return { left: daysBetween(ws, s) * COL_WIDTH + 2, width: Math.max((daysBetween(s, e) + 1) * COL_WIDTH - 4, 22) }
  }

  function handleBarTap(e: React.MouseEvent, loan: Loan) {
    e.stopPropagation()
    setPopup({ loan, anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect() })
  }

  const activeStatuses = ['pending', 'confirmed', 'active', 'change_proposed', 'pending_return', 'overdue']

  const currentLoans = tab === 'mine_utlan' ? myLoans : theirLoans

  // For timeline: always show active/pending (no history filter here)
  const timelineLoans = currentLoans.filter(l => activeStatuses.includes(l.status))
  const rows = buildRows(timelineLoans)
  const months = monthGroups(days)

  // For list: apply filter
  const baseListLoans = loanFilter === 'pagaende'
    ? currentLoans.filter(l => activeStatuses.includes(l.status))
    : currentLoans.filter(l => ['returned', 'declined'].includes(l.status))

  function sortLoans(loans: Loan[]): Loan[] {
    return [...loans].sort((a, b) => {
      if (listGroup === 'utlansdato') {
        const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
        if (so !== 0) return so
        return (a.start_date || '').localeCompare(b.start_date || '')
      }
      if (listGroup === 'gjenstand') {
        const nameA = (a.items?.name ?? '').toLowerCase()
        const nameB = (b.items?.name ?? '').toLowerCase()
        const nc = nameA.localeCompare(nameB, 'no')
        if (nc !== 0) return nc
        return (a.start_date || '').localeCompare(b.start_date || '')
      }
      // person
      const personA = (a.counterpart?.name ?? a.counterpart?.email ?? '').toLowerCase()
      const personB = (b.counterpart?.name ?? b.counterpart?.email ?? '').toLowerCase()
      const pc = personA.localeCompare(personB, 'no')
      if (pc !== 0) return pc
      return (a.start_date || '').localeCompare(b.start_date || '')
    })
  }

  const listLoans = sortLoans(baseListLoans)

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)', fontSize: 14 }}>Laster…</div>
  )

  // ── Popup ─────────────────────────────────────────────────────────────────

  function PopupCard() {
    if (!popup) return null
    const { loan, anchorRect } = popup
    const bs = loanBarStyle(loan.status, loan.role)
    const cpName = loan.counterpart?.name ?? loan.counterpart?.email?.split('@')[0] ?? 'Ukjent'
    const ownerName = loan.owner_profile?.name ?? 'Ukjent'
    const top  = Math.min(anchorRect.bottom + 8, window.innerHeight - 320)
    const left = Math.max(12, Math.min(anchorRect.left - 8, window.innerWidth - 288))

    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setPopup(null)} />
        <div
          className="glass-heavy"
          style={{ position: 'fixed', top, left, width: 276, zIndex: 51, borderRadius: 18, padding: '15px 16px', boxShadow: '0 12px 40px rgba(26,37,48,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ borderRadius: 99, padding: '3px 10px', fontSize: 10.5, fontWeight: 700, background: bs.badgeBg, color: bs.badgeColor }}>
              {bs.label}
            </span>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: 'var(--terra-mid)', fontSize: 16, cursor: 'pointer', padding: 2 }}>✕</button>
          </div>

          <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 2px' }}>
            {loan.items?.name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '0 0 11px' }}>
            {loan.role === 'lender'
              ? `Lånt ut til ${cpName}`
              : `${possessive(ownerName)} gjenstand`}
          </p>

          <div style={{ borderTop: '1px solid rgba(46,98,113,0.1)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 13 }}>
            {[
              { label: 'Fra',      value: fmtMed(loan.start_date) },
              { label: 'Til',      value: fmtMed(loan.due_date)   },
              { label: 'Varighet', value: `${daysBetween(loan.start_date, loan.due_date) + 1} dager` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--terra-dark)', fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {/* pending → godta / avslå */}
            {loan.role === 'lender' && loan.status === 'pending' && (<>
              <button disabled={actionLoading} onClick={() => handleAcceptLoan(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: '#E6F1FB', color: '#185FA5', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Godta forespørsel
              </button>
              <button disabled={actionLoading} onClick={() => handleDeclineLoan(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: 'transparent', color: 'var(--terra-mid)', border: '1px solid rgba(107,122,130,0.3)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                Avslå
              </button>
            </>)}

            {/* confirmed → bekreft henting */}
            {loan.role === 'lender' && loan.status === 'confirmed' && (
              <button disabled={actionLoading} onClick={() => handleConfirmPickup(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: '#EAF3DE', color: '#27500A', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ✓ Bekreft henting — start lån
              </button>
            )}

            {/* pending_return → bekreft retur */}
            {loan.role === 'lender' && loan.status === 'pending_return' && (
              <button disabled={actionLoading} onClick={() => handleConfirmReturn(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: '#EAF3DE', color: '#27500A', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ✓ Bekreft retur — avslutt lån
              </button>
            )}

            {/* overdue → bekreft retur */}
            {loan.role === 'lender' && loan.status === 'overdue' && (
              <button disabled={actionLoading} onClick={() => handleConfirmReturn(loan.id)}
                style={{ padding: '9px 0', borderRadius: 11, background: '#FCEBEB', color: '#791F1F', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ✓ Marker som returnert
              </button>
            )}

            <button
              onClick={() => { setPopup(null); router.push(`/items/${loan.item_id}`) }}
              style={{ padding: '9px 0', borderRadius: 11, background: 'var(--terra)', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Åpne avtale →
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── List card ─────────────────────────────────────────────────────────────

  function ListCard({ loan }: { loan: Loan }) {
    const bs = loanBarStyle(loan.status, loan.role)
    const cpName = loan.counterpart?.name ?? loan.counterpart?.email?.split('@')[0] ?? 'Ukjent'
    const ownerName = loan.owner_profile?.name ?? null
    const { text: dueText, urgent } = daysUntil(loan.due_date)
    const emoji = CAT_EMOJI[loan.items?.category] ?? '📦'
    const isOverdue = loan.status === 'overdue'

    return (
      <div
        className="glass"
        style={{
          borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer',
          border: isOverdue ? '1px solid rgba(226,75,74,0.3)' : undefined,
        }}
        onClick={() => router.push(`/items/${loan.item_id}`)}
      >
        {loan.items?.image_url
          ? <img src={loan.items.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: 10, background: isOverdue ? 'rgba(226,75,74,0.1)' : 'rgba(46,98,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loan.items?.name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '0 0 4px' }}>
          {loan.role === 'lender' ? `Lånt ut til ${cpName}` : ownerName ? `${possessive(ownerName)} gjenstand` : 'Andres gjenstand'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--terra-mid)', margin: 0 }}>
            {fmtShort(loan.start_date)} → {fmtShort(loan.due_date)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bs.badgeBg, color: bs.badgeColor }}>
            {bs.label}
          </span>
          {loan.due_date && (
            <span style={{ fontSize: 10.5, color: isOverdue ? '#E24B4A' : urgent ? 'var(--terra)' : 'var(--terra-mid)', fontWeight: isOverdue ? 600 : 400 }}>
              {dueText}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto" onClick={() => setPopup(null)}>
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['mine_utlan', 'mine_lan'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`pill ${tab === t ? 'active' : ''}`} style={{ fontSize: 12 }}>
                {t === 'mine_utlan' ? 'Mine utlån' : 'Mine lån'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, color: 'var(--terra-mid)', fontWeight: 500 }}>Visningsvalg</span>
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(46,98,113,0.2)' }}>
              {(['tidslinje', 'liste'] as const).map(m => (
                <button key={m} onClick={() => handleSetViewMode(m)}
                  style={{ padding: '5px 11px', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === m ? 'var(--terra)' : 'transparent',
                    color: viewMode === m ? 'white' : 'var(--terra-mid)',
                    transition: 'background 150ms' }}>
                  {m === 'tidslinje' ? '▦ Tidslinje' : '☰ Liste'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List sub-controls */}
        {viewMode === 'liste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {/* Row 1: Pågående / Historikk */}
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'pagaende',  label: 'Pågående' },
                { id: 'historikk', label: 'Historikk' },
              ] as { id: LoanFilter; label: string }[]).map(f => (
                <button key={f.id} onClick={() => setLoanFilter(f.id)}
                  className={`pill ${loanFilter === f.id ? 'active' : ''}`}
                  style={{ fontSize: 12 }}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Row 2: Sorter */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 10.5, color: 'var(--terra-mid)', fontWeight: 500, whiteSpace: 'nowrap' }}>Sorter</span>
              {([
                { id: 'utlansdato', label: 'Utlånsdato' },
                { id: 'gjenstand',  label: 'Gjenstand'  },
                { id: 'person',     label: tab === 'mine_utlan' ? 'Låntaker' : 'Utlåner' },
              ] as { id: ListGroup; label: string }[]).map(g => (
                <button key={g.id} onClick={() => setListGroup(g.id)}
                  className={`pill ${listGroup === g.id ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '3px 9px' }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {rows.length === 0 && viewMode === 'tidslinje' ? (
        <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>
            {tab === 'mine_utlan' ? 'Ingen utlån' : 'Ingen innlån'}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {tab === 'mine_utlan' ? 'Låneavtaler for dine gjenstander vises her.' : 'Gjenstander du har lånt vises her.'}
          </p>
        </div>
      ) : listLoans.length === 0 && viewMode === 'liste' ? (
        <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>
            {loanFilter === 'historikk' ? 'Ingen historikk' : tab === 'mine_utlan' ? 'Ingen utlån' : 'Ingen innlån'}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {loanFilter === 'historikk' ? 'Tidligere låneavtaler vises her.' : tab === 'mine_utlan' ? 'Låneavtaler for dine gjenstander vises her.' : 'Gjenstander du har lånt vises her.'}
          </p>
        </div>
      ) : viewMode === 'liste' ? (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listLoans.map(l => <ListCard key={l.id} loan={l} />)}
        </div>
      ) : (
        <>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, padding: '10px 14px 6px', flexWrap: 'wrap' }}>
            {[
              { bg: 'rgba(46,98,113,0.35)',        label: 'Forespurt' },
              { bg: 'rgba(56,138,221,0.45)',          label: 'Godtatt' },
              { bg: 'var(--terra-green)',              label: 'Aktivt' },
              { bg: 'rgba(226,75,74,0.7)',             label: 'Forfalt' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 10, borderRadius: 3, background: l.bg, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--terra-mid)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ display: 'flex', overflow: 'hidden' }}>
            {/* Fixed label col */}
            <div style={{ width: LABEL_WIDTH, flexShrink: 0, background: 'rgba(252,254,255,0.92)' }}>
              <div style={{ height: HEADER_H, borderBottom: '1px solid rgba(46,98,113,0.1)' }} />
              {rows.map(row => (
                <div key={row.item_id}
                  style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 12px', borderBottom: '1px solid rgba(46,98,113,0.07)', cursor: 'pointer' }}
                  onClick={() => router.push(`/items/${row.item_id}`)}>
                  {row.item_image
                    ? <img src={row.item_image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(46,98,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {CAT_EMOJI[row.item_category] ?? '📦'}
                      </div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--terra-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.item_name}
                    </p>
                    {tab === 'mine_lan' && row.owner_name && (
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
                <div style={{ display: 'flex', height: 22, borderBottom: '1px solid rgba(46,98,113,0.1)' }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ width: m.count * COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 9, fontWeight: 800, color: 'var(--terra-mid)', letterSpacing: '0.07em' }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Day row */}
                <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(46,98,113,0.12)' }}>
                  {days.map((d, i) => {
                    const isToday = i === PAST_DAYS
                    return (
                      <div key={i} style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: isToday ? 'var(--terra)' : 'var(--terra-mid)', fontWeight: isToday ? 800 : 400, background: isToday ? 'rgba(46,98,113,0.06)' : undefined }}>
                        {d.getDate()}
                      </div>
                    )
                  })}
                </div>
                {/* Data rows */}
                {rows.map(row => (
                  <div key={row.item_id} style={{ height: ROW_HEIGHT, position: 'relative', borderBottom: '1px solid rgba(46,98,113,0.06)' }}>
                    <div style={{ position: 'absolute', left: PAST_DAYS * COL_WIDTH, top: 0, width: COL_WIDTH, height: '100%', background: 'rgba(46,98,113,0.04)', borderLeft: '1px solid rgba(46,98,113,0.16)', pointerEvents: 'none' }} />
                    {row.loans.map(loan => {
                      const geo = barGeo(loan)
                      if (!geo) return null
                      const bs = loanBarStyle(loan.status, loan.role)
                      const textColor = ['pending', 'confirmed', 'pending_return'].includes(loan.status) && loan.role === 'lender' ? bs.badgeColor : 'white'
                      return (
                        <div key={loan.id} onClick={e => handleBarTap(e, loan)}
                          style={{ position: 'absolute', left: geo.left, width: geo.width, top: 13, height: ROW_HEIGHT - 26, borderRadius: 8, background: bs.background, border: bs.border, opacity: bs.opacity, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 7, boxSizing: 'border-box' }}>
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
            {fmtShort(toYMD(startDay))} – {fmtShort(toYMD(addDays(startDay, TOTAL_DAYS - 1)))}
          </p>
        </>
      )}

      <PopupCard />
      <div className="nav-spacer" />
    </div>
  )
}
