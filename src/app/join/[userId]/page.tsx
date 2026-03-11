'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function JoinPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading')
  const [friendName, setFriendName] = useState('')
  const router = useRouter()
  const { userId } = useParams()

  useEffect(() => {
    const connect = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // Lagre invitasjons-URL og send til login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname)
        router.push('/login')
        return
      }

      if (user.id === userId) {
        setStatus('error')
        return
      }

      // Hent vennens navn
      const { data: friend } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single()
      
      setFriendName(friend?.name || friend?.email?.split('@')[0] || 'Vennen din')

      // Sjekk om vennskap allerede eksisterer
      const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_a.eq.${user.id},user_b.eq.${userId}),and(user_a.eq.${userId},user_b.eq.${user.id})`)
        .single()

      if (existing) {
        setStatus('already')
        return
      }

      // Opprett vennskap begge veier
      const { error } = await supabase.from('friendships').insert([
        { user_a: user.id, user_b: userId },
        { user_a: userId, user_b: user.id },
      ])

      setStatus(error ? 'error' : 'success')
    }

    connect()
  }, [userId])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {status === 'loading' && (
        <div className="text-[#9C7B65]">Kobler til…</div>
      )}
      {status === 'success' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Dere er nå venner!</h1>
          <p className="text-[#9C7B65] mb-6">Du og {friendName} kan nå se hverandres ting i Village.</p>
          <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">
            Gå til feeden
          </button>
        </div>
      )}
      {status === 'already' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Dere er allerede venner!</h1>
          <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium mt-4">
            Gå til feeden
          </button>
        </div>
      )}
      {status === 'error' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">😬</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Noe gikk galt</h1>
          <p className="text-[#9C7B65] mb-4">Du kan ikke legge deg selv til som venn.</p>
          <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">
            Tilbake
          </button>
        </div>
      )}
    </div>
  )
}