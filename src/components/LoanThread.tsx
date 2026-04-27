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

// ── Status helpers ────────────────────────────────────────────────────────────

type StatusStyle = {
  pillBg: string
  pillColor: string
  label: string
  cardBorder: string
  cardHeaderBg: string
}

function statusStyle(status: string): StatusStyle {
  switch (status) {
    case 'pending':
      return { pillBg: '#FAEEDA', pillColor: '#633806', label: 'Forespurt', cardBorder: 'rgba(196,103,58,0.25)', cardHeaderBg: 'rgba(196,103,58,0.06)' }
    case 'confirmed':
      return { pillBg: '#E6F1FB', pillColor: '#185FA5', label: 'Klar til henting', cardBorder: 'rgba(56,138,221,0.3)', cardHeaderBg: 'rgba(56,138,221,0.06)' }
    case 'active':
      return { pillBg: '#EAF3DE', pillColor: '#27500A', label: 'Aktivt lån', cardBorder: 'rgba(74,124,89,0.25)', cardHeaderBg: 'rgba(74,124,89,0.06)' }
    case 'change_proposed':
      return { pillBg: '#FAEEDA', pillColor: '#633806', label: 'Endringsforslag', cardBorder: 'rgba(196,103,58,0.35)', cardHeaderBg: 'rgba(196,103,58,0.08)' }
    case 'pending_return':
      return { pillBg: '#E6F1FB', pillColor: '#185FA5', label: 'Venter retur-bekreftelse', cardBorder: 'rgba(56,138,221,0.3)', cardHeaderBg: 'rgba(56,138,221,0.06)' }
    case 'overdue':
      return { pillBg: '#FCEBEB', pillColor: '#791F1F', label: 'Forfalt', cardBorder: 'rgba(226,75,74,0.35)', cardHeaderBg: 'rgba(226,75,74,0.06)' }
    default:
      return { pillBg: '#F1EFE8', pillColor: '#5F5E5A', label: 'Avsluttet', cardBorder: 'rgba(156,123,101,0.2)', cardHeaderBg: 'rgba(156,123,101,0.04)' }
  }
}

// ── Hurtigvalg ────────────────────────────────────────────────────────────────

type QuickAction = {
  id: string
  label: string
  sub: string
  type: 'proposal' | 'chat' | 'action'
  delta?: number
  chatNote?: (n: string) => string
  actionKey?: string
  style?: 'green' | 'amber' | 'default'
}

function getQuickActions(status: string, isOwner: boolean): QuickAction[] {
  if (isOwner) {
    if (status === 'pending') return [
      { id: 'tilpass', label: 'Tilpass periode', sub: 'Endre datoer', type: 'proposal', delta: 0, style: 'default' },
      { id: 'henting', label: 'Send hentested', sub: 'Melding med info direkte i tråden', type: 'chat', chatNote: n => `Hei! Du kan hente «${n}» hos meg – gi meg beskjed når det passer 📍`, style: 'default' },
    ]
    if (status === 'confirmed') return [
      { id: 'bekreft-henting', label: 'Bekreft henting', sub: 'Gjenstanden er utlevert — start lån', type: 'action', actionKey: 'confirm_pickup', style: 'green' },
      { id: 'tilpass', label: 'Tilpass periode', sub: 'Endre datoer', type: 'proposal', delta: 0, style: 'default' },
    ]
    if (status === 'active' || status === 'overdue') return [
      { id: 'bekreft-retur', label: 'Bekreft retur', sub: 'Gjenstanden er tilbake hos deg', type: 'action', actionKey: 'confirm_return', style: 'green' },
      { id: 'tilpass', label: 'Tilpass periode', sub: 'Endre datoer', type: 'proposal', delta: 0, style: 'default' },
      { id: 'paminnelse', label: 'Send påminnelse', sub: 'Melding om retur i tråden', type: 'chat', chatNote: n => `Hei! Bare en påminnelse om at «${n}» snart skal returneres 🙂`, style: 'default' },
    ]
    if (status === 'pending_return') return [
      { id: 'bekreft-retur', label: 'Ja, mottatt — avslutt lån', sub: 'Gjenstanden er tilbake hos deg', type: 'action', actionKey: 'confirm_return', style: 'green' },
      { id: 'ikke-mottatt', label: 'Ikke mottatt ennå', sub: 'Send melding i tråden', type: 'chat', chatNote: n => `Hei! Jeg har ikke fått tilbake «${n}» ennå – hvor er du?`, style: 'default' },
    ]
  } else {
    // Borrower
    if (status === 'pending' || status === 'confirmed') return [
      { id: 'avtal-henting', label: 'Avtal henting', sub: 'Spør om sted og tidspunkt', type: 'chat', chatNote: n => `Hei! Når og hvor kan jeg hente «${n}»? 😊`, style: 'default' },
      { id: 'tilpass', label: 'Tilpass periode', sub: 'Endre datoer', type: 'proposal', delta: 0, style: 'default' },
    ]
    if (status === 'active') return [
      { id: 'merk-levert', label: 'Merk som levert', sub: 'Utleier bekrefter mottak', type: 'action', actionKey: 'mark_returned', style: 'amber' },
      { id: 'forleng', label: 'Forleng lånet', sub: 'Be om mer tid', type: 'proposal', delta: 3, style: 'default' },
      { id: 'lever-tidlig', label: 'Lever tidligere', sub: 'Kortere periode', type: 'proposal', delta: -2, style: 'default' },
    ]
    if (status === 'overdue') return [
      { id: 'merk-levert', label: 'Merk som levert', sub: 'Utleier bekrefter mottak', type: 'action', actionKey: 'mark_returned', style: 'amber' },
    ]
  }
  return []
}

