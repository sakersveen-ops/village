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
  counterpart: { name: string | null; email: string | null; avatar_url: string | null }
}

type GanttRow = {
  item_id: string
  item_name: string
  item_image: string | null
  loans: Loan[]
}

type PopupState = {
  loan: Loan
  x: number
  y: number
} | null

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// How many days to show in the Gantt window (today - PAST_DAYS … today + FUTURE_DAYS)
const PAST_DAYS = 3
const FUTURE_DAYS = 27
const TOTAL_DAYS = PAST_DAYS + FUTURE_DAYS + 1
const COL_WIDTH = 36  // px per day column
const ROW_HEIGHT = 56 // px per item row
const LABEL_WIDTH = 120 // px for item label column

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Status → bar colour
function statusColor(status: string): string {
  if (status === 'active') return 'var(--terra-green)'
  if (status === 'pending') return '#D97706'   // amber
  if (status === 'change_proposed') return '#9333EA' // purple
  return 'var(--terra-mid)'
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Aktivt lån'
  if (status === 'pending') return 'Venter på godkjenning'
  if (status === 'change_proposed') return 'Endringsforslag'
  if (status === 'returned') return 'Returnert'
  if (status === 'declined') return 'Avslått'
  return status
}

function monthsInRange(days: Date[]): { label: string; startIdx: number; count: number }[] {
  const months: { label: string; startIdx: number; count: number }[] = []
  let current = ''
  for (let i = 0; i < days.length; i++) {
    const m = days[i].toLocaleDateString('no-NO', { month: 'short' })
    if (m !== current) {
      months.push({ label: m, startIdx: i, count: 1 })
      current = m
    } else {
      months[months.length - 1].count++
    }
  }
  return months
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const [myLoans, setMyLoans] = useState<Loan[]>([])
  const [theirLoans, setTheirLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'mine' | 'andres'>('mine')
  const [popup, setPopup] = useState<PopupState>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = addDays(today, -PAST_DAYS)

  // Build array of Date objects for each column
  const days: Date[] = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(startDay, i))

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const statuses = ['pending', 'active', 'change_proposed', 'returned']

      // Mine gjenstander: I er eier
      const { data: lendRows } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_borrower_id_fkey(name, email, avatar_url)')
        .eq('owner_id', user.id)
        .in('status', statuses)
        .order('start_date')

      // Andres gjenstander: I er låner
      const { data: borrowRows } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_owner_id_fkey(name, email, avatar_url)')
        .eq('borrower_id', user.id)
        .in('status', statuses)
        .order('start_date')

      const normalize = (rows: any[], role: 'lender' | 'borrower'): Loan[] =>
        (rows || []).map(r => ({ ...r, role, counterpart: r.profiles }))

      setMyLoans(normalize(lendRows || [], 'lender'))
      setTheirLoans(normalize(borrowRows || [], 'borrower'))
      setLoading(false)

      // Scroll so today is visible with past days to the left
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = PAST_DAYS * COL_WIDTH - 16
        }
      }, 100)
    }
    load()
  }, [])

  // -------------------------------------------------------------------------
  // Build Gantt rows — group by item_id
  // -------------------------------------------------------------------------

  function buildRows(loans: Loan[]): GanttRow[] {
    const map = new Map<string, GanttRow>()
    for (const loan of loans) {
      const id = loan.item_id
      if (!map.has(id)) {
        map.set(id, {
          item_id: id,
          item_name: loan.items?.name ?? '',
          item_image: loan.items?.image_url ?? null,
          loans: [],
        })
      }
      map.get(id)!.loans.push(loan)
    }
    return Array.from(map.values())
  }

  const currentLoans = tab === 'mine' ? myLoans : theirLoans
  const rows = buildRows(currentLoans)

  // -------------------------------------------------------------------------
  // Gantt bar positioning
  // -------------------------------------------------------------------------

  function barStyle(loan: Loan): React.CSSProperties | null {
    if (!loan.start_date || !loan.due_date) return null

    const windowStart = toYMD(startDay)
    const windowEnd = toYMD(addDays(startDay, TOTAL_DAYS - 1))

    const barStart = loan.start_date < windowStart ? windowStart : loan.start_date
    const barEnd = loan.due_date > windowEnd ? windowEnd : loan.due_date

    if (barStart > windowEnd || barEnd < windowStart) return null

    const leftDays = daysBetween(windowStart, barStart)
    const widthDays = daysBetween(barStart, barEnd) + 1

    return {
      position: 'absolute',
      left: leftDays * COL_WIDTH + 3,
      width: Math.max(widthDays * COL_WIDTH - 6, 20),
      top: 10,
      height: ROW_HEIGHT - 20,
      borderRadius: 8,
      background: statusColor(loan.status),
      opacity: loan.status === 'returned' ? 0.4 : 0.85,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 8,
      paddingRight: 4,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      transition: 'opacity 150ms',
    }
  }

  // -------------------------------------------------------------------------
  // Popup
  // -------------------------------------------------------------------------

  function handleBarClick(e: React.MouseEvent, loan: Loan) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopup({ loan, x: rect.left, y: rect.bottom + 8 })
  }

  function Popup() {
    if (!popup) return null
    const { loan } = popup
    const cp = loan.counterpart
    const cpName = cp?.name ?? cp?.email?.split('@')[0] ?? 'Ukjent'

    return (
      <>
        {/* Backdrop */}
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setPopup(null)}
        />
        {/* Card */}
        <div
          className="glass-heavy"
          style={{
            position: 'fixed',
            top: Math.min(popup.y, window.innerHeight - 240),
            left: Math.max(12, Math.min(popup.x, window.innerWidth - 280)),
            width: 264,
            zIndex: 51,
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 8px 32px rgba(44,26,14,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{
              display: 'inline-block', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700,
              background: statusColor(loan.status) + '20',
              color: statusColor(loan.status),
              border: `1px solid ${statusColor(loan.status)}40`,
            }}>
              {statusLabel(loan.status)}
            </span>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: 'var(--terra-mid)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 4px' }}>
            {loan.items?.name}
          </p>
          <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '0 0 12px' }}>
            {loan.role === 'lender' ? `Lånt ut til ${cpName}` : `Lånt fra ${cpName}`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Fra" value={formatLongDate(loan.start_date)} />
            <Row label="Til" value={formatLongDate(loan.due_date)} />
            <Row label="Varighet" value={`${daysBetween(loan.start_date, loan.due_date) + 1} dager`} />
          </div>

          <Link href={`/items/${loan.item_id}`}
            onClick={() => setPopup(null)}
            style={{
              display: 'block', marginTop: 14, textAlign: 'center',
              padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'var(--terra)', color: 'white', textDecoration: 'none',
            }}>
            Åpne avtale →
          </Link>
        </div>
      </>
    )
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--terra-mid)' }}>{label}</span>
        <span style={{ color: 'var(--terra-dark)', fontWeight: 500 }}>{value}</span>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const todayIdx = PAST_DAYS // index in days[] for today
  const monthLabels = monthsInRange(days)

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--terra-mid)' }}>Laster…</div>
  )

  return (
    <div className="max-w-lg mx-auto" onClick={() => setPopup(null)}>

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <h1 className="page-header-title font-display" style={{ margin: '0 0 12px' }}>Avtaler</h1>
        {/* Tab: Mine / Andres */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['mine', 'andres'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pill ${tab === t ? 'active' : ''}`}
            >
              {t === 'mine' ? 'Mine gjenstander' : 'Andres gjenstander'}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 24px 0', color: 'var(--terra-mid)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 6 }}>
            {tab === 'mine' ? 'Ingen utlån' : 'Ingen innlån'}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {tab === 'mine'
              ? 'Låneavtaler for dine gjenstander vises her som en tidslinje.'
              : 'Gjenstander du har lånt fra andre vises her.'}
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, padding: '0 16px 12px', flexWrap: 'wrap' }}>
            {[
              { color: 'var(--terra-green)', label: 'Aktivt' },
              { color: '#D97706', label: 'Venter' },
              { color: '#9333EA', label: 'Endringsforslag' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                <span style={{ fontSize: 11, color: 'var(--terra-mid)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Gantt table: fixed label column + horizontal scroll area */}
          <div style={{ display: 'flex' }}>

            {/* Fixed label column */}
            <div style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              {/* Header spacer matching month + weekday rows */}
              <div style={{ height: 48 }} />
              {rows.map(row => (
                <Link key={row.item_id} href={`/items/${row.item_id}`}
                  style={{ textDecoration: 'none' }}>
                  <div style={{
                    height: ROW_HEIGHT, display: 'flex', alignItems: 'center',
                    gap: 8, padding: '0 8px 0 16px',
                    borderBottom: '1px solid rgba(196,103,58,0.1)',
                  }}>
                    {row.item_image
                      ? <img src={row.item_image} alt={row.item_name}
                          style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: 'rgba(196,103,58,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                        }}>📦</div>
                    }
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, color: 'var(--terra-dark)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.item_name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Scrollable Gantt area */}
            <div
              ref={scrollRef}
              style={{
                flex: 1, overflowX: 'auto', overflowY: 'hidden',
                scrollbarWidth: 'thin',
              }}
            >
              <div style={{ width: TOTAL_DAYS * COL_WIDTH, minWidth: '100%' }}>

                {/* Month header */}
                <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(196,103,58,0.12)' }}>
                  {monthLabels.map((m, i) => (
                    <div key={i} style={{
                      width: m.count * COL_WIDTH,
                      display: 'flex', alignItems: 'center', paddingLeft: 6,
                      fontSize: 10, fontWeight: 700, color: 'var(--terra-mid)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      flexShrink: 0,
                    }}>
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Day header */}
                <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(196,103,58,0.12)' }}>
                  {days.map((d, i) => {
                    const isToday = i === todayIdx
                    return (
                      <div key={i} style={{
                        width: COL_WIDTH, flexShrink: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9.5,
                        color: isToday ? 'var(--terra)' : 'var(--terra-mid)',
                        fontWeight: isToday ? 800 : 400,
                      }}>
                        {d.getDate()}
                      </div>
                    )
                  })}
                </div>

                {/* Data rows */}
                {rows.map(row => (
                  <div key={row.item_id} style={{
                    height: ROW_HEIGHT, position: 'relative',
                    borderBottom: '1px solid rgba(196,103,58,0.08)',
                  }}>
                    {/* Column backgrounds */}
                    {days.map((_, i) => {
                      const isToday = i === todayIdx
                      return (
                        <div key={i} style={{
                          position: 'absolute', left: i * COL_WIDTH, top: 0,
                          width: COL_WIDTH, height: '100%',
                          background: isToday
                            ? 'rgba(196,103,58,0.06)'
                            : i % 2 === 0 ? 'transparent' : 'rgba(196,103,58,0.02)',
                          borderLeft: isToday ? '1.5px solid rgba(196,103,58,0.3)' : undefined,
                        }} />
                      )
                    })}

                    {/* Loan bars */}
                    {row.loans.map(loan => {
                      const style = barStyle(loan)
                      if (!style) return null
                      return (
                        <div
                          key={loan.id}
                          style={style}
                          onClick={e => handleBarClick(e, loan)}
                        >
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: 'white',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
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

          {/* Date range label below chart */}
          <p style={{ fontSize: 11, color: 'var(--terra-mid)', textAlign: 'center', marginTop: 8, padding: '0 16px' }}>
            {formatShortDate(toYMD(startDay))} — {formatShortDate(toYMD(addDays(startDay, TOTAL_DAYS - 1)))}
          </p>
        </div>
      )}

      <div className="nav-spacer" />
      <Popup />
    </div>
  )
}
