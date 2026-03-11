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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [mutualMap, setMutualMap] = useState<Record<string, any[]>>({})
  const [expandedMutual, setExpandedMutual] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setMyItems(items || [])

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', user.id)
      setFriends(friendships || [])

      setLoading(false)
    }
    load()
  }, [])

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    await supabase.storage.from('item-images').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('item-images').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    setProfile((p: any) => ({ ...p, avatar_url: data.publicUrl }))
    setAvatarUploading(false)
  }

  const searchUsers = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const supabase = createClient()

    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .neq('id', user.id)
      .limit(10)

    const friendIds = new Set(friends.map((f: any) => f.user_b))
    const results = (data || []).map(p => ({ ...p, isFriend: friendIds.has(p.id) }))
    setSearchResults(results)

    // Beregn felles venner
    const myFriendIds = friends.map((f: any) => f.user_b)
    const mutual: Record<string, any[]> = {}
    for (const result of results) {
      const { data: theirFriends } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', result.id)
      const common = (theirFriends || []).filter((f: any) => myFriendIds.includes(f.user_b))
      mutual[result.id] = common.map((f: any) => f.profiles)
    }
    setMutualMap(mutual)
  }

  const addFriend = async (targetId: string) => {
    const supabase = createClient()
    await supabase.from('friendships').insert([
      { user_a: user.id, user_b: targetId },
      { user_a: targetId, user_b: user.id },
    ])
    setSearchResults(prev => prev.map(r => r.id === targetId ? { ...r, isFriend: true } : r))
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.name || user?.email?.split('@')[0]
  const initials = displayName?.[0]?.toUpperCase()

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Header */}
      <div className="bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-4">
          <Link href="/" className="text-[#C4673A] text-sm">← Feed</Link>
          <button onClick={signOut} className="text-sm text-[#9C7B65]">Logg ut</button>
        </div>

        <div className="flex items-center gap-4">
          {/* Avatar med upload */}
          <label className="relative cursor-pointer flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-white border border-[#E8DDD0] rounded-full flex items-center justify-center text-xs">
              {avatarUploading ? '…' : '📷'}
            </div>
            <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
          </label>

          <div>
            <h1 className="text-xl font-bold text-[#2C1A0E]">{displayName}</h1>
            <p className="text-sm text-[#9C7B65]">{user?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-5">
          <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-[#2C1A0E]">{myItems.length}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5">Ting</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-[#2C1A0E]">{friends.length}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5">Venner</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-[#2C1A0E]">{myItems.filter(i => i.available).length}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5">Tilgjengelig</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Vennsøk */}
        <div>
          <h2 className="text-base font-bold text-[#2C1A0E] mb-3">Finn venner</h2>
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
            <input
              value={searchQuery}
              onChange={e => searchUsers(e.target.value)}
              placeholder="Søk på navn eller e-post…"
              className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {searchResults.map(result => (
                <div key={result.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                      {result.avatar_url
                        ? <img src={result.avatar_url} className="w-full h-full object-cover" />
                        : (result.name || result.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1A0E] text-sm">{result.name || result.email?.split('@')[0]}</p>
                      {mutualMap[result.id]?.length > 0 && (
                        <button
                          onClick={() => setExpandedMutual(expandedMutual === result.id ? null : result.id)}
                          className="text-xs text-[#C4673A] mt-0.5"
                        >
                          {mutualMap[result.id].length} felles {mutualMap[result.id].length === 1 ? 'venn' : 'venner'} ↓
                        </button>
                      )}
                    </div>
                    {result.isFriend ? (
                      <span className="text-xs text-[#4A7C59] font-medium">✓ Venn</span>
                    ) : (
                      <button
                        onClick={() => addFriend(result.id)}
                        className="text-xs bg-[#C4673A] text-white rounded-full px-3 py-1.5 font-medium flex-shrink-0"
                      >
                        + Legg til
                      </button>
                    )}
                  </div>

                  {/* Felles venner ekspandert */}
                  {expandedMutual === result.id && mutualMap[result.id]?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E8DDD0] flex flex-wrap gap-2">
                      {mutualMap[result.id].map((m: any) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-[#FAF7F2] rounded-full px-2 py-1">
                          <div className="w-5 h-5 rounded-full bg-[#E8DDD0] flex items-center justify-center text-xs font-bold text-[#6B4226] overflow-hidden">
                            {m.avatar_url
                              ? <img src={m.avatar_url} className="w-full h-full object-cover" />
                              : (m.name || m.email)?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-xs text-[#6B4226]">{m.name || m.email?.split('@')[0]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Venner */}
        <div>
          <h2 className="text-base font-bold text-[#2C1A0E] mb-3">
            Venner {friends.length > 0 && <span className="text-[#9C7B65] font-normal text-sm">({friends.length})</span>}
          </h2>
          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">
              Ingen venner ennå – <Link href="/invite" className="text-[#C4673A]">inviter noen!</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {friends.map((f: any) => (
                <div key={f.user_b} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                    {f.profiles?.avatar_url
                      ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" />
                      : (f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}
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
                <Link key={item.id} href={`/items/${item.id}`}>
                  <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
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
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.available ? 'bg-[#4A7C59]' : 'bg-[#9C7B65]'}`} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Inviter */}
        <Link href="/invite">
          <div className="bg-[#C4673A] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Inviter venner</p>
              <p className="text-white/70 text-sm mt-0.5">Del lenken din og bygg kretsen</p>
            </div>
            <span className="text-white text-xl">→</span>
          </div>
        </Link>

      </div>
    </div>
  )
}