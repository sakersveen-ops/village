'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ItemCalendar from '@/components/ItemCalendar'

export default function ItemPage() {
  const [item, setItem] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loan, setLoan] = useState<any>(null)
  const [allLoans, setAllLoans] = useState<any[]>([])
  const [pendingLoans, setPendingLoans] = useState<any[]>([])
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)
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
        .select('*, profiles(name, email, avatar_url)')
        .eq('id', id)
        .single()
      setItem(item)
      setMessage(`Hei! Kan jeg låne "${item?.name}"? 😊`)

      const { data: loans } = await supabase
        .from('loans')
        .select('*, profiles!loans_borrower_id_fkey(name, email, avatar_url)')
        .eq('item_id', id)
        .in('status', ['pending', 'active'])
        .order('start_date', { ascending: true })
      setAllLoans(loans || [])

      const myLoan = (loans || []).find(l => l.borrower_id === user.id)
      setLoan(myLoan || null)

      if (item?.owner_id === user.id) {
        setPendingLoans((loans || []).filter(l => l.status === 'pending'))
      }

      const { data: blocked } = await supabase
        .from('item_blocked_dates')
        .select('date')
        .eq('item_id', id)
      setBlockedDates((blocked || []).map(b => b.date))

      setLoading(false)
    }
    load()
  }, [id])

  const toggleBlock = async (dateStr: string) => {
    const supabase = createClient()
    if (blockedDates.includes(dateStr)) {
      await supabase.from('item_blocked_dates').delete()
        .eq('item_id', id).eq('date', dateStr)
      setBlockedDates(prev => prev.filter(d => d !== dateStr))
    } else {
      await supabase.from('item_blocked_dates').insert({ item_id: id, date: dateStr })
      setBlockedDates(prev => [...prev, dateStr])
    }
  }

  const handleSelectRange = (start: string, end: string) => {
    setStartDate(start)
    setDueDate(end)
    setMessage(`Hei! Kan jeg låne "${item?.name}" fra ${formatDate(start)} til ${formatDate(end)}? 😊`)
  }

  const sendRequest = async () => {
    if (!message.trim()) return
    const supabase = createClient()
    const { data: newLoan } = await supabase.from('loans').insert({
      item_id: id,
      borrower_id: user.id,
      owner_id: item.owner_id,
      message,
      start_date: startDate || new Date().toISOString().split('T')[0],
      due_date: dueDate || null,
      status: 'pending',
      community_id: item.community_id || null,
    }).select().single()

    await supabase.from('notifications').insert({
      user_id: item.owner_id,
      type: 'loan_request',
      title: 'Ny låneforespørsel',
      body: `${user.email?.split('@')[0]} vil låne "${item.name}"`,
      loan_id: newLoan?.id,
    })
    setSent(true)
  }

  const respondToLoan = async (loanId: string, accept: boolean) => {
    const supabase = createClient()
    await supabase.from('loans').update({
      status: accept ? 'active' : 'declined'
    }).eq('id', loanId)

    if (accept) {
      await supabase.from('items').update({ available: false }).eq('id', id)
      setItem((i: any) => ({ ...i, available: false }))
    }

    const targetLoan = pendingLoans.find(l => l.id === loanId)
    await supabase.from('notifications').insert({
      user_id: targetLoan?.borrower_id,
      type: accept ? 'loan_accepted' : 'loan_declined',
      title: accept ? '✓ Forespørsel godtatt!' : 'Forespørsel avslått',
      body: accept
        ? `Lånet av "${item.name}" er godkjent`
        : `Forespørselen om "${item.name}" ble avslått`,
      loan_id: loanId,
    })
    setPendingLoans(prev => prev.filter(l => l.id !== loanId))
  }

  const markReturned = async (loanId: string) => {
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    await supabase.from('items').update({ available: true }).eq('id', id)
    setItem((i: any) => ({ ...i, available: true }))
    setAllLoans(prev => prev.filter(l => l.id !== loanId))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
  const isOverdue = (due: string) => due && new Date(due) < new Date()
  const isDueSoon = (due: string) => {
    if (!due) return false
    const diff = (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>
  if (!item) return <div className="p-8 text-center text-[#9C7B65]">Fant ikke gjenstanden</div>

  const ownerName = item.profiles?.name || item.profiles?.email?.split('@')[0]
  const isOwner = user?.id === item.owner_id
  const activeLoan = allLoans.find(l => l.status === 'active')

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Bilde */}
      <div className="relative">
        <button onClick={() => router.back()} className="absolute top-6 left-4 bg-white/80 rounded-full w-9 h-9 flex items-center justify-center text-[#2C1A0E] shadow-sm z-10">←</button>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-[#E8DDD0] flex items-center justify-center text-6xl">
            {item.category === 'barn' ? '🧸' : item.category === 'kjole' ? '👗' : item.category === 'verktøy' ? '🔧' : item.category === 'bok' ? '📚' : '📦'}
          </div>
        )}
        {!item.available && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold text-lg tracking-wide">UTLÅNT</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        {/* Tittel og pris */}
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold text-[#2C1A0E] flex-1">{item.name}</h1>
          {item.price ? (
            <span className="bg-[#FFF0E6] text-[#C4673A] font-bold text-sm px-3 py-1 rounded-full ml-2">{item.price} kr/dag</span>
          ) : (
            <span className="bg-[#EEF4F0] text-[#4A7C59] font-bold text-sm px-3 py-1 rounded-full ml-2">Gratis</span>
          )}
        </div>

        {/* Status */}
        {item.available ? (
          <div className="bg-[#EEF4F0] rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4A7C59] inline-block"></span>
            <p className="text-[#4A7C59] font-medium text-sm">Tilgjengelig nå</p>
          </div>
        ) : activeLoan ? (
          <div className={`rounded-2xl px-4 py-3 ${isOverdue(activeLoan.due_date) ? 'bg-red-50' : isDueSoon(activeLoan.due_date) ? 'bg-[#FFF0E6]' : 'bg-[#FAF7F2]'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                {activeLoan.profiles?.avatar_url
                  ? <img src={activeLoan.profiles.avatar_url} className="w-full h-full object-cover" />
                  : (activeLoan.profiles?.name || activeLoan.profiles?.email)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#2C1A0E]">
                  Lånt av {activeLoan.profiles?.name || activeLoan.profiles?.email?.split('@')[0]}
                </p>
                {activeLoan.due_date && (
                  <p className={`text-xs mt-0.5 font-medium ${isOverdue(activeLoan.due_date) ? 'text-red-500' : isDueSoon(activeLoan.due_date) ? 'text-[#C4673A]' : 'text-[#9C7B65]'}`}>
                    {isOverdue(activeLoan.due_date)
                      ? `⚠️ Skulle vært returnert ${formatDate(activeLoan.due_date)}`
                      : isDueSoon(activeLoan.due_date)
                      ? `⏰ Returneres snart – ${formatDate(activeLoan.due_date)}`
                      : `Returneres ${formatDate(activeLoan.due_date)}`}
                  </p>
                )}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => markReturned(activeLoan.id)}
                className="mt-3 w-full bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium"
              >
                ✓ Bekreft at {activeLoan.profiles?.name || activeLoan.profiles?.email?.split('@')[0]} har levert tilbake
              </button>
            )}
          </div>
        ) : null}

        {item.description && <p className="text-[#6B4226]">{item.description}</p>}

        {/* Eier */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold overflow-hidden">
            {item.profiles?.avatar_url
              ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" />
              : ownerName?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#2C1A0E]">{ownerName}</p>
            <p className="text-xs text-[#9C7B65]">Eier</p>
          </div>
        </div>

        {/* Kalender */}
        <ItemCalendar
          loans={allLoans}
          blockedDates={blockedDates}
          onToggleBlock={isOwner ? toggleBlock : undefined}
          onSelectRange={!isOwner && !loan && item.available ? handleSelectRange : undefined}
          isOwner={isOwner}
        />

        {/* Eier: admin-knapper */}
        {isOwner && item.available && pendingLoans.length === 0 && (
          <div className="flex gap-2">
            <div className="flex-1 bg-[#FFF0E6] rounded-2xl p-4 text-center">
              <p className="text-[#C4673A] text-sm font-medium">Dette er din gjenstand</p>
            </div>
            <Link href={`/items/access?item=${item.id}`}>
              <div className="bg-white border border-[#E8DDD0] rounded-2xl p-4 text-center shadow-sm">
                <p className="text-sm">🔒</p>
                <p className="text-xs text-[#9C7B65] mt-1">Tilgang</p>
              </div>
            </Link>
          </div>
        )}

        {/* Eier: innkommende forespørsler */}
        {isOwner && pendingLoans.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-[#2C1A0E]">Innkommende forespørsler</h2>
            {pendingLoans.map(l => (
              <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#E8DDD0] flex items-center justify-center text-sm font-bold text-[#6B4226] overflow-hidden">
                    {l.profiles?.avatar_url
                      ? <img src={l.profiles.avatar_url} className="w-full h-full object-cover" />
                      : (l.profiles?.name || l.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-medium text-[#2C1A0E] text-sm">
                    {l.profiles?.name || l.profiles?.email?.split('@')[0]}
                  </p>
                  <span className="ml-auto text-xs text-[#9C7B65]">
                    {formatDate(l.start_date)}{l.due_date ? ` → ${formatDate(l.due_date)}` : ''}
                  </span>
                </div>
                {l.message && (
                  <p className="text-sm text-[#6B4226] mb-3 bg-[#FAF7F2] rounded-xl p-3">{l.message}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => respondToLoan(l.id, true)} className="flex-1 bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium">✓ Godta</button>
                  <button onClick={() => respondToLoan(l.id, false)} className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2 text-sm font-medium">Avslå</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Låntaker: venter */}
        {!isOwner && loan?.status === 'pending' && (
          <div className="bg-[#FFF0E6] rounded-2xl p-4 text-center">
            <p className="text-[#C4673A] font-medium">⏳ Venter på svar fra {ownerName}</p>
          </div>
        )}

        {/* Låntaker: godtatt */}
        {!isOwner && loan?.status === 'active' && (
          <div className="bg-[#EEF4F0] rounded-2xl p-4">
            <p className="text-[#4A7C59] font-medium mb-1">✓ Du låner denne nå!</p>
            {loan.due_date && <p className="text-sm text-[#9C7B65]">Returner innen {formatDate(loan.due_date)}</p>}
            {item.price && item.vipps_number && (
              <a href={`https://qr.vipps.no/28/2/01/031/${item.vipps_number}?amount=${item.price}&message=Leie+${encodeURIComponent(item.name)}`}
                target="_blank"
                className="mt-3 flex items-center justify-center gap-2 bg-[#FF5B24] text-white rounded-xl py-2.5 text-sm font-medium w-full"
              >
                Betal via Vipps 💸
              </a>
            )}
          </div>
        )}

        {/* Låntaker: send forespørsel */}
        {!isOwner && !loan && item.available && (
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-[#2C1A0E]">Send låneforespørsel</h2>
            {sent ? (
              <div className="bg-[#EEF4F0] rounded-2xl p-4 text-center">
                <p className="text-[#4A7C59] font-medium">✓ Forespørsel sendt til {ownerName}!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Fra</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="bg-white border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Til</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="bg-white border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                    />
                  </div>
                </div>
                {startDate && dueDate && (
                  <div className="bg-[#EEF4F0] rounded-xl px-3 py-2 text-xs text-[#4A7C59]">
                    ✓ Valgt fra kalender: {formatDate(startDate)} → {formatDate(dueDate)}
                  </div>
                )}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
                />
                <button onClick={sendRequest} className="bg-[#C4673A] text-white rounded-xl py-3 font-medium">
                  Send forespørsel
                </button>
              </>
            )}
          </div>
        )}

        {/* Låntaker: ikke tilgjengelig */}
        {!isOwner && !loan && !item.available && (
          <div className="bg-[#FAF7F2] rounded-2xl p-4 text-center">
            <p className="text-[#9C7B65]">Denne er utlånt akkurat nå</p>
          </div>
        )}
      </div>
    </div>
  )
}