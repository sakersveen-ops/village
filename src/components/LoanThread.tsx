'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { track, Events, startTimer } from '@/lib/track'

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

const BORROWER_SUGGESTIONS = [
  { id: 'extend',       emoji: '📅', label: 'Forleng lånet',          type: 'proposal' as const, delta: +3, minStatus: 'active',  note: (n: string) => `Hei! Kan jeg beholde «${n}» litt lenger? 🙏` },
  { id: 'shorten',      emoji: '⏩', label: 'Lever tilbake tidligere', type: 'proposal' as const, delta: -2, minStatus: 'active',  note: (n: string) => `Hei! Jeg kan levere «${n}» tilbake tidligere – passer det? 😊` },
  { id: 'pickup',       emoji: '📍', label: 'Avtal henting',           type: 'chat'     as const, delta: 0,  minStatus: 'pending', note: (n: string) => `Hei! Når og hvor kan jeg hente «${n}»? 😊` },
  { id: 'ready_return', emoji: '✅', label: 'Klar til å levere',       type: 'chat'     as const, delta: 0,  minStatus: 'active',  note: (n: string) => `Hei! Jeg er klar til å levere tilbake «${n}» – passer det snart?` },
  { id: 'thanks',       emoji: '🙏', label: 'Takk for lånet',          type: 'chat'     as const, delta: 0,  minStatus: 'active',  note: (n: string) => `Tusen takk for lånet av «${n}»! 🙏` },
]