// ── CounterpartRow ────────────────────────────────────────────────────────────

function CounterpartRow({ loan, item, isOwner }: { loan: any; item: any; isOwner: boolean }) {
  const profile = isOwner ? (loan?.profiles ?? null) : (item?.profiles ?? null)
  const name = profile?.name ?? profile?.email?.split('@')[0] ?? null
  const avatarUrl = profile?.avatar_url ?? null
  const profileId = profile?.id ?? null
  const roleLabel = isOwner ? 'Låntaker' : 'Eier'
  const ss = statusStyle(loan?.status ?? '')
  if (!name) return null
  return (
    <Link href={profileId ? `/profile/${profileId}` : '#'}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: `0.5px solid ${ss.cardBorder}`, textDecoration: 'none' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(196,103,58,0.12)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--terra)' }}>
        {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : name[0]?.toUpperCase()}
      </div>
      <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>
        {roleLabel}: <span style={{ color: 'var(--terra-dark)', fontWeight: 500 }}>{name}</span>
      </span>
    </Link>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoanThread({ loan, item, user, isOwner, onLoanUpdated, openProposal, onProposalOpened }: LoanThreadProps) {
  const [messages, setMessages]         = useState<any[]>([])
  const [newMessage, setNewMessage]     = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [cardOpen, setCardOpen]         = useState(true)
  const [showProposal, setShowProposal] = useState(false)
  const [propStart, setPropStart]       = useState('')
  const [propEnd, setPropEnd]           = useState('')
  const [propNote, setPropNote]         = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [borrowerCommunity, setBorrowerCommunity] = useState<string | null>(null)
  const [isFriend, setIsFriend]         = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const proposalRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  const today = todayYMD()
  const isActiveStatus = loan?.status === 'active'
  const startDateLocked = isActiveStatus && !!loan?.start_date

  const ss = statusStyle(loan?.status ?? '')
  const quickActions = getQuickActions(loan?.status ?? '', isOwner)

  // Auto-open card when action needed
  useEffect(() => {
    const needsAction = ['pending', 'pending_return', 'overdue'].includes(loan?.status)
    if (needsAction) setCardOpen(true)
  }, [loan?.status])

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loan?.id) return
    loadMessages()
    loadBorrowerContext()

    const supabase = createClient()
    const channel = supabase
      .channel(`loan_messages_${loan.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loan_messages', filter: `loan_id=eq.${loan.id}` },
        payload => {
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
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loan?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (openProposal && !showProposal) {
      setCardOpen(true)
      setShowProposal(true)
      onProposalOpened?.()
      setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [openProposal])

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadMessages = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loan_messages')
      .select('*, profiles(id, name, email, avatar_url)')
      .eq('loan_id', loan.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addLocal = (msg: any) => setMessages(prev => [...prev, msg])

  async function injectSystemMessage(body: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('loan_messages')
      .insert({ loan_id: loan.id, sender_id: user.id, type: 'system', body })
      .select('*, profiles(id, name, email, avatar_url)').single()
    if (data) addLocal(data)
  }

  // ── Send chat ─────────────────────────────────────────────────────────────

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

    const { data: msg, error } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'chat', body })
      .select('*, profiles(id, name, email, avatar_url)').single()

    if (error) { setMessages(prev => prev.filter(m => m.id !== tmpId)); setSending(false); return }
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

  // ── Quick actions ─────────────────────────────────────────────────────────

  const handleQuickAction = async (qa: QuickAction) => {
    const itemName = item?.name ?? 'gjenstanden'

    if (qa.type === 'chat' && qa.chatNote) {
      sendChat(qa.chatNote(itemName))
      return
    }

    if (qa.type === 'proposal') {
      const start = startDateLocked ? loan.start_date : (loan.start_date || today)
      setPropStart(start)
      const base = loan.due_date || today
      const d = new Date(base)
      d.setDate(d.getDate() + (qa.delta ?? 0))
      const todayDate = new Date()
      if (d <= todayDate) d.setDate(todayDate.getDate() + 1)
      setPropEnd(d.toISOString().split('T')[0])
      setPropNote('')
      setShowProposal(true)
      setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      return
    }

    if (qa.type === 'action') {
      setActionLoading(true)
      const supabase = createClient()

      if (qa.actionKey === 'confirm_pickup') {
        await supabase.from('loans').update({ status: 'active' }).eq('id', loan.id)
        await supabase.from('items').update({ available: false }).eq('id', item?.id)
        await injectSystemMessage(`✅ Henting bekreftet — lånet er aktivt`)
        onLoanUpdated({ ...loan, status: 'active' })
        track(Events.LOAN_ACCEPTED, { loan_id: loan.id, item_id: item?.id, action: 'confirm_pickup' })
      }

      if (qa.actionKey === 'mark_returned') {
        await supabase.from('loans').update({ status: 'pending_return' }).eq('id', loan.id)
        await injectSystemMessage(`📦 ${user.user_metadata?.name ?? 'Låntaker'} har merket gjenstanden som levert — venter på bekreftelse`)
        onLoanUpdated({ ...loan, status: 'pending_return' })
        const recipientId = item?.owner_id
        if (recipientId) {
          await supabase.from('notifications').insert({
            user_id: recipientId, type: 'loan_message',
            title: `«${item?.name}» er merket som levert`,
            body: 'Bekreft at du har mottatt gjenstanden.',
            loan_id: loan.id, subtype: `pending_return_${loan.id}`,
          })
        }
      }

      if (qa.actionKey === 'confirm_return') {
        await supabase.from('loans').update({ status: 'returned' }).eq('id', loan.id)
        await supabase.from('items').update({ available: true }).eq('id', item?.id)
        await injectSystemMessage(`✅ Retur bekreftet — lånet er avsluttet`)
        onLoanUpdated({ ...loan, status: 'returned' })
        track('loan_marked_returned', { loan_id: loan.id, item_id: item?.id })
      }

      setActionLoading(false)
    }
  }

  // ── Send proposal ─────────────────────────────────────────────────────────

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

    const { data: msg, error } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'change_proposal', body: propNote, metadata: meta })
      .select('*, profiles(id, name, email, avatar_url)').single()

    if (error) { setMessages(prev => prev.filter(m => m.id !== tmpId)); setSubmitting(false); return }
    setMessages(prev => prev.map(m => m.id === tmpId ? (msg || m) : m))
    await supabase.from('loans').update({ status: 'change_proposed' }).eq('id', loan.id)
    onLoanUpdated({ ...loan, status: 'change_proposed' })

    const recipientId = isOwner ? loan.borrower_id : item?.owner_id
    if (recipientId) {
      await supabase.from('notifications').insert({
        user_id: recipientId, type: 'loan_change_proposal',
        title: isOwner ? `Utleier foreslår ny dato for «${item?.name ?? 'gjenstand'}»` : `Låntaker vil endre datoer for «${item?.name ?? 'gjenstand'}»`,
        body: `${fmt(propStart)} → ${fmt(propEnd)} – svar i meldingstråden`,
        loan_id: loan.id,
      })
    }

    setPropStart(''); setPropEnd(''); setPropNote('')
    setShowProposal(false)
    setSubmitting(false)
    track(Events.PROPOSAL_SENT, { loan_id: loan.id, item_id: item?.id })
  }

  // ── Respond to proposal ───────────────────────────────────────────────────

  const respondProposal = async (messageId: string, accept: boolean) => {
    const supabase = createClient()
    const target = messages.find(m => m.id === messageId)
    const meta = typeof target?.metadata === 'string' ? JSON.parse(target.metadata) : target?.metadata || {}
    const newMeta = { ...meta, status: accept ? 'accepted' : 'declined' }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, metadata: JSON.stringify(newMeta) } : m))

    const sysBody = accept
      ? `✅ Endringsforslag godtatt – ${fmt(meta.proposed_start)} → ${fmt(meta.proposed_end)}`
      : `❌ Endringsforslag avslått – opprinnelige datoer gjelder`

    await supabase.from('loan_messages').update({ metadata: newMeta }).eq('id', messageId)

    const baseStatus = loan.status === 'active' ? 'active' : 'confirmed'
    if (accept) {
      await supabase.from('loans').update({ status: baseStatus, start_date: meta.proposed_start, due_date: meta.proposed_end }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus, start_date: meta.proposed_start, due_date: meta.proposed_end })
    } else {
      await supabase.from('loans').update({ status: baseStatus }).eq('id', loan.id)
      onLoanUpdated({ ...loan, status: baseStatus })
    }

    const { data: sysMsg } = await supabase
      .from('loan_messages').insert({ loan_id: loan.id, sender_id: user.id, type: 'system', body: sysBody })
      .select('*, profiles(id, name, email, avatar_url)').single()
    if (sysMsg) addLocal(sysMsg)

    await supabase.from('notifications').insert({
      user_id: target.sender_id,
      type: accept ? 'proposal_accepted' : 'proposal_declined',
      title: accept ? '✅ Endringsforslag godtatt' : '❌ Endringsforslag avslått',
      body: accept ? `Nye datoer: ${fmt(meta.proposed_start)} → ${fmt(meta.proposed_end)}` : 'Opprinnelige datoer gjelder fortsatt',
      loan_id: loan.id,
    })

    track(accept ? Events.PROPOSAL_ACCEPTED : Events.PROPOSAL_DECLINED, { loan_id: loan.id, item_id: item?.id })
  }

  const senderName = (msg: any) => msg.profiles?.name || msg.profiles?.email?.split('@')[0] || '?'
  const isMe = (msg: any) => msg.sender_id === user.id

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0" style={{ borderRadius: 16, overflow: 'hidden' }}>

      {/* ── AVTALEKORT ── */}
      <div style={{ background: 'rgba(255,248,243,0.95)', border: `1px solid ${ss.cardBorder}`, borderRadius: 16, overflow: 'hidden', marginBottom: 6 }}>

        {/* Header — produktbilde + navn + status, klikk for å kollapse */}
        <button
          onClick={() => setCardOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          {/* Produktbilde eller kategori-fallback */}
          {item?.image_url ? (
            <img src={item.image_url} alt={item?.name ?? ''}
              style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(196,103,58,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 7L12 3L4 7V17L12 21L20 17V7Z" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 3V21M4 7L12 11L20 7" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Navn + status + datoer */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--terra-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
              {item?.name ?? ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.pillBg, color: ss.pillColor, flexShrink: 0 }}>
                {ss.label}
              </span>
              {loan?.start_date && loan?.due_date && (
                <span style={{ fontSize: 11, color: 'var(--terra-mid)' }}>
                  {fmt(loan.start_date)} → {fmt(loan.due_date)}
                </span>
              )}
            </div>
          </div>

          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: cardOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="M3 5l4 4 4-4" stroke="var(--terra-mid)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Body — kollapses */}
        {cardOpen && (
          <div>
            {/* Låntaker / utleier-rad */}
            <CounterpartRow loan={loan} item={item} isOwner={isOwner} />

            {/* Datorad */}
            <div style={{ display: 'flex', borderTop: `0.5px solid ${ss.cardBorder}` }}>
              <div style={{ flex: 1, padding: '10px 14px', borderRight: `0.5px solid ${ss.cardBorder}` }}>
                <p style={{ fontSize: 10, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Starter</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--terra-dark)' }}>{loan?.start_date ? fmt(loan.start_date) : '—'}</p>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                <p style={{ fontSize: 10, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Returneres</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: loan?.status === 'overdue' ? '#E24B4A' : 'var(--terra-dark)' }}>
                  {loan?.due_date ? fmt(loan.due_date) : '—'}
                  {loan?.status === 'overdue' && <span style={{ fontSize: 11, marginLeft: 4 }}>⚠️</span>}
                </p>
              </div>
            </div>

            {/* Hurtigvalg */}
            {quickActions.length > 0 && !showProposal && (
              <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${ss.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <p style={{ fontSize: 10, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Hurtigvalg</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {quickActions.map(qa => {
                    const isGreen = qa.style === 'green'
                    const isAmber = qa.style === 'amber'
                    return (
                      <button
                        key={qa.id}
                        onClick={() => handleQuickAction(qa)}
                        disabled={actionLoading}
                        style={{
                          flex: '1 1 calc(50% - 4px)', minWidth: 120,
                          display: 'flex', flexDirection: 'column', padding: '9px 11px',
                          borderRadius: 10, cursor: actionLoading ? 'default' : 'pointer',
                          border: isGreen ? '0.5px solid #97C459' : isAmber ? '0.5px solid #EF9F27' : `0.5px solid ${ss.cardBorder}`,
                          background: isGreen ? '#EAF3DE' : isAmber ? '#FAEEDA' : 'rgba(255,248,243,0.6)',
                          textAlign: 'left', opacity: actionLoading ? 0.6 : 1,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 500, color: isGreen ? '#27500A' : isAmber ? '#633806' : 'var(--terra-dark)' }}>{qa.label}</span>
                        <span style={{ fontSize: 11, color: isGreen ? '#3B6D11' : isAmber ? '#854F0B' : 'var(--terra-mid)', marginTop: 2, lineHeight: 1.4 }}>{qa.sub}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Proposal form */}
            {showProposal && (
              <div ref={proposalRef} style={{ padding: '12px 14px', borderTop: `0.5px solid ${ss.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--terra-dark)' }}>Tilpass periode</span>
                  <button onClick={() => { setShowProposal(false); setPropNote('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--terra-mid)', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                      {startDateLocked ? 'Startdato (låst)' : 'Ny startdato'}
                    </label>
                    <input type="date" value={propStart}
                      onChange={e => !startDateLocked && setPropStart(e.target.value)}
                      disabled={startDateLocked}
                      min={startDateLocked ? undefined : today}
                      className="glass text-sm outline-none"
                      style={{ borderRadius: 10, padding: '9px 11px', color: 'var(--terra-dark)', width: '100%', opacity: startDateLocked ? 0.5 : 1 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Ny sluttdato</label>
                    <input type="date" value={propEnd} onChange={e => setPropEnd(e.target.value)}
                      min={propStart || today}
                      className="glass text-sm outline-none"
                      style={{ borderRadius: 10, padding: '9px 11px', color: 'var(--terra-dark)', width: '100%' }} />
                  </div>
                </div>
                <textarea value={propNote} onChange={e => setPropNote(e.target.value)} rows={2}
                  placeholder="Legg til en melding (valgfritt)…"
                  className="glass outline-none resize-none"
                  style={{ borderRadius: 10, padding: '9px 11px', fontSize: 13, color: 'var(--terra-dark)' }} />
                <button onClick={sendProposal} disabled={!propStart || !propEnd || submitting}
                  className="btn-primary disabled:opacity-40" style={{ fontSize: 13, padding: '10px' }}>
                  {submitting ? 'Sender…' : 'Send endringsforslag'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MELDINGSTRÅD ── */}
      <div style={{ background: 'rgba(245,245,245,0.8)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Meldinger */}
        <div className="flex flex-col px-3 py-4 gap-0.5 overflow-y-auto" style={{ minHeight: 160, maxHeight: 400 }}>
          {loading ? (
            <p className="text-center text-sm py-8" style={{ color: 'var(--terra-mid)' }}>Laster…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm italic py-8" style={{ color: 'var(--terra-mid)' }}>Ingen meldinger ennå</p>
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
              return (
                <div key={msg.id} className="flex flex-col items-center my-2 px-2">
                  <span className="system-message-pill">{msg.body}</span>
                </div>
              )
            }

            // Change proposal card
            if (msg.type === 'change_proposal') {
              const proposalStatus = (meta?.status && meta.status !== '') ? meta.status : 'pending'
              const canRespond = !mine && proposalStatus === 'pending'
              return (
                <div key={msg.id} className={`flex flex-col my-3 ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && !prevSameSender && (
                    <Link href={`/profile/${msg.profiles?.id}`} className="flex items-center gap-1.5 mb-0.5">
                      <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-[10px]"
                        style={{ width: 22, height: 22, background: 'rgba(196,103,58,0.15)', color: 'var(--terra)' }}>
                        {msg.profiles?.avatar_url ? <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" alt="" /> : senderName(msg)[0]?.toUpperCase()}
                      </div>
                      <span className="text-[11px]" style={{ color: 'var(--terra-mid)' }}>{senderName(msg)}</span>
                    </Link>
                  )}
                  <div className="proposal-card w-[88%]" style={{ borderColor: proposalStatus === 'accepted' ? 'var(--terra-green)' : proposalStatus === 'declined' ? 'rgba(196,103,58,0.18)' : 'var(--terra)' }}>
                    <div className="proposal-header" style={{ background: proposalStatus === 'accepted' ? 'rgba(74,124,89,0.1)' : proposalStatus === 'declined' ? 'rgba(156,123,101,0.1)' : 'rgba(196,103,58,0.08)' }}>
                      <span className="text-xs font-bold flex-1" style={{ color: 'var(--terra-dark)' }}>
                        {mine ? 'Du foreslo endring' : `${senderName(msg)} foreslo endring`}
                      </span>
                      <span className={`status-pill ${proposalStatus === 'accepted' ? 'active' : proposalStatus === 'declined' ? 'returned' : 'pending'}`} style={{ fontSize: 10 }}>
                        {proposalStatus === 'accepted' ? 'Godtatt' : proposalStatus === 'declined' ? 'Avslått' : 'Venter'}
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
                        <span className="text-sm font-bold" style={{ color: proposalStatus === 'declined' ? 'var(--terra-mid)' : 'var(--terra-dark)' }}>
                          {fmt(meta?.proposed_start)} → {fmt(meta?.proposed_end)}
                        </span>
                      </div>
                      {msg.body && <p className="mt-1 text-sm" style={{ color: 'var(--terra-dark)', background: 'rgba(196,103,58,0.06)', borderRadius: 8, padding: '5px 9px' }}>{msg.body}</p>}
                    </div>
                    {canRespond && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: '0 2px' }}>
                        <button onClick={() => respondProposal(msg.id, true)}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 99, background: 'var(--terra-green)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          ✓ Godta
                        </button>
                        <button onClick={() => respondProposal(msg.id, false)}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 99, background: 'transparent', color: 'var(--terra-mid)', border: '1px solid rgba(156,123,101,0.35)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                          Avslå
                        </button>
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
                    {!isMe(msg) && !isFriend && borrowerCommunity && (
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

        {/* Input */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(196,103,58,0.1)' }}>
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
            <button onClick={() => sendChat(newMessage)} disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 flex items-center justify-center disabled:opacity-25 transition-opacity"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--terra)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
