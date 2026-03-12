'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface LoanThreadProps {
  loan: any
  item: any
  user: any
  isOwner: boolean
  onLoanUpdated: (loan: any) => void
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('no-NO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

// ─── Quick suggestion templates ───────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  {
    id: 'extend',
    emoji: '📅',
    label: 'Forleng lånet',
    description: 'Be om å beholde gjenstanden lenger',
    ownerOnly: false,
    type: 'change_proposal' as const,
    noteTemplate: (name: string) => `Hei! Kan jeg beholde «${name}» litt lenger? 🙏`,
    dateDelta: +3,
  },
  {
    id: 'shorten',
    emoji: '⏩',
    label: 'Lever tilbake tidligere',
    description: 'Foreslå kortere låneperiode',
    ownerOnly: false,
    type: 'change_proposal' as const,
    noteTemplate: (name: string) => `Hei! Jeg kan levere tilbake «${name}» tidligere – passer det? 😊`,
    dateDelta: -2,
  },
  {
    id: 'need_back',
    emoji: '🔔',
    label: 'Trenger den tilbake',
    description: 'Gi beskjed om at du trenger gjenstanden',
    ownerOnly: true,
    type: 'change_proposal' as const,
    noteTemplate: (name: string) => `Hei! Jeg trenger «${name}» tilbake litt tidligere – kan du levere innen ny dato?`,
    dateDelta: -3,
  },
  {
    id: 'flexible',
    emoji: '🤝',
    label: 'Ingen hastverk',
    description: 'Gi låntaker litt ekstra tid',
    ownerOnly: true,
    type: 'change_proposal' as const,
    noteTemplate: (name: string) => `Hei! Ingen hastverk – du kan beholde «${name}» litt til om du trenger det.`,
    dateDelta: +5,
  },
  {
    id: 'pickup',
    emoji: '📍',
    label: 'Avtal henting',
    description: 'Send melding om avtale for henting',
    ownerOnly: false,
    type: 'chat' as const,
    noteTemplate: (name: string) => `Hei! Når og hvor kan jeg hente «${name}»? 😊`,
    dateDelta: 0,
  },
  {
    id: 'return_confirm',
    emoji: '✅',
    label: 'Klar til å levere',
    description: 'Gi beskjed om at du er klar',
    ownerOnly: false,
    type: 'chat' as const,
    noteTemplate: (name: string) => `Hei! Jeg er klar til å levere tilbake «${name}» – passer det snart?`,
    dateDelta: 0,
  },
]