const OWNER_SUGGESTIONS = [
  { id: 'need_back',      emoji: '🔔', label: 'Trenger den tilbake',  type: 'proposal' as const, delta: -3, minStatus: 'active',  note: (n: string) => `Hei! Jeg trenger «${n}» tilbake litt tidligere – kan du levere innen ny dato?` },
  { id: 'no_rush',        emoji: '🤝', label: 'Ingen hastverk',        type: 'proposal' as const, delta: +5, minStatus: 'active',  note: (n: string) => `Hei! Ingen hastverk – du kan beholde «${n}» litt lenger 😊` },
  { id: 'confirm_pickup', emoji: '📍', label: 'Bekreft henting',       type: 'chat'     as const, delta: 0,  minStatus: 'pending', note: (n: string) => `Hei! Du kan hente «${n}» hos meg – gi meg beskjed når det passer!` },
  { id: 'remind_return',  emoji: '⏰', label: 'Påminnelse om retur',   type: 'chat'     as const, delta: 0,  minStatus: 'active',  note: (n: string) => `Hei! Bare en påminnelse om at «${n}» snart skal returneres 🙂` },
  { id: 'all_good',       emoji: '👍', label: 'Alt bra?',              type: 'chat'     as const, delta: 0,  minStatus: 'active',  note: (n: string) => `Hei! Bare sjekker inn – er alt bra med «${n}»?` },
]

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

  const isActive  = loan?.status === 'active'
  const suggestions = (isOwner ? OWNER_SUGGESTIONS : BORROWER_SUGGESTIONS)
    .filter(s => s.minStatus === 'pending' || isActive)

  useEffect(() => { if (loan?.id) { loadMessages(); loadBorrowerContext() } }, [loan?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (openProposal && !showProposal) {
      setShowProposal(true)
      onProposalOpened?.()
      setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [openProposal])

  const loadMessages = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loan_messages')
      .select('*, profiles(id, name, email, avatar_url)')
      .eq('loan_id', loan.id)
      .order('created_at', { ascending: true })

    if ((!data || data.length === 0) && loan.message && loan.borrower_id) {
      const { data: seeded } = await supabase
        .from('loan_messages')
        .insert({ loan_id: loan.id, sender_id: loan.borrower_id, type: 'chat', body: loan.message, created_at: loan.created_at })
        .select('*, profiles(id, name, email, avatar_url)')
        .single()
      setMessages(seeded ? [seeded] : [])
    } else {
      setMessages(data || [])
    }
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

  const addLocal = (msg: any) => setMessages(prev => [...prev, msg])

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
      .from('loan_messages')
      .insert({ loan_id: loan.id, sender_id: user.id, type: 'chat', body })
      .select('*, profiles(id, name, email, avatar_url)')
      .single()

    if (msgErr) {
      console.error('sendChat error:', msgErr)
      setMessages(prev => prev.filter(m => m.id !== tmpId))
      setSending(false)
      return
    }
    setMessages(prev => prev.map(m => m.id === tmpId ? (msg || m) : m))

    const recipientId = isOwner ? loan.borrower_id : item.owner_id
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'loan_message',
      title: `Ny melding om «${item.name}»`,
      body: body.slice(0, 80),
      loan_id: loan.id,
    })
    setSending(false)
  }

  const sendProposal = async () => {
    if (!propStart || !propEnd || submitting) return
    setSubmitting(true)
    const supabase = createClient()

    const meta = { proposed_start: propStart, proposed_end: propEnd, status: 'pending', original_start: loan.start_date, original_end: loan.due_date }
    const tmpId = `tmp-${Date.now()}`
    addLocal({
      id: tmpId, loan_id: loan.id, sender_id: user.id, type: 'change_proposal', body: propNote,
      metadata: JSON.stringify(meta), created_at: new Date().toISOString(),
      profiles: { id: user.id, name: user.user_metadata?.name || user.user_metadata?.full_name, email: user.email, avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null },
      _sending: true,
    })

    const { data: msg, error: msgErr } = await supabase
      .from('loan_messages')
      .insert({ loan_id: loan.id, sender_id: user.id, type: 'change_proposal', body: propNote, metadata: meta })
      .select('*, profiles(id, name, email, avatar_url)')
      .single()

    if (msgErr) {
      console.error('sendProposal error:', msgErr)
      setMessages(prev => prev.filter(m => m.id !== tmpId))
      setSubmitting(false)
      return
    }
    setMessages(prev => prev.map(m => m.id === tmpId ? (msg || m) : m))
    await supabase.from('loans').update({ status: 'change_proposed' }).eq('id', loan.id)
    onLoanUpdated({ ...loan, status: 'change_proposed' })

    const recipientId = isOwner ? loan.borrower_id : item.owner_id
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'loan_change_proposal',
      title: isOwner ? `📅 Utleier foreslår ny dato for «${item.name}»` : `📅 Låntaker vil endre datoer for «${item.name}»`,
      body: `${fmt(propStart)} → ${fmt(propEnd)} – svar i meldingstråden`,
      loan_id: loan.id,
      action_url: `/items/${item.id}`,
    })

    setPropStart(''); setPropEnd(''); setPropNote('')
    setShowProposal(false)
    setSubmitting(false)
    track(Events.PROPOSAL_SENT, { loan_id: loan.id, item_id: item.id })
  }

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

    const newStatus = accept ? 'active' : (loan.status === 'active' ? 'active' : 'pending')
    if (accept) {
      await supabase.from('loans').update({ status: newStatus, start_date: meta.proposed_start, due_date: meta.proposed_end }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: newStatus, start_date: meta.proposed_start, due_date: meta.proposed_end })
    } else {
      const baseStatus = loan.status === 'active' ? 'active' : 'pending'
      await supabase.from('loans').update({ status: baseStatus }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus })
    }

    const { data: sysMsg } = await supabase
      .from('loan_messages')
      .insert({ loan_id: loan.id, sender_id: user.id, type: 'system', body: sysBody })
      .select('*, profiles(id, name, email, avatar_url)')
      .single()
    setMessages(prev => prev.map(m => m.id === tmpId ? (sysMsg || m) : m))

    await supabase.from('notifications').insert({
      user_id: target.sender_id,
      type: accept ? 'proposal_accepted' : 'proposal_declined',
      title: accept ? '✅ Endringsforslag godtatt' : '❌ Endringsforslag avslått',
      body: accept ? `Nye datoer: ${fmt(meta.proposed_start)} → ${fmt(meta.proposed_end)}` : 'Opprinnelige datoer gjelder fortsatt',
      loan_id: loan.id,
    })

    track(accept ? Events.PROPOSAL_ACCEPTED : Events.PROPOSAL_DECLINED, {
      loan_id: loan.id,
      item_id: item?.id,
    })
  }

  const applySuggestion = (s: typeof BORROWER_SUGGESTIONS[0]) => {
    const note = s.note(item.name)
    if (s.type === 'chat') { setShowProposal(false); sendChat(note); return }
    setPropNote(note)
    const start = loan.start_date || new Date().toISOString().split('T')[0]
    setPropStart(start)
    const base = loan.due_date || new Date().toISOString().split('T')[0]
    const d = new Date(base)
    d.setDate(d.getDate() + s.delta)
    const today = new Date()
    if (d <= today) d.setDate(today.getDate() + 1)
    setPropEnd(d.toISOString().split('T')[0])
  }

  const senderName = (msg: any) => msg.profiles?.name || msg.profiles?.email?.split('@')[0] || '?'
  const isMe = (msg: any) => msg.sender_id === user.id

  const ProfileLink = ({ msg }: { msg: any }) => {
    const pid = msg.profiles?.id
    const name = senderName(msg)
    const avatarUrl = msg.profiles?.avatar_url
    const isOwnerProfile = pid === item.owner_id
    return (
      <Link href={`/profile/${pid}`} className="flex items-center gap-1.5 mb-0.5 group">
        <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-[10px]"
          style={{ width: 24, height: 24, background: 'rgba(196,103,58,0.15)', color: 'var(--terra)' }}>
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
        </div>
        <span className="text-[11px] group-hover:underline" style={{ color: 'var(--terra-mid)' }}>{name}</span>
        {!isOwnerProfile && !isFriend && borrowerCommunity && (
          <span className="text-[10px]" style={{ color: 'var(--terra-mid)' }}>· {borrowerCommunity}</span>
        )}
      </Link>
    )
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ background: 'rgba(245,245,245,0.8)' }}>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
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

          // ── System pill ──────────────────────────────────────────────────
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3 px-2">
                <span className="system-message-pill">{msg.body}</span>
              </div>
            )
          }

          // ── Change proposal card ─────────────────────────────────────────
          if (msg.type === 'change_proposal') {
            const status = meta?.status || 'pending'
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
                    <div className="proposal-actions">
                      <button onClick={() => respondProposal(msg.id, true)} className="btn-sm btn-accept flex-1">✓ Godta</button>
                      <button onClick={() => respondProposal(msg.id, false)} className="btn-sm btn-decline flex-1">Avslå</button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--terra-mid)' }}>{fmtTime(msg.created_at)}</span>
              </div>
            )
          }

          // ── Chat bubble ──────────────────────────────────────────────────
          const showSender = !mine && !prevSameSender
          const showTimestamp = isLast || !nextSameSender
          const br = mine
            ? `rounded-2xl ${!prevSameSender ? 'rounded-tr-md' : ''} ${!nextSameSender ? 'rounded-br-md' : ''}`
            : `rounded-2xl ${!prevSameSender ? 'rounded-tl-md' : ''} ${!nextSameSender ? 'rounded-bl-md' : ''}`

          return (
            <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${prevSameSender ? 'mt-0.5' : 'mt-3'}`}>
              {showSender && (
                <div className={`flex items-center gap-1.5 mb-0.5 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Link href={`/profile/${msg.profiles?.id}`}
                    className="text-[11px] hover:underline" style={{ color: 'var(--terra-mid)' }}>
                    {senderName(msg)}
                  </Link>
                  {!isMe(msg) && msg.profiles?.id !== item.owner_id && !isFriend && borrowerCommunity && (
                    <span className="text-[10px]" style={{ color: 'var(--terra-mid)' }}>· {borrowerCommunity}</span>
                  )}
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 flex-shrink-0">
                  {!prevSameSender ? (
                    <Link href={`/profile/${msg.profiles?.id}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden`}
                        style={{ background: mine ? 'var(--terra)' : 'rgba(196,103,58,0.15)', color: mine ? 'white' : 'var(--terra)' }}>
                        {msg.profiles?.avatar_url
                          ? <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" />
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

      {/* ── Proposal form ─────────────────────────────────────────────────── */}
      {showProposal && (
        <div ref={proposalRef} className="glass-heavy border-t px-4 py-4 flex flex-col gap-3"
          style={{ borderTopColor: 'rgba(196,103,58,0.15)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: 'var(--terra-dark)' }}>📅 Foreslå nye datoer</span>
            <button onClick={() => { setShowProposal(false); setPropNote(''); setPropStart(''); setPropEnd('') }}
              className="text-xs" style={{ color: 'var(--terra-mid)' }}>Avbryt</button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {suggestions.map(s => (
              <button key={s.id} onClick={() => applySuggestion(s)}
                className="pill flex items-center gap-1 text-xs font-medium">
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--terra-mid)' }}>Ny startdato</label>
              <input type="date" value={propStart} onChange={e => setPropStart(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="glass text-sm outline-none"
                style={{ borderRadius: 12, padding: '10px 12px', color: 'var(--terra-dark)' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--terra-mid)' }}>Ny sluttdato</label>
              <input type="date" value={propEnd} onChange={e => setPropEnd(e.target.value)}
                min={propStart || new Date().toISOString().split('T')[0]}
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

      {/* ── Input bar — flush iPhone-style ────────────────────────────────── */}
      {!showProposal && (
        <div className="px-3 py-2 flex flex-col gap-2"
          style={{ background: 'rgba(245,245,245,0.8)', borderTop: '1px solid rgba(196,103,58,0.1)' }}>
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
            <button onClick={() => setShowProposal(true)}
              className="btn-glass btn-sm flex-shrink-0 whitespace-nowrap" style={{ height: 40, borderRadius: 20 }}>
              📅 Foreslå endring
            </button>
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
