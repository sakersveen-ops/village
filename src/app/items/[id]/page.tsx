'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ItemPage() {
  const [item, setItem] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    supabase
      .from('items')
      .select('*, profiles(name, email)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setItem(data)
        setMessage(`Hei! Kan jeg låne "${data?.name}"? 😊`)
      })
  }, [id])

  useEffect(() => {
    if (!user || !item) return
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*, profiles(name, email)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('item_id', id)
      .order('created_at')
      .then(({ data }) => setMessages(data || []))
  }, [user, item])

  const sendMessage = async () => {
    if (!message.trim() || !user) return
    const supabase = createClient()
    await supabase.from('messages').insert({
      item_id: id,
      sender_id: user.id,
      receiver_id: item.owner_id,
      text: message,
    })
    setSent(true)
  }

  if (!item) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  const ownerName = item.profiles?.name || item.profiles?.email?.split('@')[0]
  const isOwner = user?.id === item.owner_id

  return (
    <div className="max-w-lg mx-auto pb-24">
      <button onClick={() => router.back()} className="absolute top-6 left-4 bg-white/80 rounded-full w-9 h-9 flex items-center justify-center text-[#2C1A0E] shadow-sm z-10">
        ←
      </button>

      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />
      ) : (
        <div className="w-full h-64 bg-[#E8DDD0] flex items-center justify-center text-6xl">
          {item.category === 'baby' ? '🍼' : item.category === 'kjole' ? '👗' : item.category === 'verktøy' ? '🔧' : item.category === 'bok' ? '📚' : '📦'}
        </div>
      )}

      <div className="px-4 pt-5">
        <h1 className="text-2xl font-bold text-[#2C1A0E]">{item.name}</h1>
        {item.description && <p className="text-[#6B4226] mt-2">{item.description}</p>}

        <div className="flex items-center gap-3 mt-4 bg-white rounded-2xl p-4">
          <div className="w-10 h-10 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold">
            {ownerName?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#2C1A0E]">{ownerName}</p>
            <p className="text-xs text-[#9C7B65]">Eier</p>
          </div>
        </div>

        {/* Meldinger */}
        {messages.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {messages.map(m => (
              <div key={m.id} className={`rounded-2xl px-4 py-3 max-w-[80%] ${m.sender_id === user?.id ? 'bg-[#C4673A] text-white self-end ml-auto' : 'bg-white text-[#2C1A0E]'}`}>
                <p className="text-sm">{m.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Send melding */}
        {!isOwner && (
          <div className="mt-4">
            {sent ? (
              <div className="bg-[#EEF4F0] rounded-2xl p-4 text-center">
                <p className="text-[#4A7C59] font-medium">✓ Melding sendt til {ownerName}!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
                />
                <button
                  onClick={sendMessage}
                  className="bg-[#C4673A] text-white rounded-xl py-3 font-medium"
                >
                  Send forespørsel
                </button>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-4 bg-[#FFF0E6] rounded-2xl p-4 text-center">
            <p className="text-[#C4673A] text-sm font-medium">Dette er din gjenstand</p>
          </div>
        )}
      </div>
    </div>
  )
}