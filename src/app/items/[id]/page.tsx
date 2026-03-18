'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ItemCalendar from '@/components/ItemCalendar'
import LoanThread from '@/components/LoanThread'
import { track, Events, startTimer } from '@/lib/track'

const CATEGORY_GRADIENTS: Record<string, { gradient: string; label: string }> = {
  'verktøy':     { gradient: 'linear-gradient(135deg, #4A7C59 0%, #2d5a3d 100%)', label: 'Verktøy' },
  'bok':         { gradient: 'linear-gradient(135deg, #C4673A 0%, #8B3A1E 100%)', label: 'Bøker' },
  'elektronikk': { gradient: 'linear-gradient(135deg, #2C1A0E 0%, #4a3020 100%)', label: 'Elektronikk' },
  'sport':       { gradient: 'linear-gradient(135deg, #3a7fbf 0%, #1a4f7f 100%)', label: 'Sport' },
  'barn':        { gradient: 'linear-gradient(135deg, #e07b4a 0%, #c4673a 100%)', label: 'Barn' },
  'hage':        { gradient: 'linear-gradient(135deg, #5a9a6a 0%, #3a7a4a 100%)', label: 'Hage' },
  'kjøkken':     { gradient: 'linear-gradient(135deg, #9C7B65 0%, #6B4226 100%)', label: 'Kjøkken' },
  'klær':        { gradient: 'linear-gradient(135deg, #b86ea0 0%, #7a3a6a 100%)', label: 'Klær' },
}

const getCategoryGradient = (category?: string) => {
  if (!category) return { gradient: 'linear-gradient(135deg, #C4673A 0%, #8B3A1E 100%)', label: 'VILLAGE' }
  return CATEGORY_GRADIENTS[category.toLowerCase()] || { gradient: 'linear-gradient(135deg, #9C7B65 0%, #6B4226 100%)', label: category }
}

