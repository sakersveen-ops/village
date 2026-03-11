'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ItemPage() {
  const [item, setItem] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loan, setLoan] = useState<any>(null)
  const [pendingLoans, setPendingLoans] = useState<any[]>([])
  const [message, setMessage] = useState('')
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
        .select('*, profiles(name, email)')
        .eq('id', id)
        .single()
      setItem(item)
      setMessage(`Hei! Kan jeg låne "${item?.name}"? 😊`)

      // Sjekk om bruker allerede har en aktiv forespørsel
      const { data: existingLoan } = await supabase
        .from('loans')
        .select('*')
        .eq('item_id', id)
        .eq('borrower_id', user.id)
        .in('status', ['pending', 'active'])
        .single()
      setLoan(existingLoan)

      // Hvis eier: hent innkommende forespørsler
      if (item?.owner_id === user.id) {
        const { data: pending } = await supabase
          .from('loans')
          .select('*, profiles!loans_borrower_id_fkey(name, email)')
          .eq('item_id', id)
          .eq('status', 'pending')
        setPendingLoans(pending || [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  const sendRequest = async () => {
    if (!message.trim()) return
    const supabase = createClient()

    const { data: newLoan } = await supabase.from('loans').insert({
      item_id: id,
      borrower_id: user.id,
      owner_id: item.owner_id,
      message,
      due_date: dueDate || null,
      status: 'pending',
    }).select().single()

    // Varsel til eier
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
    }

    // Finn borrower_id for dette lånet
    const targetLoan = pendingLoans.find(l => l.id === loanId)

    // Varsel til låntaker
    await supabase.from('notifications').insert({
      user_id: targetLoan?.borrower_id,
      type: accept ? 'loan_accepted' : 'loan_declined',
      title: accept ? '✓ Forespørsel godtatt!' : 'Forespørsel avslått',
      body: accept
        ? `${user.email?.split('@')[0]} godtok lånet av "${item.name}"`
        : `${user.email?.split('@')[0]} avslo forespørselen om "${item.name}"`,
      loan_id: loanId,
    })

    setPendingLoans(prev => prev.filter(l => l.id !== loanId))
    if (accept) setItem((i: any) => ({ ...i, available: false }))
  }

  const markReturned = async () => {
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('item_id', id).eq('status', 'active')
    await supabase.from('items').update({ available: true }).eq('id', id)
    setItem((i: any) => ({ ...i, available: true }))
    setLoan(null)
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>
  if (!item) return <div className="p-8 text-center text-[#9C7B65]">Fant ikke gjenstanden</div>

  const ownerName = item.profiles?.name || item.profiles?.email?.split('@')[0]
  const isOwner = user?.id === item.owner_id

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Bilde */}
      <div className="relative">
        <button onClick={() => router.back()} className="absolute top-6 left-4 bg-white/80 rounded-full w-9 h-9 flex items-center justify-center text-[#2C1A0E] shadow-sm z-10">←</button>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-[#E8DDD0] flex items-center justify-center text-6xl">
            {item.category === 'baby' ? '🍼' : item.category === 'kjole' ? '👗' : item.category === 'verktøy' ? '🔧' : item.category === 'bok' ? '📚' : '📦'}
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

        {item.description && <p className="text-[#6B4226]">{item.description}</p>}

        {/* Eier */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold">
            {ownerName?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#2C1A0E]">{ownerName}</p>
            <p className="text-xs text-[#9C7B65]">Eier</p>
          </div>
        </div>

        {/* EIER: innkommende forespørsler */}
        {isOwner && pendingLoans.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-[#2C1A0E]">Innkommende forespørsler</h2>
            {pendingLoans.map(l => (
              <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#E8DDD0] flex items-center justify-center text-sm font-bold text-[#6B4226]">
                    {(l.profiles?.name || l.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-medium text-[#2C1A0E] text-sm">
                    {l.profiles?.name || l.profiles?.email?.split('@')[0]}
                  </p>
                  {l.due_date && (
                    <span className="ml-auto text-xs text-[#9C7B65]">til {new Date(l.due_date).toLocaleDateString('no-NO')}</span>
                  )}
                </div>
                {l.message && <p className="text-sm text-[#6B4226] mb-3 bg-[#FAF7F2] rounded-xl p-3">{l.message}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToLoan(l.id, true)}
                    className="flex-1 bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium"
                  >
                    ✓ Godta
                  </button>
                  <button
                    onClick={() => respondToLoan(l.id, false)}
                    className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2 text-sm font-medium"
                  >
                    Avslå
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EIER: marker som returnert */}
        {isOwner && !item.available && (
          <button
            onClick={markReturned}
            className="w-full bg-[#4A7C59] text-white rounded-xl py-3 font-medium"
          >
            ✓ Marker som returnert
          </button>
        )}

        {/* EIER: ingen forespørsler */}
        {isOwner && item.available && pendingLoans.length === 0 && (
          <div className="bg-[#FFF0E6] rounded-2xl p-4 text-center">
            <p className="text-[#C4673A] text-sm font-medium">Dette er din gjenstand</p>
          </div>
        )}

        {/* LÅNTAKER: allerede forespurt */}
        {!isOwner && loan?.status === 'pending' && (
          <div className="bg-[#FFF0E6] rounded-2xl p-4 text-center">
            <p className="text-[#C4673A] font-medium">⏳ Venter på svar fra {ownerName}</p>
          </div>
        )}

        {/* LÅNTAKER: godtatt */}
        {!isOwner && loan?.status === 'active' && (
          <div className="bg-[#EEF4F0] rounded-2xl p-4">
            <p className="text-[#4A7C59] font-medium mb-1">✓ Du låner denne nå!</p>
            {loan.due_date && <p className="text-sm text-[#9C7B65]">Returner innen {new Date(loan.due_date).toLocaleDateString('no-NO')}</p>}
            {item.price && item.vipps_number && (
              
                href={`https://qr.vipps.no/28/2/01/031/${item.vipps_number}?amount=${item.price}&message=Leie+${encodeURIComponent(item.name)}`}
                target="_blank"
                className="mt-3 flex items-center justify-center gap-2 bg-[#FF5B24] text-white rounded-xl py-2.5 text-sm font-medium w-full"
              >
                Betal via Vipps 💸
              </a>
            )}
          </div>
        )}

        {/* LÅNTAKER: send forespørsel */}
        {!isOwner && !loan && item.available && (
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-[#2C1A0E]">Send låneforespørsel</h2>
            {sent ? (
              <div className="bg-[#EEF4F0] rounded-2xl p-4 text-center">
                <p className="text-[#4A7C59] font-medium">✓ Forespørsel sendt til {ownerName}!</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Returner innen (valgfritt)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
                  />
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
                />
                <button
                  onClick={sendRequest}
                  className="bg-[#C4673A] text-white rounded-xl py-3 font-medium"
                >
                  Send forespørsel
                </button>
              </>
            )}
          </div>
        )}

        {/* LÅNTAKER: ikke tilgjengelig */}
        {!isOwner && !loan && !item.available && (
          <div className="bg-[#FAF7F2] rounded-2xl p-4 text-center">
            <p className="text-[#9C7B65]">Denne er utlånt akkurat nå</p>
          </div>
        )}
      </div>
    </div>
  )
}