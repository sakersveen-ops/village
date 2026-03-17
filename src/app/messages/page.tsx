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
  // derived
  requires_action: boolean
  counterpart_name: string | null
  counterpart_avatar: string | null
  item_label: string // "Din boremaskin" / "Karis skistaver"
}

type FilterState = {
  loanstatus: 'alle' | 'aktive' | 'fullforte'
  eier: 'alle' | 'mine' | 'andres'
  motpart: 'alle' | 'venner'
  type: 'alle' | 'handling' | 'info'
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
  const [filters, setFilters] = useState<FilterState>({
    loanstatus: 'aktive',
    eier: 'alle',
    motpart: 'alle',
    type: 'alle',
  })

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

    // Fetch all non-trivially-old loans where user is owner or borrower
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

    // Fetch last message per loan
    const loanIds = (loans ?? []).map((l: any) => l.id)
    let lastMessages: Record<string, { body: string; created_at: string; read: boolean }> = {}

    if (loanIds.length > 0) {
      const { data: msgs } = await supabase
        .from('loan_messages')
        .select('loan_id, body, created_at, sender_id')
        .in('loan_id', loanIds)
        .order('created_at', { ascending: false })

      // Keep only the latest per loan_id
      for (const m of (msgs ?? [])) {
        if (!lastMessages[m.loan_id]) {
          lastMessages[m.loan_id] = {
            body: m.body,
            created_at: m.created_at,
            read: m.sender_id === userId, // unread if someone else sent it last
          }
        }
      }
    }

    // Fetch friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_b')
      .eq('user_a', userId)

    const fIds = new Set((friendships ?? []).map((f: any) => f.user_b))
    setFriendIds(fIds)

    // Normalise into Thread[]
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
        unread: last ? !last.read : false,
        role,
        requires_action: requiresAction(loan.status, role),
        counterpart_name: counterpart?.name ?? null,
        counterpart_avatar: counterpart?.avatar_url ?? null,
        item_label: itemLabel(loan.owner?.name, userId, loan.owner_id, loan.items?.name ?? ''),
      }
    })

    setThreads(normalised)
    setLoading(false)
    track('messages_page_viewed')
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filtered = useMemo(() => {
    return threads.filter(t => {
      // Search
      if (search.length >= 2) {
        const q = search.toLowerCase()
        const matchName = t.counterpart_name?.toLowerCase().includes(q)
        const matchItem = t.item_name.toLowerCase().includes(q)
        if (!matchName && !matchItem) return false
      }

      // Lånstatus
      if (filters.loanstatus === 'aktive' && !isActive(t.loan_status)) return false
      if (filters.loanstatus === 'fullforte' && isActive(t.loan_status)) return false

      // Eier
      if (filters.eier === 'mine' && t.role !== 'lender') return false
      if (filters.eier === 'andres' && t.role !== 'borrower') return false

      // Motpart
      if (filters.motpart === 'venner' && !friendIds.has(
        t.role === 'lender' ? t.borrower_id : t.owner_id
      )) return false

      // Type
      if (filters.type === 'handling' && !t.requires_action) return false
      if (filters.type === 'info' && t.requires_action) return false

      return true
    })
  }, [threads, search, filters, friendIds])

  const actionThreads = filtered.filter(t => t.requires_action)
  const activeThreads = filtered.filter(t => !t.requires_action && isActive(t.loan_status))
  const doneThreads = filtered.filter(t => t.loan_status === 'returned')

  const totalUnread = threads.filter(t => t.unread).length
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = (
    (filters.loanstatus !== 'aktive' ? 1 : 0) +
    (filters.eier !== 'alle' ? 1 : 0) +
    (filters.motpart !== 'alle' ? 1 : 0) +
    (filters.type !== 'alle' ? 1 : 0)
  )

  // -------------------------------------------------------------------------
  // Filter helper
  // -------------------------------------------------------------------------

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
    track('messages_filter_changed', { filter: key, value })
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function Chip({ thread }: { thread: Thread }) {
    const chip = chipLabel(thread.loan_status, thread.role)
    if (!chip) return null
    const styles: Record<string, string> = {
      action: 'bg-[rgba(196,103,58,0.1)] text-[#C4673A] border border-[rgba(196,103,58,0.2)]',
      change: 'bg-[rgba(217,119,6,0.1)] text-[#B45309] border border-[rgba(217,119,6,0.2)]',
      active: 'bg-[rgba(74,124,89,0.1)] text-[#4A7C59] border border-[rgba(74,124,89,0.2)]',
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold mt-1.5 ${styles[chip.style]}`}>
        {chip.text}
      </span>
    )
  }

  function Avatar({ name, avatar }: { name: string | null; avatar: string | null }) {
    if (avatar) {
      return <img src={avatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt={name ?? ''} />
    }
    const initials = (name ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    return (
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
        style={{ background: '#C4673A' }}
      >
        {initials}
      </div>
    )
  }

  function ThreadCard({ thread, dimmed = false }: { thread: Thread; dimmed?: boolean }) {
    const cardBorder =
      thread.requires_action
        ? 'border-[rgba(196,103,58,0.28)] bg-[rgba(196,103,58,0.04)]'
        : thread.loan_status === 'active'
        ? 'border-[rgba(74,124,89,0.25)] bg-[rgba(74,124,89,0.04)]'
        : 'border-[rgba(196,103,58,0.13)] bg-[rgba(255,248,243,0.75)]'

    return (
      <div
        className={`rounded-2xl border px-3 py-2.5 cursor-pointer transition-opacity ${cardBorder} ${dimmed ? 'opacity-50' : ''}`}
        onClick={() => {
          track('messages_thread_opened', { loan_id: thread.loan_id, requires_action: thread.requires_action })
          router.push(`/items/${thread.item_id}`)
        }}
      >
        <div className="flex items-center gap-2.5">
          <Avatar name={thread.counterpart_name} avatar={thread.counterpart_avatar} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-0.5">
              <span style={{ color: '#2C1A0E', fontSize: 12.5, fontWeight: 500 }}>
                {thread.counterpart_name ?? 'Ukjent'}
              </span>
              <span style={{ color: '#9C7B65', fontSize: 10, flexShrink: 0 }}>
                {relativeTime(thread.last_message_at)}
              </span>
            </div>
            <div style={{ color: '#6B4F36', fontSize: 11.5, marginBottom: 2 }}>
              {thread.item_label}
            </div>
            <div
              style={{
                color: thread.unread ? '#6B4F36' : '#9C7B65',
                fontSize: 11,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {thread.last_message_body ?? 'Ingen meldinger ennå'}
            </div>
          </div>
          {thread.unread && (
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#C4673A' }} />
          )}
        </div>
        <Chip thread={thread} />
      </div>
    )
  }

  function FilterPills<K extends keyof FilterState>({
    label,
    filterKey,
    options,
  }: {
    label: string
    filterKey: K
    options: { value: FilterState[K]; label: string }[]
  }) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#9C7B65', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0, width: 52 }}>
          {label}
        </span>
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => setFilter(filterKey, opt.value)}
            className={`pill flex-shrink-0 whitespace-nowrap ${filters[filterKey] === opt.value ? 'active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <p style={{ fontSize: 10, fontWeight: 700, color: '#9C7B65', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 3px 2px' }}>
        {label}
      </p>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen" style={{ background: '#FDF5F0' }}>

      {/* Sticky header — søk + filterknapp */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <h1 className="page-header-title font-display">Meldinger</h1>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <span
              className="text-white font-bold rounded-full flex items-center justify-center"
              style={{ background: '#C4673A', width: 20, height: 20, fontSize: 11 }}
            >
              {totalUnread}
            </span>
          )}
          {/* Filterknapp */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className="btn-glass flex items-center gap-1.5"
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 10, position: 'relative' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="6" y1="12" x2="10" y2="12"/>
            </svg>
            Filtrer
            {activeFilterCount > 0 && (
              <span
                className="text-white font-bold rounded-full flex items-center justify-center"
                style={{ background: '#C4673A', width: 16, height: 16, fontSize: 9, position: 'absolute', top: -5, right: -5 }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Søkefelt — scrolles med siden */}
      <div className="px-4 pt-3 pb-2">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,248,243,0.8)', border: '1px solid rgba(196,103,58,0.18)', fontSize: 12, color: '#9C7B65' }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9C7B65" strokeWidth="2" strokeLinecap="round">
            <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
          </svg>
          <input
            type="text"
            placeholder="Søk i meldinger..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#2C1A0E', fontSize: 12 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: '#9C7B65', fontSize: 13, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* Filter-drawer — vises/skjules */}
      {showFilters && (
        <div className="mx-4 mb-2 rounded-2xl glass-heavy px-4 py-3 flex flex-col gap-2">
          <FilterPills
            label="Lånstatus"
            filterKey="loanstatus"
            options={[
              { value: 'aktive', label: 'Aktive' },
              { value: 'fullforte', label: 'Fullførte' },
              { value: 'alle', label: 'Alle' },
            ]}
          />
          <FilterPills
            label="Eier"
            filterKey="eier"
            options={[
              { value: 'alle', label: 'Alle' },
              { value: 'mine', label: 'Mine gjenstander' },
              { value: 'andres', label: 'Andres gjenstander' },
            ]}
          />
          <FilterPills
            label="Motpart"
            filterKey="motpart"
            options={[
              { value: 'alle', label: 'Alle' },
              { value: 'venner', label: 'Venner' },
            ]}
          />
          <FilterPills
            label="Type"
            filterKey="type"
            options={[
              { value: 'alle', label: 'Alle' },
              { value: 'handling', label: 'Krever handling' },
              { value: 'info', label: 'Til informasjon' },
            ]}
          />
        </div>
      )}

      {/* Trådliste */}
      <div className="px-3 pb-4 flex flex-col gap-1">
        {loading ? (
          <p style={{ color: '#9C7B65', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Laster meldinger…</p>
        ) : threads.length === 0 ? (
          /* Helt tomt — ingen lån i det hele tatt */
          <div style={{ textAlign: 'center', marginTop: 64, padding: '0 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.35 }}>💬</div>
            <p style={{ color: '#2C1A0E', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Ingen meldinger ennå
            </p>
            <p style={{ color: '#9C7B65', fontSize: 12, lineHeight: 1.6 }}>
              Her samles alle meldingstråder fra låneavtalene dine — både når du låner ut og når du låner av andre.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Har lån, men filteret gir null treff */
          <div style={{ textAlign: 'center', marginTop: 48, padding: '0 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}>🔍</div>
            <p style={{ color: '#9C7B65', fontSize: 13 }}>Ingen meldinger matcher filteret</p>
          </div>
        ) : (
          <>
            {actionThreads.length > 0 && (
              <>
                <SectionLabel label="Krever handling" />
                {actionThreads.map(t => <ThreadCard key={t.loan_id} thread={t} />)}
              </>
            )}
            {activeThreads.length > 0 && (
              <>
                <SectionLabel label="Aktive lån" />
                {activeThreads.map(t => <ThreadCard key={t.loan_id} thread={t} />)}
              </>
            )}
            {doneThreads.length > 0 && (
              <>
                <SectionLabel label="Fullførte" />
                {doneThreads.map(t => <ThreadCard key={t.loan_id} thread={t} dimmed />)}
              </>
            )}
          </>
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
