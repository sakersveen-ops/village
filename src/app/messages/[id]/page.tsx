'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = {
  id: string
  loan_id: string
  sender_id: string
  type: 'chat' | 'change_proposal' | 'system'
  body: string
  metadata: any
  created_at: string
}

type LoanThread = {
  loan_id: string
  loan_status: string
  start_date: string
  due_date: string
  item_id: string
  item_name: string
  item_label: string
  role: 'lender' | 'borrower'
  messages: Message[]
}

type OtherUser = {
  id: string
  name: string | null
  avatar_url: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function possessive(name: string): string {
  if (!name) return ''
  return name.endsWith('s') ? `${name}'` : `${name}s`
}

function relativeTime(iso: string): string {
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

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Venter',
    active: 'Aktivt',
    change_proposed: 'Endringsforslag',
    returned: 'Levert',
    declined: 'Avslått',
  }
  return map[status] ?? status
}

function statusPillClass(status: string): string {
  if (status === 'active') return 'active'
  if (status === 'pending' || status === 'change_proposed') return 'pending'
  if (status === 'declined') return 'declined'
  return 'returned'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagesUserPage() {
  const router = useRouter()
  const params = useParams()
  const otherId = params.id as string
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [threads, setThreads] = useState<LoanThread[]>([])
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadAll(data.user.id)
    })
  }, [otherId])

  async function loadAll(userId: string) {
    setLoading(true)

    // Fetch other user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', otherId)
      .single()

    setOtherUser(profile)

    // Fetch all loans between the two users
    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id, status, start_date, due_date,
        owner_id, borrower_id,
        items ( id, name ),
        owner:profiles!loans_owner_id_fkey ( id, name, avatar_url )
      `)
      .or(
        `and(owner_id.eq.${userId},borrower_id.eq.${otherId}),and(owner_id.eq.${otherId},borrower_id.eq.${userId})`
      )
      .order('created_at', { ascending: false })

    if (!loans || loans.length === 0) {
      setThreads([])
      setLoading(false)
      return
    }

    const loanIds = loans.map((l: any) => l.id)

    // Fetch all messages for these loans
    const { data: msgs } = await supabase
      .from('loan_messages')
      .select('id, loan_id, sender_id, type, body, metadata, created_at')
      .in('loan_id', loanIds)
      .order('created_at', { ascending: true })

    const msgsByLoan: Record<string, Message[]> = {}
    for (const m of (msgs ?? [])) {
      if (!msgsByLoan[m.loan_id]) msgsByLoan[m.loan_id] = []
      msgsByLoan[m.loan_id].push(m)
    }

    const normalised: LoanThread[] = loans.map((loan: any) => {
      const role: 'lender' | 'borrower' = loan.owner_id === userId ? 'lender' : 'borrower'
      const ownerName = loan.owner?.name ?? null
      const itemName = loan.items?.name ?? ''
      const itemLabel = loan.owner_id === userId
        ? `Din ${itemName.toLowerCase()}`
        : `${possessive(ownerName ?? 'Eiers')} ${itemName.toLowerCase()}`

      return {
        loan_id: loan.id,
        loan_status: loan.status,
        start_date: loan.start_date,
        due_date: loan.due_date,
        item_id: loan.items?.id,
        item_name: itemName,
        item_label: itemLabel,
        role,
        messages: msgsByLoan[loan.id] ?? [],
      }
    })

    setThreads(normalised)

    // Default: open the first active/pending loan, else first loan
    const firstActive = normalised.find(t =>
      ['pending', 'active', 'change_proposed'].includes(t.loan_status)
    )
    setActiveLoanId(firstActive?.loan_id ?? normalised[0]?.loan_id ?? null)

    setLoading(false)
    track('messages_user_page_viewed', { other_user_id: otherId })
  }

  // Scroll to bottom when active thread or messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeLoanId, threads])

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  async function sendMessage() {
    if (!newMessage.trim() || !activeLoanId || !user) return
    const body = newMessage.trim()
    setNewMessage('')
    setSending(true)

    const activeThread = threads.find(t => t.loan_id === activeLoanId)
    if (!activeThread) { setSending(false); return }

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      loan_id: activeLoanId,
      sender_id: user.id,
      type: 'chat',
      body,
      metadata: null,
      created_at: new Date().toISOString(),
    }
    setThreads(prev => prev.map(t =>
      t.loan_id === activeLoanId
        ? { ...t, messages: [...t.messages, optimistic] }
        : t
    ))

    const { data: inserted, error } = await supabase
      .from('loan_messages')
      .insert({ loan_id: activeLoanId, sender_id: user.id, type: 'chat', body })
      .select()
      .single()

    if (error || !inserted) {
      // Roll back
      setThreads(prev => prev.map(t =>
        t.loan_id === activeLoanId
          ? { ...t, messages: t.messages.filter(m => m.id !== tempId) }
          : t
      ))
      setNewMessage(body)
    } else {
      // Replace optimistic
      setThreads(prev => prev.map(t =>
        t.loan_id === activeLoanId
          ? { ...t, messages: t.messages.map(m => m.id === tempId ? inserted : m) }
          : t
      ))

      // Notify recipient
      await supabase.from('notifications').insert({
        user_id: otherId,
        type: 'loan_message',
        title: 'Ny melding',
        body: body.slice(0, 80),
        loan_id: activeLoanId,
        action_url: `/messages/${user.id}`,
      })

      track('messages_chat_sent', { loan_id: activeLoanId })
    }

    setSending(false)
    inputRef.current?.focus()
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const activeThread = threads.find(t => t.loan_id === activeLoanId) ?? null

  function AvatarSmall({ url, name, size = 28 }: { url: string | null; name: string | null; size?: number }) {
    if (url) return <img src={url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
    const initials = (name ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#C4673A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
    )
  }

  function MessageBubble({ msg }: { msg: Message }) {
    const mine = msg.sender_id === user?.id

    if (msg.type === 'system') {
      return (
        <div className="flex justify-center my-1">
          <span className="system-message-pill">{msg.body}</span>
        </div>
      )
    }

    if (msg.type === 'change_proposal') {
      const meta = msg.metadata ?? {}
      return (
        <div className="proposal-card mx-2 my-1">
          <p className="proposal-header">🔄 Forslag til endring</p>
          <div className="proposal-dates">
            <span className="date-chip">Fra: {meta.proposed_start}</span>
            <span className="date-chip">Til: {meta.proposed_end}</span>
          </div>
          {meta.note && <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 4 }}>{meta.note}</p>}
        </div>
      )
    }

    return (
      <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'} my-0.5 mx-2`}>
        {!mine && <AvatarSmall url={otherUser?.avatar_url ?? null} name={otherUser?.name ?? null} size={22} />}
        <div className={mine ? 'bubble-mine' : 'bubble-theirs'} style={{ maxWidth: '72%' }}>
          <p style={{ fontSize: 13 }}>{msg.body}</p>
          <p style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.6)' : 'var(--terra-mid)', marginTop: 2, textAlign: 'right' }}>
            {relativeTime(msg.created_at)}
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDF5F0' }}>
        <p style={{ color: '#9C7B65', fontSize: 13 }}>Laster…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FDF5F0' }}>

      {/* Header */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <button
          onClick={() => router.back()}
          className="btn-glass"
          style={{ padding: '6px 10px', borderRadius: 10, fontSize: 13 }}
          aria-label="Tilbake"
        >
          ←
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0 mx-2">
          <AvatarSmall url={otherUser?.avatar_url ?? null} name={otherUser?.name ?? null} size={32} />
          <div className="min-w-0">
            <p className="font-display" style={{ fontSize: 17, fontWeight: 600, color: 'var(--terra-dark)', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {otherUser?.name ?? 'Ukjent'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--terra-mid)' }}>
              {threads.length} {threads.length === 1 ? 'låneavtale' : 'låneavtaler'}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/profile/${otherId}`)}
          className="btn-glass"
          style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12 }}
        >
          Profil
        </button>
      </header>

      {/* Loan thread tabs — vises kun hvis >1 lån */}
      {threads.length > 1 && (
        <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {threads.map(t => (
            <button
              key={t.loan_id}
              onClick={() => {
                setActiveLoanId(t.loan_id)
                track('messages_thread_tab_switched', { loan_id: t.loan_id })
              }}
              className="glass flex-shrink-0"
              style={{
                borderRadius: 10,
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: activeLoanId === t.loan_id ? 600 : 400,
                color: activeLoanId === t.loan_id ? 'var(--terra)' : 'var(--terra-mid)',
                border: activeLoanId === t.loan_id ? '1.5px solid rgba(196,103,58,0.4)' : '1px solid rgba(196,103,58,0.15)',
                background: activeLoanId === t.loan_id ? 'rgba(196,103,58,0.07)' : undefined,
                textAlign: 'left',
                minWidth: 120,
              }}
            >
              <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {t.item_label}
              </p>
              <span className={`status-pill ${statusPillClass(t.loan_status)}`} style={{ fontSize: 9, padding: '1px 6px', marginTop: 3 }}>
                {statusLabel(t.loan_status)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Aktiv tråd — gjenstandsinfo */}
      {activeThread && (
        <div
          className="mx-3 mt-2 mb-1 glass rounded-2xl px-3 py-2 flex items-center justify-between cursor-pointer"
          onClick={() => router.push(`/items/${activeThread.item_id}`)}
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--terra-dark)' }}>{activeThread.item_label}</p>
            <p style={{ fontSize: 10.5, color: 'var(--terra-mid)' }}>
              {activeThread.start_date} → {activeThread.due_date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${statusPillClass(activeThread.loan_status)}`}>
              {statusLabel(activeThread.loan_status)}
            </span>
            <span style={{ color: 'var(--terra-mid)', fontSize: 13 }}>›</span>
          </div>
        </div>
      )}

      {/* Meldingsliste */}
      <div className="flex-1 overflow-y-auto py-2" style={{ minHeight: 0 }}>
        {!activeThread || activeThread.messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: '#9C7B65', fontSize: 12, padding: '0 32px' }}>
            Ingen meldinger ennå. Si hei! 👋
          </div>
        ) : (
          activeThread.messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {activeThread && ['pending', 'active', 'change_proposed'].includes(activeThread.loan_status) ? (
        <div
          className="glass mx-3 mb-3 rounded-2xl flex items-end gap-2 px-3 py-2"
          style={{ border: '1px solid rgba(196,103,58,0.18)' }}
        >
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder="Skriv en melding…"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              color: 'var(--terra-dark)',
              lineHeight: 1.5,
              maxHeight: 96,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="btn-primary"
            style={{
              borderRadius: 12,
              padding: '7px 14px',
              fontSize: 13,
              opacity: !newMessage.trim() || sending ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      ) : activeThread ? (
        <div className="mx-3 mb-3 text-center" style={{ fontSize: 11.5, color: '#9C7B65', padding: '8px 0' }}>
          Lånet er {statusLabel(activeThread.loan_status).toLowerCase()} — ingen nye meldinger kan sendes
        </div>
      ) : null}

      <div className="nav-spacer" />
    </div>
  )
}
