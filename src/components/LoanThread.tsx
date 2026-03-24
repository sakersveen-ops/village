'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { track, Events } from '@/lib/track'

interface LoanThreadProps {
  loan: any
  item: any
  user: any
  isOwner: boolean
  onLoanUpdated: (loan: any) => void
  openProposal?: boolean
  onProposalOpened?: () => void
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })

const fmtTime = (d: string) => {
  const date = new Date(d)
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const dateStr = date.toISOString().split('T')[0]
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]
  const timeStr = date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  if (dateStr === todayStr) return `I dag ${timeStr}`
  if (dateStr === yesterdayStr) return `I går ${timeStr}`
  return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }) + ' ' + timeStr
}

function todayYMD() { return new Date().toISOString().split('T')[0] }

// ---------------------------------------------------------------------------
// Context-aware suggestions
// ---------------------------------------------------------------------------

type Suggestion = {
  id: string
  label: string
  type: 'proposal' | 'chat'
  delta: number
  note: (n: string) => string
}

function getSuggestions(status: string, isOwner: boolean, startDate: string | null, dueDate: string | null): Suggestion[] {
  const today = todayYMD()
  const isFuture = startDate ? startDate > today : false
  const isActive = status === 'active'
  const isPending = status === 'pending'
  const isDeclined = status === 'declined'
  const isChangeProposed = status === 'change_proposed'

  if (isOwner) {
    if (isPending) return [
      { id: 'confirm_pickup', label: 'Bekreft henting',        type: 'chat',     delta: 0,  note: n => `Hei! Du kan hente «${n}» hos meg – gi meg beskjed når det passer! 📍` },
      { id: 'propose_dates',  label: 'Foreslå andre datoer',   type: 'proposal', delta: 0,  note: n => `Hei! De valgte datoene passer ikke helt – kan vi finne noe annet?` },
    ]
    if (isFuture && (isActive || isChangeProposed)) return [
      { id: 'confirm_pickup', label: 'Bekreft henting',        type: 'chat',     delta: 0,  note: n => `Hei! Du kan hente «${n}» hos meg – gi meg beskjed når det passer! 📍` },
      { id: 'change_dates',   label: 'Endre låneperiode',      type: 'proposal', delta: 0,  note: n => `Hei! Ønsker å justere datoene for lånet av «${n}».` },
      { id: 'need_back',      label: 'Trenger den tilbake',    type: 'proposal', delta: -3, note: n => `Hei! Jeg trenger «${n}» tilbake litt tidligere – passer det?` },
    ]
    if (isActive) return [
      { id: 'need_back',      label: 'Trenger den tilbake',    type: 'proposal', delta: -3, note: n => `Hei! Jeg trenger «${n}» tilbake litt tidligere – passer det?` },
      { id: 'no_rush',        label: 'Ingen hastverk',         type: 'proposal', delta: +5, note: n => `Hei! Ingen hastverk – du kan beholde «${n}» litt lenger 😊` },
      { id: 'remind_return',  label: 'Påminnelse om retur',    type: 'chat',     delta: 0,  note: n => `Hei! Bare en påminnelse om at «${n}» snart skal returneres 🙂` },
    ]
    if (isDeclined) return [
      { id: 'propose_new',    label: 'Foreslå nye datoer',     type: 'proposal', delta: 0,  note: n => `Hei! Har du mulighet til å låne «${n}» i en annen periode?` },
    ]
  } else {
    // Borrower
    if (isPending) return [
      { id: 'pickup',         label: 'Avtal henting',          type: 'chat',     delta: 0,  note: n => `Hei! Når og hvor kan jeg hente «${n}»? 😊` },
      { id: 'change_dates',   label: 'Endre låneperiode',      type: 'proposal', delta: 0,  note: n => `Hei! Ønsker å justere datoene for forespørselen min.` },
    ]
    if (isFuture && (isActive || isChangeProposed)) return [
      { id: 'pickup',         label: 'Avtal henting',          type: 'chat',     delta: 0,  note: n => `Hei! Når og hvor kan jeg hente «${n}»? 😊` },
      { id: 'change_dates',   label: 'Endre låneperiode',      type: 'proposal', delta: 0,  note: n => `Hei! Ønsker å justere datoene for lånet av «${n}».` },
    ]
    if (isActive) return [
      { id: 'extend',         label: 'Forleng lånet',          type: 'proposal', delta: +3, note: n => `Hei! Kan jeg beholde «${n}» litt lenger? 🙏` },
      { id: 'shorten',        label: 'Lever tilbake tidligere', type: 'proposal', delta: -2, note: n => `Hei! Jeg kan levere «${n}» tilbake tidligere – passer det? 😊` },
      { id: 'ready_return',   label: 'Klar til å levere',      type: 'chat',     delta: 0,  note: n => `Hei! Jeg er klar til å levere tilbake «${n}» – passer det snart?` },
    ]
    if (isDeclined) return [
      { id: 'propose_new',    label: 'Foreslå nye datoer',     type: 'proposal', delta: 0,  note: n => `Hei! Er det mulig å låne «${n}» i en annen periode?` },
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoanThread({ loan, item, user, isOwner, onLoanUpdated, openProposal, onProposalOpened }: LoanThreadProps) {
  const [messages, setMessages]         = useState<any[]>([])
  const [newMessage, setNewMessage]     = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [showProposal, setShowProposal] = useState(false)
  const [propStart, setPropStart]       = useState('')
  const [propEnd, setPropEnd]           = useState('')
  const [propNote, setPropNote]         = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [borrowerCommunity, setBorrowerCommunity] = useState<string | null>(null)
  const [isFriend, setIsFriend]         = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const proposalRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  const today = todayYMD()
  const isActive       = loan?.status === 'active'
  const startDateLocked = isActive && !!loan?.start_date
  const isStartDay     = loan?.start_date === today
  const isDueDay       = loan?.due_date === today

  const suggestions = getSuggestions(loan?.status, isOwner, loan?.start_date, loan?.due_date)

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!loan?.id) return
    loadMessages()
    loadBorrowerContext()

    const supabase = createClient()
    const channel = supabase
      .channel(`loan_messages_${loan.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loan_messages', filter: `loan_id=eq.${loan.id}` },
        (payload) => {
          const newMsg = payload.new as any
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMsg.id || (m._sending && m.body === newMsg.body && m.sender_id === newMsg.sender_id))
            if (exists) return prev.map(m =>
              m._sending && m.body === newMsg.body && m.sender_id === newMsg.sender_id
                ? { ...newMsg, profiles: m.profiles } : m
            )
            return [...prev, newMsg]
          })
          if (newMsg.sender_id !== user.id) {
            supabase.from('profiles').select('id, name, email, avatar_url').eq('id', newMsg.sender_id).single()
              .then(({ data: profile }) => {
                setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, profiles: profile } : m))
              })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loan?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (openProposal && !showProposal) {
      setShowProposal(true)
      onProposalOpened?.()
      setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [openProposal])

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  const loadMessages = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loan_messages')
      .select('*, profiles(id, name, email, avatar_url)')
      .eq('loan_id', loan.id)
      .order('created_at', { ascending: true })

    const msgs = data || []

    // Inject start-day prompt if not already present
    if (isStartDay && isActive) {
      const alreadyHasStartMsg = msgs.some(m => m.type === 'system' && m.body?.includes('starter lånet'))
      if (!alreadyHasStartMsg) {
        await injectSystemMessage(`📦 I dag starter lånet av «${item?.name ?? 'gjenstanden'}»`)
      }
    }

    // Inject due-day prompt if not already present
    if (isDueDay && isActive) {
      const alreadyHasDueMsg = msgs.some(m => m.type === 'system' && m.body?.includes('siste dag'))
      if (!alreadyHasDueMsg) {
        await injectSystemMessage(`⏰ I dag er siste dag for lånet av «${item?.name ?? 'gjenstanden'}»`)
      }
    }

    setMessages(msgs)
    setLoading(false)
  }

  const loadBorrowerContext = async () => {
    if (!loan.borrower_id || !user?.id) return
    const supabase = createClient()
    const { data: friendship } = await supabase
      .from('friendships').select('id')
      .or(`and(user_a.eq.${user.id},user_b.eq.${loan.borrower_id}),and(user_a.eq.${loan.borrower_id},user_b.eq.${user.id})`)
      .maybeSingle()
    setIsFriend(!!friendship)
    if (!friendship) {
      const { data: cm } = await supabase
        .from('community_members').select('communities(name)')
        .eq('user_id', loan.borrower_id).eq('status', 'active').limit(1).maybeSingle()
      const name = (cm as any)?.communities?.name
      if (name) setBorrowerCommunity(name)
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const addLocal = (msg: any) => setMessages(prev => [...prev, msg])

  async function injectSystemMessage(body: string) {
    const supabase = createClient()
    await supabase.from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'system', body })
  }

  // -------------------------------------------------------------------------
  // Send chat
  // -------------------------------------------------------------------------

  const sendChat = async (body: string) => {
    if (!body.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const tmpId = `tmp-${Date.now()}`
    addLocal({
      id: tmpId, loan_id: loan.id, sender_id: user.id, type: 'chat', body,
      created_at: new Date().toISOString(),
      profiles: { id: user.id, name: user.user_metadata?.name || user.user_metadata?.full_name, email: user.email, avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null },
      _sending: true,
    })
    setNewMessage('')

    const { data: msg, error: msgErr } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'chat', body })
      .select('*, profiles(id, name, email, avatar_url)').single()

    if (msgErr) { setMessages(prev => prev.filter(m => m.id !== tmpId)); setSending(false); return }
    setMessages(prev => prev.map(m => m.id === tmpId ? (msg || m) : m))

    const recipientId = isOwner ? loan.borrower_id : item?.owner_id
    if (recipientId) {
      await supabase.from('notifications').insert({
        user_id: recipientId, type: 'loan_message',
        title: `Ny melding om «${item?.name ?? 'gjenstand'}»`,
        body: body.slice(0, 80), loan_id: loan.id,
      })
    }
    setSending(false)
  }

  // -------------------------------------------------------------------------
  // Send proposal
  // -------------------------------------------------------------------------

  const sendProposal = async () => {
    if (!propStart || !propEnd || submitting) return
    setSubmitting(true)
    const supabase = createClient()

    const meta = {
      proposed_start: propStart, proposed_end: propEnd, status: 'pending',
      original_start: loan.start_date, original_end: loan.due_date,
    }
    const tmpId = `tmp-${Date.now()}`
    addLocal({
      id: tmpId, loan_id: loan.id, sender_id: user.id, type: 'change_proposal', body: propNote,
      metadata: JSON.stringify(meta), created_at: new Date().toISOString(),
      profiles: { id: user.id, name: user.user_metadata?.name || user.user_metadata?.full_name, email: user.email, avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null },
      _sending: true,
    })

    const { data: msg, error: msgErr } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'change_proposal', body: propNote, metadata: meta })
      .select('*, profiles(id, name, email, avatar_url)').single()

    if (msgErr) { setMessages(prev => prev.filter(m => m.id !== tmpId)); setSubmitting(false); return }
    setMessages(prev => prev.map(m => m.id === tmpId ? (msg || m) : m))
    await supabase.from('loans').update({ status: 'change_proposed' }).eq('id', loan.id)
    onLoanUpdated({ ...loan, status: 'change_proposed' })

    const recipientId = isOwner ? loan.borrower_id : item?.owner_id
    if (recipientId) {
      await supabase.from('notifications').insert({
        user_id: recipientId, type: 'loan_change_proposal',
        title: isOwner ? `📅 Utleier foreslår ny dato for «${item?.name ?? 'gjenstand'}»` : `📅 Låntaker vil endre datoer for «${item?.name ?? 'gjenstand'}»`,
        body: `${fmt(propStart)} → ${fmt(propEnd)} – svar i meldingstråden`,
        loan_id: loan.id, action_url: `/loans/${loan.id}`,
      })
    }

    setPropStart(''); setPropEnd(''); setPropNote('')
    setShowProposal(false)
    setSubmitting(false)
    track(Events.PROPOSAL_SENT, { loan_id: loan.id, item_id: item?.id })
  }

  // -------------------------------------------------------------------------
  // Respond to proposal
  // -------------------------------------------------------------------------

  const respondProposal = async (messageId: string, accept: boolean) => {
    const supabase = createClient()
    const target = messages.find(m => m.id === messageId)
    const meta = typeof target?.metadata === 'string' ? JSON.parse(target.metadata) : target?.metadata || {}
    const newMeta = { ...meta, status: accept ? 'accepted' : 'declined' }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, metadata: JSON.stringify(newMeta) } : m))

    const sysBody = accept
      ? `✅ Endringsforslag godtatt – ${fmt(meta.proposed_start)} → ${fmt(meta.proposed_end)}`
      : `❌ Endringsforslag avslått – opprinnelige datoer gjelder`

    const tmpId = `tmp-sys-${Date.now()}`
    addLocal({ id: tmpId, type: 'system', body: sysBody, created_at: new Date().toISOString() })

    await supabase.from('loan_messages').update({ metadata: newMeta }).eq('id', messageId)

    if (accept) {
      await supabase.from('loans').update({ status: 'active', start_date: meta.proposed_start, due_date: meta.proposed_end }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: 'active', start_date: meta.proposed_start, due_date: meta.proposed_end })
    } else {
      const baseStatus = loan.status === 'active' ? 'active' : 'pending'
      await supabase.from('loans').update({ status: baseStatus }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus })
    }

    const { data: sysMsg } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'system', body: sysBody })
      .select('*, profiles(id, name, email, avatar_url)').single()
    setMessages(prev => prev.map(m => m.id === tmpId ? (sysMsg || m) : m))

    await supabase.from('notifications').insert({
      user_id: target.sender_id,
      type: accept ? 'proposal_accepted' : 'proposal_declined',
      title: accept ? '✅ Endringsforslag godtatt' : '❌ Endringsforslag avslått',
      body: accept ? `Nye datoer: ${fmt(meta.proposed_start)} → ${fmt(meta.proposed_end)}` : 'Opprinnelige datoer gjelder fortsatt',
      loan_id: loan.id,
    })

    track(accept ? Events.PROPOSAL_ACCEPTED : Events.PROPOSAL_DECLINED, { loan_id: loan.id, item_id: item?.id })
  }

  // -------------------------------------------------------------------------
  // Mark returned
  // -------------------------------------------------------------------------

  const markReturned = async () => {
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loan.id)
    if (item?.id) await supabase.from('items').update({ available: true }).eq('id', item.id)
    await injectSystemMessage(`✅ Gjenstanden er bekreftet returnert`)
    onLoanUpdated({ ...loan, status: 'returned' })
    setMessages(prev => [...prev, { id: `tmp-ret-${Date.now()}`, type: 'system', body: '✅ Gjenstanden er bekreftet returnert', created_at: new Date().toISOString() }])
    track('loan_marked_returned', { loan_id: loan.id, item_id: item?.id })
  }

  // -------------------------------------------------------------------------
  // Apply suggestion
  // -------------------------------------------------------------------------

  const applySuggestion = (s: Suggestion) => {
    const itemName = item?.name ?? 'gjenstanden'
    const note = s.note(itemName)
    if (s.type === 'chat') { setShowProposal(false); sendChat(note); return }
    setPropNote(note)
    const start = startDateLocked ? loan.start_date : (loan.start_date || today)
    setPropStart(start)
    const base = loan.due_date || today
    const d = new Date(base)
    d.setDate(d.getDate() + s.delta)
    const todayDate = new Date()
    if (d <= todayDate) d.setDate(todayDate.getDate() + 1)
    setPropEnd(d.toISOString().split('T')[0])
    setShowProposal(true)
    setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const senderName = (msg: any) => msg.profiles?.name || msg.profiles?.email?.split('@')[0] || '?'
  const isMe = (msg: any) => msg.sender_id === user.id

  const ProfileLink = ({ msg }: { msg: any }) => {
    const pid = msg.profiles?.id
    const name = senderName(msg)
    const avatarUrl = msg.profiles?.avatar_url
    return (
      <Link href={`/profile/${pid}`} className="flex items-center gap-1.5 mb-0.5 group">
        <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-[10px]"
          style={{ width: 24, height: 24, background: 'rgba(196,103,58,0.15)', color: 'var(--terra)' }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : name[0]?.toUpperCase()}
        </div>
        <span className="text-[11px] group-hover:underline" style={{ color: 'var(--terra-mid)' }}>{name}</span>
        {pid !== item?.owner_id && !isFriend && borrowerCommunity && (
          <span className="text-[10px]" style={{ color: 'var(--terra-mid)' }}>· {borrowerCommunity}</span>
        )}
      </Link>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ background: 'rgba(245,245,245,0.8)' }}>

      {/* Messages */}
      <div className="flex flex-col px-3 py-4 gap-0.5 overflow-y-auto" style={{ minHeight: 200, maxHeight: 440 }}>
        {loading ? (
          <p className="text-center text-sm py-10" style={{ color: 'var(--terra-mid)' }}>Laster…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm italic py-10" style={{ color: 'var(--terra-mid)' }}>Ingen meldinger ennå</p>
        ) : messages.map((msg, i) => {
          const mine = isMe(msg)
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const prevSameSender = prev?.sender_id === msg.sender_id && prev?.type === 'chat' && msg.type === 'chat'
          const nextSameSender = next?.sender_id === msg.sender_id && next?.type === 'chat' && msg.type === 'chat'
          const isLast = i === messages.length - 1
          const meta = msg.metadata
            ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata)
            : null

          // System pill
          if (msg.type === 'system') {
            // Start-day message — show "Bekreft henting" for owner
            const isStartMsg = msg.body?.includes('starter lånet')
            // Due-day message — show "Marker returnert" for owner
            const isDueMsg = msg.body?.includes('siste dag')

            return (
              <div key={msg.id} className="flex flex-col items-center my-3 px-2 gap-2">
                <span className="system-message-pill">{msg.body}</span>
                {isStartMsg && isOwner && loan.status === 'active' && (
                  <button
                    onClick={() => sendChat(`Hei! Du kan hente «${item?.name ?? 'gjenstanden'}» hos meg – gi meg beskjed når det passer! 📍`)}
                    className="pill"
                    style={{ fontSize: 11 }}
                  >
                    📍 Send henteinformasjon
                  </button>
                )}
                {isDueMsg && isOwner && loan.status === 'active' && (
                  <button
                    onClick={markReturned}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 99,
                      background: 'rgba(74,124,89,0.1)', color: 'var(--terra-green)',
                      border: '1px solid rgba(74,124,89,0.25)', cursor: 'pointer',
                    }}
                  >
                    ✓ Bekreft retur
                  </button>
                )}
              </div>
            )
          }

          // Change proposal card
          if (msg.type === 'change_proposal') {
            const status = (meta?.status && meta.status !== '') ? meta.status : 'pending'
            const canRespond = !mine && status === 'pending'
            return (
              <div key={msg.id} className={`flex flex-col my-3 ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && !prevSameSender && <ProfileLink msg={msg} />}
                <div className="proposal-card w-[88%]" style={{
                  borderColor: status === 'accepted' ? 'var(--terra-green)' : status === 'declined' ? 'rgba(196,103,58,0.18)' : 'var(--terra)',
                }}>
                  <div className="proposal-header" style={{
                    background: status === 'accepted' ? 'rgba(74,124,89,0.1)' : status === 'declined' ? 'rgba(156,123,101,0.1)' : 'rgba(196,103,58,0.08)',
                  }}>
                    <span>{status === 'accepted' ? '✅' : status === 'declined' ? '❌' : '📅'}</span>
                    <span className="text-xs font-bold flex-1" style={{ color: 'var(--terra-dark)' }}>
                      {mine ? 'Du foreslo endring' : `${senderName(msg)} foreslo endring`}
                    </span>
                    <span className={`status-pill ${status === 'accepted' ? 'active' : status === 'declined' ? 'returned' : 'pending'}`} style={{ fontSize: 10 }}>
                      {status === 'accepted' ? 'Godtatt' : status === 'declined' ? 'Avslått' : 'Venter'}
                    </span>
                  </div>
                  <div className="proposal-dates">
                    {meta?.original_start && meta?.original_end && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide w-20 flex-shrink-0" style={{ color: 'var(--terra-mid)' }}>Nåværende</span>
                        <span className="text-xs line-through" style={{ color: 'var(--terra-mid)' }}>{fmt(meta.original_start)} → {fmt(meta.original_end)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide w-20 flex-shrink-0" style={{ color: 'var(--terra-mid)' }}>Foreslått</span>
                      <span className="text-sm font-bold" style={{ color: status === 'declined' ? 'var(--terra-mid)' : 'var(--terra-dark)' }}>
                        {fmt(meta?.proposed_start)} → {fmt(meta?.proposed_end)}
                      </span>
                    </div>
                    {msg.body ? (
                      <p className="mt-1 text-sm" style={{ color: 'var(--terra-dark)', background: 'rgba(196,103,58,0.06)', borderRadius: 10, padding: '6px 10px' }}>
                        {msg.body}
                      </p>
                    ) : null}
                  </div>
                  {canRespond && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '0 2px' }}>
                      <button
                        onClick={() => respondProposal(msg.id, true)}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 99, background: 'var(--terra-green)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >✓ Godta</button>
                      <button
                        onClick={() => respondProposal(msg.id, false)}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 99, background: 'transparent', color: 'var(--terra-mid)', border: '1px solid rgba(156,123,101,0.35)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                      >Avslå</button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--terra-mid)' }}>{fmtTime(msg.created_at)}</span>
              </div>
            )
          }

          // Chat bubble
          const showSender = !mine && !prevSameSender
          const showTimestamp = isLast || !nextSameSender
          const br = mine
            ? `rounded-2xl ${!prevSameSender ? 'rounded-tr-md' : ''} ${!nextSameSender ? 'rounded-br-md' : ''}`
            : `rounded-2xl ${!prevSameSender ? 'rounded-tl-md' : ''} ${!nextSameSender ? 'rounded-bl-md' : ''}`

          return (
            <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${prevSameSender ? 'mt-0.5' : 'mt-3'}`}>
              {showSender && (
                <div className={`flex items-center gap-1.5 mb-0.5 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Link href={`/profile/${msg.profiles?.id}`} className="text-[11px] hover:underline" style={{ color: 'var(--terra-mid)' }}>
                    {senderName(msg)}
                  </Link>
                  {!isMe(msg) && msg.profiles?.id !== item?.owner_id && !isFriend && borrowerCommunity && (
                    <span className="text-[10px]" style={{ color: 'var(--terra-mid)' }}>· {borrowerCommunity}</span>
                  )}
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 flex-shrink-0">
                  {!prevSameSender ? (
                    <Link href={`/profile/${msg.profiles?.id}`}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden"
                        style={{ background: mine ? 'var(--terra)' : 'rgba(196,103,58,0.15)', color: mine ? 'white' : 'var(--terra)' }}>
                        {msg.profiles?.avatar_url
                          ? <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                          : senderName(msg)[0]?.toUpperCase()}
                      </div>
                    </Link>
                  ) : <div className="w-7" />}
                </div>
                <div className={`px-3.5 py-2 text-[15px] leading-relaxed max-w-[260px] ${br} ${mine ? 'bubble-mine' : 'bubble-theirs'} ${msg._sending ? 'opacity-60' : ''}`}>
                  {msg.body}
                </div>
              </div>
              {showTimestamp && (
                <span className={`text-[11px] mt-0.5 ${mine ? 'pr-1' : 'pl-9'}`} style={{ color: 'var(--terra-mid)' }}>
                  {msg._sending ? 'Sender…' : (isLast && mine ? 'Sendt' : fmtTime(msg.created_at))}
                </span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Proposal form */}
      {showProposal && (
        <div ref={proposalRef} className="glass-heavy border-t px-4 py-4 flex flex-col gap-3"
          style={{ borderTopColor: 'rgba(196,103,58,0.15)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: 'var(--terra-dark)' }}>📅 Foreslå endring</span>
            <button onClick={() => { setShowProposal(false); setPropNote(''); setPropStart(''); setPropEnd('') }}
              className="text-xs" style={{ color: 'var(--terra-mid)' }}>Avbryt</button>
          </div>

          {suggestions.filter(s => s.type === 'proposal').length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {suggestions.filter(s => s.type === 'proposal').map(s => (
                <button key={s.id} onClick={() => applySuggestion(s)}
                  className="pill flex items-center gap-1 text-xs font-medium">
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--terra-mid)' }}>
                {startDateLocked ? 'Startdato (låst)' : 'Ny startdato'}
              </label>
              <input type="date" value={propStart}
                onChange={e => !startDateLocked && setPropStart(e.target.value)}
                disabled={startDateLocked}
                min={startDateLocked ? undefined : today}
                className="glass text-sm outline-none"
                style={{ borderRadius: 12, padding: '10px 12px', color: 'var(--terra-dark)', opacity: startDateLocked ? 0.5 : 1, cursor: startDateLocked ? 'not-allowed' : 'pointer' }} />
              {startDateLocked && (
                <p className="text-[10px]" style={{ color: 'var(--terra-mid)' }}>Aktivt lån — startdato kan ikke endres</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--terra-mid)' }}>Ny sluttdato</label>
              <input type="date" value={propEnd} onChange={e => setPropEnd(e.target.value)}
                min={propStart || today}
                className="glass text-sm outline-none"
                style={{ borderRadius: 12, padding: '10px 12px', color: 'var(--terra-dark)' }} />
            </div>
          </div>

          {propStart && propEnd && (
            <div className="glass" style={{ borderRadius: 10, padding: '8px 12px' }}>
              <span className="status-pill active text-xs">✓ {fmt(propStart)} → {fmt(propEnd)}</span>
            </div>
          )}

          <textarea value={propNote} onChange={e => setPropNote(e.target.value)} rows={2}
            placeholder="Legg til en melding (valgfritt)…"
            className="glass outline-none resize-none"
            style={{ borderRadius: 12, padding: '10px 12px', fontSize: 14, color: 'var(--terra-dark)' }} />

          <button onClick={sendProposal} disabled={!propStart || !propEnd || submitting}
            className="btn-primary disabled:opacity-40">
            {submitting ? 'Sender…' : 'Send endringsforslag'}
          </button>
        </div>
      )}

      {/* Input bar */}
      {!showProposal && (
        <div className="px-3 py-2 flex flex-col gap-2"
          style={{ background: 'rgba(245,245,245,0.8)', borderTop: '1px solid rgba(196,103,58,0.1)' }}>

          {/* Context suggestions (chat type only in input bar) */}
          {suggestions.filter(s => s.type === 'chat').length > 0 && (
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {suggestions.filter(s => s.type === 'chat').map(s => (
                <button key={s.id} onClick={() => applySuggestion(s)}
                  className="pill flex-shrink-0 text-xs font-medium whitespace-nowrap">
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(newMessage) } }}
              rows={1}
              placeholder="Melding…"
              className="glass flex-1 outline-none resize-none text-[15px] leading-relaxed"
              style={{ borderRadius: 20, padding: '10px 16px', color: 'var(--terra-dark)', minHeight: 40, maxHeight: 120 }}
            />
            {suggestions.some(s => s.type === 'proposal') && (
              <button onClick={() => setShowProposal(true)}
                className="btn-glass btn-sm flex-shrink-0 whitespace-nowrap" style={{ height: 40, borderRadius: 20 }}>
                📅 Foreslå endring
              </button>
            )}
            <button onClick={() => sendChat(newMessage)} disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 flex items-center justify-center disabled:opacity-25 transition-opacity"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--terra)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
