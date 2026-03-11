'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CloseFriendsPage() {
  const [user, setUser] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', user.id)
      setFriends(friendships || [])

      const { data: cf } = await supabase
        .from('close_friends')
        .select('friend_id')
        .eq('user_id', user.id)
      setCloseFriendIds(new Set((cf || []).map((c: any) => c.friend_id)))

      setLoading(false)
    }
    load()
  }, [])

  const toggle = async (friendId: string) => {
    const supabase = createClient()
    if (closeFriendIds.has(friendId)) {
      await supabase.from('close_friends').delete()
        .eq('user_id', user.id).eq('friend_id', friendId)
      setCloseFriendIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
    } else {
      await supabase.from('close_friends').insert({ user_id: user.id, friend_id: friendId })
      setCloseFriendIds(prev => new Set([...prev, friendId]))
    }
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24 px-4 pt-10">
      <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-4 block">← Tilbake</button>
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-1">Nære venner</h1>
      <p className="text-sm text-[#9C7B65] mb-6">Disse kan se ting du deler kun med nære venner</p>

      {friends.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center text-[#9C7B65] text-sm">
          Du har ingen venner ennå
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {friends.map((f: any) => {
            const isClose = closeFriendIds.has(f.user_b)
            return (
              <button
                key={f.user_b}
                onClick={() => toggle(f.user_b)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm transition-colors ${isClose ? 'bg-[#FFF0E6] border border-[#C4673A]' : 'bg-white border border-transparent'}`}
              >
                <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                  {f.profiles?.avatar_url
                    ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" />
                    : (f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}
                </div>
                <p className="flex-1 text-left font-medium text-[#2C1A0E] text-sm">
                  {f.profiles?.name || f.profiles?.email?.split('@')[0]}
                </p>
                <span className={`text-lg ${isClose ? 'opacity-100' : 'opacity-20'}`}>❤️</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}