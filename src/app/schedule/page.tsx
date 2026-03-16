'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'all', label: 'Alle', emoji: '✨' },
  { id: 'barn', label: 'Barn', emoji: '🧸' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

const CAT_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Venter',
  active: 'Aktiv',
  change_proposed: 'Endringsforslag',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function daysUntil(d: string): { text: string; urgent: boolean } {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return { text: `${Math.abs(diff)}d over tid`, urgent: true }
  if (diff === 0) return { text: 'I dag', urgent: true }
  if (diff === 1) return { text: 'I morgen', urgent: false }
  return { text: `Om ${diff} d`, urgent: false }
}

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

function LoanCard({ loan }: { loan: Loan }) {
  const isOverdue = loan.due_date && new Date(loan.due_date) < new Date()
  const { text: dueText, urgent } = loan.due_date ? daysUntil(loan.due_date) : { text: '', urgent: false }
  const cp = loan.counterpart
  const cpName = cp?.name || cp?.email?.split('@')[0] || 'Ukjent'
  const emoji = CAT_EMOJI[loan.items?.category] ?? '📦'

  const pillStyle = (() => {
    if (isOverdue && loan.status === 'active')
      return { background: '#FFF0E6', color: 'var(--terra)' }
    if (loan.status === 'active')
      return { background: '#EEF4F0', color: 'var(--terra-green)' }
    if (loan.status === 'pending' || loan.status === 'change_proposed')
      return { background: '#FEF9C3', color: '#854D0E' }
    return { background: '#F5F5F4', color: 'var(--terra-mid)' }
  })()

  return (
    <Link href={`/items/${loan.item_id}`}>
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
        style={{ background: '#fff' }}>
        {loan.items?.image_url
          ? <img src={loan.items.image_url} alt={loan.items.name}
              className="rounded-xl object-cover flex-shrink-0"
              style={{ width: 48, height: 48 }} />
          : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ width: 48, height: 48, background: '#E8DDD0' }}>{emoji}</div>
        }

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
            {loan.items?.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
            {loan.role === 'lender' ? `↑ Lånt ut til ${cpName}` : `↓ Lånt fra ${cpName}`}
          </p>
          {loan.start_date && loan.due_date && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
              {formatDate(loan.start_date)} → {formatDate(loan.due_date)}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={pillStyle}>
            {isOverdue && loan.status === 'active'
              ? 'Over tid'
              : STATUS_LABEL[loan.status] ?? loan.status}
          </span>
          {loan.due_date && dueText && (
            <p className="text-xs" style={{ color: urgent ? 'var(--terra)' : 'var(--terra-mid)' }}>
              {dueText}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function HistoryCard({ loan }: { loan: Loan }) {
  const cp = loan.counterpart
  const cpName = cp?.name || cp?.email?.split('@')[0] || 'Ukjent'
  const emoji = CAT_EMOJI[loan.items?.category] ?? '📦'
  const returned = loan.status === 'returned'

  return (
    <Link href={`/items/${loan.item_id}`}>
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: '#FAF7F2', opacity: 0.8 }}>
        {loan.items?.image_url
          ? <img src={loan.items.image_url} alt={loan.items.name}
              className="rounded-xl object-cover flex-shrink-0"
              style={{ width: 40, height: 40, filter: 'grayscale(0.3)' }} />
          : <div className="rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ width: 40, height: 40, background: '#E8DDD0' }}>{emoji}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-mid)' }}>
            {loan.items?.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
            {loan.role === 'lender' ? `Lånt ut til ${cpName}` : `Lånt fra ${cpName}`}
            {loan.due_date ? ` · ${formatDate(loan.due_date)}` : ''}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          style={returned
            ? { background: '#EEF4F0', color: 'var(--terra-green)' }
            : { background: '#F5F5F4', color: 'var(--terra-mid)' }}>
          {returned ? 'Returnert' : 'Avslått'}
        </span>
      </div>
    </Link>
  )
}

export default function SchedulePage() {
  const [activeLoans, setActiveLoans] = useState<Loan[]>([])
  const [historyLoans, setHistoryLoans] = useState<Loan[]>([])
  const [catFilter, setCatFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Lån jeg låner UT
      const { data: lendRows } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_borrower_id_fkey(name, email, avatar_url)')
        .eq('owner_id', user.id)
        .in('status', ['pending', 'active', 'change_proposed'])

      // Lån jeg har LÅNT
      const { data: borrowRows } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_owner_id_fkey(name, email, avatar_url)')
        .eq('borrower_id', user.id)
        .in('status', ['pending', 'active', 'change_proposed'])

      // Historikk — begge retninger
      const { data: histLend } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_borrower_id_fkey(name, email, avatar_url)')
        .eq('owner_id', user.id)
        .in('status', ['returned', 'declined'])
        .order('due_date', { ascending: false })
        .limit(30)

      const { data: histBorrow } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_owner_id_fkey(name, email, avatar_url)')
        .eq('borrower_id', user.id)
        .in('status', ['returned', 'declined'])
        .order('due_date', { ascending: false })
        .limit(30)

      // Normaliserer til felles format
      const normalize = (rows: any[], role: 'lender' | 'borrower'): Loan[] =>
        (rows || []).map(r => ({
          ...r,
          role,
          counterpart: r.profiles,
        }))

      // Aktive: fletter og sorterer på start_date
      const merged = [
        ...normalize(lendRows || [], 'lender'),
        ...normalize(borrowRows || [], 'borrower'),
      ].sort((a, b) => {
        const dateA = a.start_date || a.due_date || ''
        const dateB = b.start_date || b.due_date || ''
        return dateA.localeCompare(dateB)
      })

      // Historikk: sortert på due_date desc
      const hist = [
        ...normalize(histLend || [], 'lender'),
        ...normalize(histBorrow || [], 'borrower'),
      ].sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''))

      setActiveLoans(merged)
      setHistoryLoans(hist)
      setLoading(false)
    }
    load()
  }, [])

  const availableCategories = CATEGORIES.filter(c =>
    c.id === 'all' ||
    activeLoans.some(l => l.items?.category === c.id) ||
    historyLoans.some(l => l.items?.category === c.id)
  )

  const filterByCat = (loans: Loan[]) =>
    catFilter === 'all' ? loans : loans.filter(l => l.items?.category === catFilter)

  const filteredActive = filterByCat(activeLoans)
  const filteredHistory = filterByCat(historyLoans)

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <h1 className="page-header-title font-display">Avtaler</h1>
      </header>

      {/* Kategorifilter */}
      {availableCategories.length > 1 && (
        <div className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableCategories.map(cat => (
              <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-colors"
                style={catFilter === cat.id
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                }>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-5 flex flex-col gap-3">

        {/* Aktive og kommende lån — integrert liste sortert på dato */}
        {filteredActive.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">
              {catFilter === 'all'
                ? 'Ingen aktive avtaler akkurat nå'
                : 'Ingen aktive avtaler i denne kategorien'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredActive.map(loan => <LoanCard key={`${loan.id}-${loan.role}`} loan={loan} />)}
          </div>
        )}

        {/* Historikk — visuelt dempet, med tydelig skillekort */}
        {filteredHistory.length > 0 && (
          <>
            <div className="flex items-center gap-3 pt-4">
              <div className="flex-1 h-px" style={{ background: '#E8DDD0' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--terra-mid)' }}>Historikk</span>
              <div className="flex-1 h-px" style={{ background: '#E8DDD0' }} />
            </div>
            <div className="flex flex-col gap-2">
              {filteredHistory.map(loan => <HistoryCard key={`${loan.id}-${loan.role}-hist`} loan={loan} />)}
            </div>
          </>
        )}

      </div>

      <div className="nav-spacer" />
    </div>
  )
}
