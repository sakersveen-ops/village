'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InviteFriendsPage() {
  const [friends, setFriends] = useState<any[]>([])
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [community, setCommunity] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { id } = useParams()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: community } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single()
      setCommunity(community)

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', user.id)

      // Filtrer ut de som allerede er medlemmer
      const { data: members } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', id)
      const memberIds = new Set((members || []).map((m: any) => m.user_id))

      setFriends((friendships || []).filter((f: any) => !memberIds.has(f.user_b)))
      setLoading(false)
    }
    load()
  }, [id])

  const invite = async (friendId: string) => {
    const supabase = createClient()

    // Legg til som pending medlem
    await supabase.from('community_members').insert({
      community_id: id,
      user_id: friendId,
      role: 'member',
      status: 'pending',
    })

    // Send varsel
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'join_request',
      title: `Invitasjon til ${community?.name}`,
      body: `Du er invitert til å bli med i kretsen ${community?.name}`,
      metadata: JSON.stringify({ community_id: id }),
    })

    setInvited(prev => new Set([...prev, friendId]))
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <h1 className="text-xl font-bold text-[#2C1A0E]">Inviter venner</h1>
        <p className="text-xs text-[#9C7B65] mt-1">til {community?.name}</p>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-2">
        {friends.length === 0 ? (
          <div className="text-center py-16 text-[#9C7B65]">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-sm">Ingen venner å invitere ennå</p>
            <Link href="/profile" className="text-[#C4673A] text-sm mt-2 block">Legg til venner →</Link>
          </div>
        ) : (
          friends.map((f: any) => (
            <div key={f.user_b} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                {f.profiles?.avatar_url
                  ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" />
                  : (f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}
              </div>
              <p className="flex-1 font-medium text-[#2C1A0E] text-sm">
                {f.profiles?.name || f.profiles?.email?.split('@')[0]}
              </p>
              {invited.has(f.user_b) ? (
                <span className="text-xs text-[#4A7C59] font-medium">✓ Invitert</span>
              ) : (
                <button
                  onClick={() => invite(f.user_b)}
                  className="text-xs bg-[#C4673A] text-white rounded-full px-3 py-1.5 font-medium"
                >
                  Inviter
                </button>
              )}
            </div>
          ))
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Link href={`/community/${id}/share`}>
            <button className="w-full bg-white border border-[#E8DDD0] text-[#2C1A0E] rounded-xl py-3 text-sm font-medium">
              📦 Legg til gjenstander
            </button>
          </Link>
          <Link href={`/community/${id}`}>
            <button className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">
              Gå til kretsen →
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}