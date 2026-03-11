'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function JoinCommunityPage() {
  const [community, setCommunity] = useState<any>(null)
  const [status, setStatus] = useState<'loading' | 'preview' | 'joining' | 'success' | 'already' | 'error'>('loading')
  const router = useRouter()
  const { invite_code } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname)
        router.push('/login')
        return
      }

      const { data: community } = await supabase
        .from('communities')
        .select('*, community_members(count)')
        .eq('invite_code', invite_code)
        .single()

      if (!community) { setStatus('error'); return }
      setCommunity(community)

      // Sjekk om allerede medlem
      const { data: existing } = await supabase
        .from('community_members')
        .select('id, status')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .single()

      if (existing) { setStatus('already'); return }
      setStatus('preview')
    }
    load()
  }, [invite_code])

  const join = async () => {
    setStatus('joining')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user!.id,
      role: 'member',
      status: 'pending',
    })

    // Varsle admins
    const { data: admins } = await supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', community.id)
      .eq('role', 'admin')
      .eq('status', 'active')

    if (admins) {
      await supabase.from('notifications').insert(
        admins.map(a => ({
          user_id: a.user_id,
          type: 'join_request',
          title: 'Ny forespørsel om å bli med',
          body: `${user!.email?.split('@')[0]} vil bli med i ${community.name}`,
        }))
      )
    }

    setStatus('success')
  }

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen text-[#9C7B65]">Laster…</div>

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {status === 'error' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">😬</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Ugyldig lenke</h1>
          <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium mt-4">Tilbake</button>
        </div>
      )}

      {(status === 'preview' || status === 'joining') && community && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-3">{community.avatar_emoji}</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-1">{community.name}</h1>
          {community.description && <p className="text-[#9C7B65] text-sm mb-4">{community.description}</p>}
          <p className="text-xs text-[#9C7B65] mb-6">Du sender en forespørsel – en admin godkjenner deg.</p>
          <button
            onClick={join}
            disabled={status === 'joining'}
            className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {status === 'joining' ? 'Sender…' : 'Be om å bli med'}
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Forespørsel sendt!</h1>
          <p className="text-[#9C7B65] text-sm mb-6">En admin i {community.name} godkjenner deg snart.</p>
          <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">Gå til feeden</button>
        </div>
      )}

      {status === 'already' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Du er allerede med!</h1>
          <button onClick={() => router.push(`/community/${community?.id}`)} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium mt-4">Gå til community</button>
        </div>
      )}
    </div>
  )
}