export default function ItemPage() {
  const [item, setItem]                     = useState<any>(null)
  const [user, setUser]                     = useState<any>(null)
  const [loan, setLoan]                     = useState<any>(null)
  const [allLoans, setAllLoans]             = useState<any[]>([])
  const [pendingLoans, setPendingLoans]     = useState<any[]>([])
  const [proposalLoanId, setProposalLoanId] = useState<string | null>(null)
  const [blockedDates, setBlockedDates]     = useState<string[]>([])
  const [message, setMessage]               = useState('')
  const [startDate, setStartDate]           = useState('')
  const [dueDate, setDueDate]               = useState('')
  const [sent, setSent]                     = useState(false)
  const [sentRange, setSentRange]           = useState<{ start: string; end: string } | null>(null)
  const [loading, setLoading]               = useState(true)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: item } = await supabase
        .from('items')
        .select('*, profiles(id, name, email, avatar_url)')
        .eq('id', id)
        .single()
      setItem(item)
      setMessage(`Hei! Kan jeg låne «${item?.name}»? 😊`)

      const { data: loans } = await supabase
        .from('loans')
        .select('*, profiles!loans_borrower_id_fkey(id, name, email, avatar_url)')
        .eq('item_id', id)
        .in('status', ['pending', 'active', 'change_proposed'])
        .order('start_date', { ascending: true })
      setAllLoans(loans || [])

      const myLoan = (loans || []).find((l: any) => l.borrower_id === user.id)
      setLoan(myLoan || null)

      if (item?.owner_id === user.id) {
        setPendingLoans((loans || []).filter((l: any) =>
          l.status === 'pending' || l.status === 'change_proposed'
        ))
      }

      const { data: blocked } = await supabase
        .from('item_blocked_dates').select('date').eq('item_id', id)
      setBlockedDates((blocked || []).map((b: any) => b.date))

      if (item?.owner_id !== user.id) track(Events.CALENDAR_OPENED, { item_id: item?.id })

      setLoading(false)
    }
    load()
  }, [id])

  const toggleBlock = async (dateStr: string) => {
    const supabase = createClient()
    if (blockedDates.includes(dateStr)) {
      await supabase.from('item_blocked_dates').delete().eq('item_id', id).eq('date', dateStr)
      setBlockedDates(prev => prev.filter(d => d !== dateStr))
    } else {
      await supabase.from('item_blocked_dates').insert({ item_id: id, date: dateStr })
      setBlockedDates(prev => [...prev, dateStr])
    }
  }

  const handleSelectRange = (start: string, end: string) => {
    setStartDate(start)
    setDueDate(end)
    setMessage(`Hei! Kan jeg låne «${item?.name}» fra ${fd(start)} til ${fd(end)}? 😊`)
    track(Events.DATE_RANGE_SELECTED, {
      item_id: item?.id,
      days: Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000),
    })
  }

  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    if (val && dueDate) setMessage(`Hei! Kan jeg låne «${item?.name}» fra ${fd(val)} til ${fd(dueDate)}? 😊`)
  }

  const handleDueDateChange = (val: string) => {
    setDueDate(val)
    if (startDate && val) setMessage(`Hei! Kan jeg låne «${item?.name}» fra ${fd(startDate)} til ${fd(val)}? 😊`)
  }

  const sendRequest = async () => {
    if (!message.trim() || !startDate || !dueDate) return
    const t = startTimer()
    const supabase = createClient()
    const { data: newLoan } = await supabase.from('loans').insert({
      item_id: id,
      borrower_id: user.id,
      owner_id: item.owner_id,
      message,
      start_date: startDate,
      due_date: dueDate,
      status: 'pending',
      community_id: item.community_id || null,
    }).select().single()

    if (newLoan?.id) {
      await supabase.from('loan_messages').insert({
        loan_id: newLoan.id,
        sender_id: user.id,
        type: 'chat',
        body: message,
      })
    }

    await supabase.from('notifications').insert({
      user_id: item.owner_id,
      type: 'loan_request',
      title: 'Ny låneforespørsel',
      body: `${user.email?.split('@')[0]} vil låne «${item.name}»`,
      loan_id: newLoan?.id,
    })

    setSentRange({ start: startDate, end: dueDate })
    setLoan(newLoan)
    setSent(true)
    track(Events.LOAN_REQUEST_SENT, {
      item_id: item.id,
      duration_ms: t(),
      days_requested: Math.ceil((new Date(dueDate).getTime() - new Date(startDate).getTime()) / 86400000),
    })
  }

  const respondToLoan = async (loanId: string, accept: boolean) => {
    const supabase = createClient()
    await supabase.from('loans').update({ status: accept ? 'active' : 'declined' }).eq('id', loanId)

    if (accept) {
      await supabase.from('items').update({ available: false }).eq('id', id)
      setItem((i: any) => ({ ...i, available: false }))
    }

    const targetLoan = pendingLoans.find(l => l.id === loanId)

    await supabase.from('loan_messages').insert({
      loan_id: loanId,
      sender_id: user.id,
      type: 'system',
      body: accept
        ? `✅ Forespørsel godtatt${targetLoan?.start_date ? ` – ${fd(targetLoan.start_date)}${targetLoan?.due_date ? ` → ${fd(targetLoan.due_date)}` : ''}` : ''}`
        : `❌ Forespørsel avslått`,
    })

    await supabase.from('notifications').insert({
      user_id: targetLoan?.borrower_id,
      type: accept ? 'loan_accepted' : 'loan_declined',
      title: accept ? '✓ Forespørsel godtatt!' : 'Forespørsel avslått',
      body: accept ? `Lånet av «${item.name}» er godkjent` : `Forespørselen om «${item.name}» ble avslått`,
      loan_id: loanId,
    })

    setPendingLoans(prev => prev.filter(l => l.id !== loanId))
    if (accept && targetLoan) {
      setAllLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'active' } : l))
    }
    track(accept ? Events.LOAN_ACCEPTED : Events.LOAN_DECLINED, {
      loan_id: loanId,
      item_id: item.id,
    })
  }

  const markReturned = async (loanId: string) => {
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    await supabase.from('items').update({ available: true }).eq('id', id)
    setItem((i: any) => ({ ...i, available: true }))
    setAllLoans(prev => prev.filter(l => l.id !== loanId))
  }

  const fd = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
  const isOverdue = (due: string) => due && new Date(due) < new Date()
  const isDueSoon = (due: string) => {
    if (!due) return false
    const diff = (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  if (!item)   return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Fant ikke gjenstanden</div>

  const ownerName   = item.profiles?.name || item.profiles?.email?.split('@')[0]
  const isOwner     = user?.id === item.owner_id
  const activeLoan  = allLoans.find(l => l.status === 'active')
  const categoryGfx = getCategoryGradient(item.category)

  return (
    <div className="max-w-lg mx-auto pb-32">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <button onClick={() => router.back()}
          className="btn-glass absolute top-6 left-4 z-10"
          style={{ width: 36, height: 36, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        {item.image_url ? (
          <div className="w-full overflow-hidden" style={{ height: 256 }}>
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center gap-2"
            style={{ height: 256, background: categoryGfx.gradient }}>
            <span className="font-display text-white/90 font-semibold"
              style={{ fontSize: 20, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {categoryGfx.label}
            </span>
            <span className="text-white/60 text-sm">{item.name}</span>
          </div>
        )}
        {!item.available && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold tracking-widest" style={{ fontSize: 18 }}>UTLÅNT</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">

        {/* ── Title + price ─────────────────────────────────────────────── */}
        <div className="flex justify-between items-start">
          <h1 className="font-display flex-1"
            style={{ fontSize: 26, color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            {item.name}
          </h1>
          {item.price
            ? <span className="status-pill pending ml-2">{item.price} kr/dag</span>
            : <span className="status-pill active ml-2">Gratis</span>}
        </div>

        {/* ── Availability banner ───────────────────────────────────────── */}
        {item.available ? (
          <div className="glass" style={{ borderRadius: 16, padding: '12px 16px' }}>
            <span className="status-pill active">● Tilgjengelig nå</span>
          </div>
        ) : activeLoan ? (
          <div className="glass" style={{ borderRadius: 16, padding: '12px 16px' }}>
            <div className="flex items-center gap-3">
              <Link href={`/profile/${activeLoan.profiles?.id}`}>
                <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm"
                  style={{ width: 36, height: 36, background: 'rgba(196,103,58,0.15)', color: 'var(--terra)' }}>
                  {activeLoan.profiles?.avatar_url
                    ? <img src={activeLoan.profiles.avatar_url} className="w-full h-full object-cover" />
                    : (activeLoan.profiles?.name || activeLoan.profiles?.email)?.[0]?.toUpperCase()}
                </div>
              </Link>
              <div className="flex-1">
                <Link href={`/profile/${activeLoan.profiles?.id}`}
                  className="text-sm font-medium hover:underline" style={{ color: 'var(--terra-dark)' }}>
                  Lånt av {activeLoan.profiles?.name || activeLoan.profiles?.email?.split('@')[0]}
                </Link>
                {activeLoan.due_date && (
                  <p className="text-xs mt-0.5 font-medium"
                    style={{ color: isOverdue(activeLoan.due_date) ? '#ef4444' : isDueSoon(activeLoan.due_date) ? 'var(--terra)' : 'var(--terra-mid)' }}>
                    {isOverdue(activeLoan.due_date)
                      ? `⚠️ Skulle vært returnert ${fd(activeLoan.due_date)}`
                      : isDueSoon(activeLoan.due_date)
                        ? `⏰ Returneres snart – ${fd(activeLoan.due_date)}`
                        : `Returneres ${fd(activeLoan.due_date)}`}
                  </p>
                )}
              </div>
            </div>
            {isOwner && (
              <button onClick={() => markReturned(activeLoan.id)}
                className="btn-sm btn-accept mt-3 w-full">
                ✓ Bekreft at {activeLoan.profiles?.name || activeLoan.profiles?.email?.split('@')[0]} har levert tilbake
              </button>
            )}
          </div>
        ) : null}

        {item.description && (
          <p style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>{item.description}</p>
        )}

        {/* ── Owner card ────────────────────────────────────────────────── */}
        <Link href={`/profile/${item.profiles?.id}`}>
          <div className="item-card" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(196,103,58,0.18)' }}>
            <div className="item-card-body glass-card"
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0"
                style={{ width: 40, height: 40, background: 'var(--terra)' }}>
                {item.profiles?.avatar_url
                  ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" />
                  : ownerName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--terra-dark)' }}>{ownerName}</p>
                <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Eier</p>
              </div>
            </div>
          </div>
        </Link>

        {/* ── Calendar ──────────────────────────────────────────────────── */}
        <ItemCalendar
          loans={allLoans}
          blockedDates={blockedDates}
          requestedRange={sentRange}
          onToggleBlock={isOwner ? toggleBlock : undefined}
          onSelectRange={!isOwner && !loan && item.available ? handleSelectRange : undefined}
          isOwner={isOwner}
        />

        {/* ══ OWNER VIEWS ═════════════════════════════════════════════════ */}

        {isOwner && item.available && pendingLoans.length === 0 && !activeLoan && (
          <div className="flex gap-2">
            <div className="glass flex-1" style={{ borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--terra)' }}>Dette er din gjenstand</p>
            </div>
            <Link href={`/items/access?item=${item.id}`}>
              <div className="glass" style={{ borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
                <p className="text-sm">🔒</p>
                <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>Tilgang</p>
              </div>
            </Link>
          </div>
        )}

        {isOwner && activeLoan && (
          <div className="flex flex-col gap-2">
            <h2 className="font-display font-bold"
              style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Meldingstråd</h2>
            <LoanThread loan={activeLoan} item={item} user={user} isOwner={true}
              onLoanUpdated={updated => setAllLoans(prev => prev.map(l => l.id === updated.id ? updated : l))} />
          </div>
        )}

        {isOwner && pendingLoans.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display font-bold"
              style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
              Innkommende forespørsler{' '}
              <span style={{ color: 'var(--terra)' }}>({pendingLoans.length})</span>
            </h2>

            {pendingLoans.map(l => (
              <div key={l.id} className="flex flex-col">
                <div className="glass" style={{ borderRadius: '16px 16px 0 0', padding: 16 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Link href={`/profile/${l.profiles?.id}`}>
                      <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-sm"
                        style={{ width: 36, height: 36, background: 'rgba(196,103,58,0.15)', color: 'var(--terra)' }}>
                        {l.profiles?.avatar_url
                          ? <img src={l.profiles.avatar_url} className="w-full h-full object-cover" />
                          : (l.profiles?.name || l.profiles?.email)?.[0]?.toUpperCase()}
                      </div>
                    </Link>
                    <div className="flex-1">
                      <Link href={`/profile/${l.profiles?.id}`}
                        className="font-medium text-sm hover:underline" style={{ color: 'var(--terra-dark)' }}>
                        {l.profiles?.name || l.profiles?.email?.split('@')[0]}
                      </Link>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>
                      {fd(l.start_date)}{l.due_date ? ` → ${fd(l.due_date)}` : ''}
                    </span>
                  </div>

                  {l.status === 'change_proposed' ? (
                    <div className="glass" style={{ borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, border: '1px solid rgba(196,103,58,0.3)' }}>
                      <span style={{ fontSize: 18, marginTop: 2 }}>📅</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--terra)' }}>Endringsforslag sendt</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Venter på svar fra låntaker – se meldingstråden</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => respondToLoan(l.id, true)} className="btn-sm btn-accept flex-1">
                        ✓ Godta
                      </button>
                      <button
                        onClick={() => {
                          setProposalLoanId(l.id)
                          setTimeout(() => {
                            document.getElementById(`proposal-${l.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }, 80)
                        }}
                        className="btn-glass btn-sm flex-1">
                        📅 Foreslå endring
                      </button>
                      <button onClick={() => respondToLoan(l.id, false)} className="btn-sm btn-decline flex-1">
                        Avslå
                      </button>
                    </div>
                  )}
                </div>

                <div id={`proposal-${l.id}`} style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                  <LoanThread
                    loan={l}
                    item={item}
                    user={user}
                    isOwner={true}
                    openProposal={proposalLoanId === l.id}
                    onProposalOpened={() => setProposalLoanId(null)}
                    onLoanUpdated={updated => {
                      if (updated.status === 'active') {
                        setPendingLoans(prev => prev.filter(p => p.id !== updated.id))
                      } else {
                        setPendingLoans(prev => prev.map(p => p.id === updated.id ? updated : p))
                      }
                      setAllLoans(prev => prev.map(a => a.id === updated.id ? updated : a))
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ BORROWER VIEWS ══════════════════════════════════════════════ */}

        {!isOwner && loan?.status === 'pending' && (
          <div className="flex flex-col gap-3">
            <div className="glass" style={{ borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <span className="status-pill pending">⏳ Venter på svar fra {ownerName}</span>
            </div>
            <LoanThread loan={loan} item={item} user={user} isOwner={false}
              onLoanUpdated={updated => setLoan(updated)} />
          </div>
        )}

        {!isOwner && loan?.status === 'change_proposed' && (
          <div className="flex flex-col gap-3">
            <div className="glass" style={{ borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(196,103,58,0.3)' }}>
              <span style={{ fontSize: 24 }}>📅</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--terra)' }}>Utleier har foreslått endring</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Se meldingstråden og svar på forslaget</p>
              </div>
            </div>
            <LoanThread loan={loan} item={item} user={user} isOwner={false}
              onLoanUpdated={updated => {
                setLoan(updated)
                if (updated.status === 'active') {
                  setAllLoans(prev => prev.map(l => l.id === updated.id ? updated : l))
                }
              }} />
          </div>
        )}

        {!isOwner && loan?.status === 'active' && (
          <div className="flex flex-col gap-3">
            <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
              <span className="status-pill active">✓ Du låner denne nå!</span>
              {loan.due_date && (
                <p className="text-sm mt-2" style={{ color: 'var(--terra-mid)' }}>Returner innen {fd(loan.due_date)}</p>
              )}
              {item.price && item.vipps_number && (
                <a href={`https://qr.vipps.no/28/2/01/031/${item.vipps_number}?amount=${item.price}&message=Leie+${encodeURIComponent(item.name)}`}
                  target="_blank"
                  className="btn-primary mt-3 flex items-center justify-center gap-2 w-full"
                  style={{ background: '#FF5B24' }}>
                  Betal via Vipps 💸
                </a>
              )}
            </div>
            <LoanThread loan={loan} item={item} user={user} isOwner={false}
              onLoanUpdated={updated => setLoan(updated)} />
          </div>
        )}

        {!isOwner && !loan && item.available && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display font-bold"
              style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
              Send låneforespørsel
            </h2>
            {sent ? (
              <div className="flex flex-col gap-3">
                <div className="glass" style={{ borderRadius: 16, padding: 16, textAlign: 'center' }}>
                  <span className="status-pill active">✓ Forespørsel sendt til {ownerName}!</span>
                </div>
                {loan && <LoanThread loan={loan} item={item} user={user} isOwner={false}
                  onLoanUpdated={updated => setLoan(updated)} />}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Fra</label>
                    <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="glass text-sm outline-none"
                      style={{ borderRadius: 12, padding: '10px 12px', color: 'var(--terra-dark)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Til</label>
                    <input type="date" value={dueDate} onChange={e => handleDueDateChange(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="glass text-sm outline-none"
                      style={{ borderRadius: 12, padding: '10px 12px', color: 'var(--terra-dark)' }} />
                  </div>
                </div>
                {startDate && dueDate && (
                  <div className="glass" style={{ borderRadius: 12, padding: '8px 12px' }}>
                    <span className="status-pill active">✓ {fd(startDate)} → {fd(dueDate)}</span>
                  </div>
                )}
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  className="glass outline-none resize-none"
                  style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }} />
                <button onClick={sendRequest} disabled={!startDate || !dueDate}
                  className="btn-primary disabled:opacity-40">
                  Send forespørsel
                </button>
              </>
            )}
          </div>
        )}

        {!isOwner && !loan && !item.available && (
          <div className="glass" style={{ borderRadius: 16, padding: 16, textAlign: 'center' }}>
            <span className="status-pill declined">Utlånt akkurat nå</span>
          </div>
        )}

      </div>
    </div>
  )
}