export default function LoanThread({ loan, item, user, isOwner, onLoanUpdated }: LoanThreadProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)

  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalStart, setProposalStart] = useState('')
  const [proposalEnd, setProposalEnd] = useState('')
  const [proposalNote, setProposalNote] = useState('')
  const [submittingProposal, setSubmittingProposal] = useState(false)

  const [showSuggestions, setShowSuggestions] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (loan?.id) loadMessages()
  }, [loan?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    setLoadingMessages(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loan_messages')
      .select('*, profiles(name, email, avatar_url)')
      .eq('loan_id', loan.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoadingMessages(false)
  }

  // ─── Send chat message ───────────────────────────────────────────────────────
  const sendMessage = async (overrideBody?: string) => {
    const body = (overrideBody ?? newMessage).trim()
    if (!body || sending) return
    setSending(true)
    const supabase = createClient()

    const { data: msg } = await supabase
      .from('loan_messages')
      .insert({ loan_id: loan.id, sender_id: user.id, type: 'chat', body })
      .select('*, profiles(name, email, avatar_url)')
      .single()
      

    if (msg) setMessages(prev => [...prev, msg])

    const recipientId = isOwner ? loan.borrower_id : item.owner_id
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'loan_message',
      title: `Ny melding om «${item.name}»`,
      body: body.slice(0, 80),
      loan_id: loan.id,
    })

    setNewMessage('')
    setSending(false)
  }

  // ─── Submit change proposal ──────────────────────────────────────────────────
  const submitProposal = async () => {
    if (!proposalStart || !proposalEnd || submittingProposal) return
    setSubmittingProposal(true)
    const supabase = createClient()

    const meta = JSON.stringify({
      proposed_start: proposalStart,
      proposed_end: proposalEnd,
      status: 'pending',
      original_start: loan.start_date,
      original_end: loan.due_date,
    })

    const { data: msg } = await supabase
      .from('loan_messages')
      .insert({
        loan_id: loan.id,
        sender_id: user.id,
        type: 'change_proposal',
        body: proposalNote || '',
        metadata: meta,
      })
      .select('*, profiles(name, email, avatar_url)')
      .single()

    if (msg) setMessages(prev => [...prev, msg])

    await supabase.from('loans').update({ status: 'change_proposed' }).eq('id', loan.id)
    onLoanUpdated({ ...loan, status: 'change_proposed' })

    const recipientId = isOwner ? loan.borrower_id : item.owner_id
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'loan_change_proposal',
      title: isOwner
        ? `Utleier foreslår ny dato for «${item.name}»`
        : `Låntaker ber om å endre datoer for «${item.name}»`,
      body: `${formatDate(proposalStart)} → ${formatDate(proposalEnd)}`,
      loan_id: loan.id,
    })

    setProposalStart('')
    setProposalEnd('')
    setProposalNote('')
    setShowProposalForm(false)
    setSubmittingProposal(false)
  }

  // ─── Respond to change proposal ─────────────────────────────────────────────
  const respondToProposal = async (messageId: string, accept: boolean) => {
    const supabase = createClient()
    const targetMsg = messages.find(m => m.id === messageId)
    const meta = JSON.parse(targetMsg?.metadata || '{}')
    const newMeta = { ...meta, status: accept ? 'accepted' : 'declined' }

    await supabase
      .from('loan_messages')
      .update({ metadata: JSON.stringify(newMeta) })
      .eq('id', messageId)

    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, metadata: JSON.stringify(newMeta) } : m)
    )

    const baseStatus = loan.status === 'active' ? 'active' : 'pending'
    if (accept) {
      await supabase.from('loans').update({
        status: baseStatus,
        start_date: meta.proposed_start,
        due_date: meta.proposed_end,
      }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus, start_date: meta.proposed_start, due_date: meta.proposed_end })
    } else {
      await supabase.from('loans').update({ status: baseStatus }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus })
    }

    const { data: sysMsg } = await supabase
      .from('loan_messages')
      .insert({
        loan_id: loan.id,
        sender_id: user.id,
        type: 'system',
        body: accept
          ? `✅ Endringsforslag godtatt – nye datoer: ${formatDate(meta.proposed_start)} → ${formatDate(meta.proposed_end)}`
          : `❌ Endringsforslag avslått – opprinnelige datoer gjelder`,
      })
      .select('*, profiles(name, email, avatar_url)')
      .single()

    if (sysMsg) setMessages(prev => [...prev, sysMsg])

    await supabase.from('notifications').insert({
      user_id: targetMsg.sender_id,
      type: accept ? 'proposal_accepted' : 'proposal_declined',
      title: accept ? '✅ Endringsforslag godtatt' : '❌ Endringsforslag avslått',
      body: accept
        ? `Nye datoer: ${formatDate(meta.proposed_start)} → ${formatDate(meta.proposed_end)}`
        : 'Opprinnelige datoer gjelder fortsatt',
      loan_id: loan.id,
    })
  }

  // ─── Apply quick suggestion ──────────────────────────────────────────────────
  const applySuggestion = (s: typeof QUICK_SUGGESTIONS[0]) => {
    setShowSuggestions(false)
    const note = s.noteTemplate(item.name)

    if (s.type === 'chat') {
      setNewMessage(note)
      inputRef.current?.focus()
      return
    }

    setProposalNote(note)
    const start = loan.start_date || new Date().toISOString().split('T')[0]
    setProposalStart(start)

    const baseEnd = loan.due_date || new Date().toISOString().split('T')[0]
    const d = new Date(baseEnd)
    d.setDate(d.getDate() + s.dateDelta)
    // Don't go before today
    const today = new Date()
    if (d < today) d.setDate(today.getDate() + 1)
    setProposalEnd(d.toISOString().split('T')[0])
    setShowProposalForm(true)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const visibleSuggestions = QUICK_SUGGESTIONS.filter(s => isOwner || !s.ownerOnly)
  const senderName = (msg: any) =>
    msg.profiles?.name || msg.profiles?.email?.split('@')[0] || '?'
  const isMe = (msg: any) => msg.sender_id === user.id

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* Thread header */}
      <div className="px-4 py-3 border-b border-[#F0EAE2] flex items-center gap-2">
        <span className="text-base">💬</span>
        <h3 className="font-bold text-[#2C1A0E] text-sm">Meldingstråd</h3>
        <span className="ml-auto text-xs text-[#9C7B65]">
          {loan.start_date && loan.due_date
            ? `${formatDate(loan.start_date)} → ${formatDate(loan.due_date)}`
            : loan.start_date
            ? `Fra ${formatDate(loan.start_date)}`
            : ''}
        </span>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-1 px-3 py-4 min-h-[180px] max-h-[420px] overflow-y-auto">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-24 text-[#9C7B65] text-sm">
            Laster meldinger…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#C4A882] text-sm italic">
            Ingen meldinger ennå
          </div>
        ) : (
          messages.map((msg, i) => {
            const mine = isMe(msg)
            const prevSame = i > 0 && messages[i - 1]?.sender_id === msg.sender_id
            const nextSame = i < messages.length - 1 && messages[i + 1]?.sender_id === msg.sender_id
            const showName = !mine && !prevSame
            const meta = msg.metadata ? JSON.parse(msg.metadata) : null

            // ── System message ──────────────────────────────────────────────
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <span className="bg-[#F0EAE2] text-[#6B4226] text-xs rounded-full px-4 py-1.5 text-center max-w-[90%]">
                    {msg.body}
                  </span>
                </div>
              )
            }

            // ── Change proposal card ────────────────────────────────────────
            if (msg.type === 'change_proposal') {
              const isPending = meta?.status === 'pending'
              const isAccepted = meta?.status === 'accepted'
              const isDeclined = meta?.status === 'declined'
              // Only the non-sender can respond, and only if still pending
              const canRespond = !mine && isPending

              return (
                <div key={msg.id} className={`flex flex-col my-3 ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`w-full max-w-[92%] rounded-2xl overflow-hidden border ${
                    isAccepted ? 'border-[#4A7C59]' :
                    isDeclined ? 'border-[#E8DDD0]' :
                    'border-[#C4673A]'
                  }`}>
                    {/* Header */}
                    <div className={`px-4 py-2.5 flex items-center gap-2 ${
                      isAccepted ? 'bg-[#EEF4F0]' :
                      isDeclined ? 'bg-[#F5F0EB]' :
                      'bg-[#FFF0E6]'
                    }`}>
                      <span className="text-base">
                        {isAccepted ? '✅' : isDeclined ? '❌' : '📅'}
                      </span>
                      <span className="text-xs font-bold text-[#2C1A0E] flex-1">
                        {mine ? 'Du foreslo endring' : `${senderName(msg)} foreslo endring`}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isAccepted ? 'bg-[#4A7C59] text-white' :
                        isDeclined ? 'bg-[#D0C9C0] text-[#6B5C50]' :
                        'bg-[#C4673A] text-white'
                      }`}>
                        {isAccepted ? 'Godtatt' : isDeclined ? 'Avslått' : 'Venter svar'}
                      </span>
                    </div>

                    {/* Date details */}
                    <div className="px-4 py-3 bg-white flex flex-col gap-1.5">
                      {meta?.original_start && meta?.original_end && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#9C7B65] uppercase tracking-wide w-20 flex-shrink-0">Nåværende</span>
                          <span className="text-xs text-[#9C7B65] line-through">
                            {formatDate(meta.original_start)} → {formatDate(meta.original_end)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9C7B65] uppercase tracking-wide w-20 flex-shrink-0">Foreslått</span>
                        <span className={`text-sm font-bold ${isDeclined ? 'text-[#9C7B65]' : 'text-[#2C1A0E]'}`}>
                          {formatDate(meta?.proposed_start)} → {formatDate(meta?.proposed_end)}
                        </span>
                      </div>
                      {msg.body ? (
                        <p className="mt-1 text-sm text-[#6B4226] bg-[#FAF7F2] rounded-xl px-3 py-2 leading-relaxed">
                          {msg.body}
                        </p>
                      ) : null}
                    </div>

                    {/* Borrower response buttons */}
                    {canRespond && (
                      <div className="px-3 pb-3 pt-1 flex gap-2">
                        <button
                          onClick={() => respondToProposal(msg.id, true)}
                          className="flex-1 bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium"
                        >
                          ✓ Godta endring
                        </button>
                        <button
                          onClick={() => respondToProposal(msg.id, false)}
                          className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2 text-sm"
                        >
                          Avslå
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[#C4A882] mt-1 px-1">
                    {formatDateTime(msg.created_at)}
                  </span>
                </div>
              )
            }

            // ── Chat bubble ─────────────────────────────────────────────────
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'} ${prevSame ? 'mt-0.5' : 'mt-3'}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-xs text-[#6B4226] overflow-hidden flex-shrink-0 self-end ${mine || prevSame ? 'invisible' : ''}`}>
                  {msg.profiles?.avatar_url
                    ? <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" />
                    : senderName(msg)[0]?.toUpperCase()}
                </div>

                <div className={`flex flex-col gap-0.5 max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
                  {showName && (
                    <span className="text-[10px] text-[#9C7B65] px-1 mb-0.5">{senderName(msg)}</span>
                  )}
                  <div className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                    mine
                      ? 'bg-[#C4673A] text-white rounded-2xl rounded-tr-md'
                      : 'bg-[#FAF7F2] text-[#2C1A0E] rounded-2xl rounded-tl-md'
                  }`}>
                    {msg.body}
                  </div>
                  {!nextSame && (
                    <span className="text-[10px] text-[#C4A882] px-1">
                      {formatDateTime(msg.created_at)}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Change proposal form ─────────────────────────────────────────────── */}
      {showProposalForm && (
        <div className="border-t border-[#F0EAE2] bg-[#FFF9F5] px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-[#2C1A0E]">📅 Foreslå endring av datoer</span>
            <button
              onClick={() => { setShowProposalForm(false); setProposalNote(''); setProposalStart(''); setProposalEnd('') }}
              className="text-xs text-[#9C7B65] hover:text-[#C4673A]"
            >
              Avbryt
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Ny startdato</label>
              <input
                type="date"
                value={proposalStart}
                onChange={e => setProposalStart(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="bg-white border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Ny sluttdato</label>
              <input
                type="date"
                value={proposalEnd}
                onChange={e => setProposalEnd(e.target.value)}
                min={proposalStart || new Date().toISOString().split('T')[0]}
                className="bg-white border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
          </div>
          {proposalStart && proposalEnd && (
            <div className="bg-[#EEF4F0] rounded-xl px-3 py-2 text-xs text-[#4A7C59] font-medium">
              ✓ {formatDate(proposalStart)} → {formatDate(proposalEnd)}
            </div>
          )}
          <textarea
            value={proposalNote}
            onChange={e => setProposalNote(e.target.value)}
            rows={2}
            placeholder="Legg til en melding (valgfritt)…"
            className="bg-white border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-sm text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none placeholder:text-[#C4A882]"
          />
          <button
            onClick={submitProposal}
            disabled={!proposalStart || !proposalEnd || submittingProposal}
            className="w-full bg-[#C4673A] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {submittingProposal ? 'Sender…' : 'Send endringsforslag'}
          </button>
        </div>
      )}

      {/* ── Quick suggestions drawer ─────────────────────────────────────────── */}
      {showSuggestions && !showProposalForm && (
        <div className="border-t border-[#F0EAE2] bg-[#FAF7F2] px-3 py-3">
          <p className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide mb-2 px-1">
            Hurtigforslag
          </p>
          <div className="flex flex-col gap-1.5">
            {visibleSuggestions.map(s => (
              <button
                key={s.id}
                onClick={() => applySuggestion(s)}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 text-left border border-[#F0EAE2] active:bg-[#FFF0E6] transition-colors"
              >
                <span className="text-xl flex-shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2C1A0E]">{s.label}</p>
                  <p className="text-xs text-[#9C7B65] truncate">{s.description}</p>
                </div>
                <span className="text-xs text-[#C4A882] flex-shrink-0">
                  {s.type === 'change_proposal' ? '📅 Forslag' : '→ Melding'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input area ───────────────────────────────────────────────────────── */}
      {!showProposalForm && (
        <div className="border-t border-[#F0EAE2] px-3 py-3 flex flex-col gap-2 bg-white">
          {/* Action chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setShowProposalForm(true); setShowSuggestions(false) }}
              className="flex items-center gap-1.5 bg-[#FFF0E6] border border-[#F5D5C0] text-[#C4673A] rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              📅 Foreslå endring
            </button>
            <button
              onClick={() => setShowSuggestions(s => !s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                showSuggestions
                  ? 'bg-[#2C1A0E] text-white border-transparent'
                  : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              ✨ Hurtigforslag
            </button>
          </div>

          {/* Text row */}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              rows={1}
              placeholder="Skriv en melding…"
              className="flex-1 bg-[#FAF7F2] border border-[#E8DDD0] rounded-2xl px-4 py-2.5 text-sm text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none placeholder:text-[#C4A882] leading-relaxed"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-full bg-[#C4673A] flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
