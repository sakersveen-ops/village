'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myItems, setMyItems] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      // Mine gjenstander
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setMyItems(items || [])

      // Venner
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(name, email)')
        .eq('user_a', user.id)
      setFriends(friendships || [])

      setLoading(false)
    }
    load()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Header */}
      <div className="bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-6">
        <div className="flex justify-between items-start">
          <Link href="/" className="text-[#C4673A] text-sm">← Feed</Link>
          <button onClick={signOut} className="text-sm text-[#9C7B65]">Logg ut</button>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-2xl">
            {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2C1A0E]">{profile?.name || user?.email?.split('@')[0]}</h1>
            <p className="text-sm text-[#9C7B65]">{user?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-5">
          <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#2C1A0E]">{myItems.length}</p>
            <p className="text-xs text-[#9C7B65] mt-1">Gjenstander</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#2C1A0E]">{friends.length}</p>
            <p className="text-xs text-[#9C7B65] mt-1">Venner</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#2C1A0E]">{myItems.filter(i => i.available).length}</p>
            <p className="text-xs text-[#9C7B65] mt-1">Tilgjengelig</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Inviter venner */}
        <Link href="/invite">
          <div className="bg-[#C4673A] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Inviter venner</p>
              <p className="text-white/70 text-sm mt-0.5">Del lenken din og bygg kretsen</p>
            </div>
            <span className="text-white text-xl">→</span>
          </div>
        </Link>

        {/* Venner */}
        <div>
          <h2 className="text-base font-bold text-[#2C1A0E] mb-3">
            Venner {friends.length > 0 && <span className="text-[#9C7B65] font-normal">({friends.length})</span>}
          </h2>
          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">
              Ingen venner ennå – <Link href="/invite" className="text-[#C4673A]">inviter noen!</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {friends.map((f: any) => (
                <div key={f.user_b} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center text-[#6B4226] font-bold text-sm">
                    {(f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-[#2C1A0E] font-medium text-sm">
                    {f.profiles?.name || f.profiles?.email?.split('@')[0]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mine gjenstander */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-[#2C1A0E]">Mine gjenstander</h2>
            <Link href="/add" className="text-sm text-[#C4673A] font-medium">+ Legg ut</Link>
          </div>
          {myItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">
              Du har ikke lagt ut noe ennå
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myItems.map(item => (
                <div key={item.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <Link href={`/items/${item.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#E8DDD0] flex items-center justify-center text-xl flex-shrink-0">
                        {item.category === 'baby' ? '🍼' : item.category === 'kjole' ? '👗' : item.category === 'verktøy' ? '🔧' : item.category === 'bok' ? '📚' : '📦'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#2C1A0E] font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-[#9C7B65] mt-0.5 capitalize">{item.category}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${item.available ? 'bg-[#4A7C59]' : 'bg-[#9C7B65]'}`} />
                    <button
                      onClick={async () => {
                        if (!confirm('Slett denne gjenstanden?')) return
                        const supabase = createClient()
                        await supabase.from('items').delete().eq('id', item.id)
                        setMyItems(prev => prev.filter(i => i.id !== item.id))
                      }}
                      className="text-red-300 hover:text-red-500 text-lg px-1"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}