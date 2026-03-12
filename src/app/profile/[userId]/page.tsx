'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'barn', label: 'Barn', emoji: '🧸' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

type AccessLevel = 'self' | 'friend' | 'friend_of_friend' | 'community' | 'stranger'

export default function UserProfilePage() {
  const [viewer, setViewer] = useState<any>(null)
  const [viewerProfile, setViewerProfile] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('stranger')
  const [isStarred, setIsStarred] = useState(false)
  const [friendRequestSent, setFriendRequestSent] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [sharedCommunities, setSharedCommunities] = useState<any[]>([])
  const [publicCommunities, setPublicCommunities] = useState<any[]>([])
  const [mutualFriends, setMutualFriends] = useState<any[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategory, setItemCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { userId } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setViewer(user)
      if (userId === user.id) { router.push('/profile'); return }

      const { data: vp } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setViewerProfile(vp)

      const { data: targetProfile } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(targetProfile)

      const { data: starredRow } = await supabase
        .from('starred_users').select('id').eq('user_id', user.id).eq('starred_id', userId).maybeSingle()
      setIsStarred(!!starredRow)

      const { data: friendship } = await supabase
        .from('friendships').select('id').eq('user_a', user.id).eq('user_b', userId).maybeSingle()
      const friend = !!friendship
      setIsFriend(friend)

      const { data: sentReq } = await supabase
        .from('friend_requests').select('id').eq('from_id', user.id).eq('to_id', userId).eq('status', 'pending').maybeSingle()
      setFriendRequestSent(!!sentReq)

      let isFoF = false
      const { data: myFriends } = await supabase.from('friendships').select('user_b').eq('user_a', user.id)
      const myFriendIds = (myFriends || []).map((f: any) => f.user_b)
      const { data: theirFriends } = await supabase.from('friendships').select('user_b').eq('user_a', userId as string)
      const theirFriendIds = (theirFriends || []).map((f: any) => f.user_b)
      if (!friend) isFoF = myFriendIds.some(id => theirFriendIds.includes(id))

      const { data: myMemberships } = await supabase
        .from('community_members').select('community_id').eq('user_id', user.id).eq('status', 'active')
      const { data: theirMemberships } = await supabase
        .from('community_members')
        .select('community_id, communities(id, name, avatar_emoji, is_public)')
        .eq('user_id', userId as string).eq('status', 'active')
      const myComIds = new Set((myMemberships || []).map((m: any) => m.community_id))
      const shared = (theirMemberships || []).filter((m: any) => myComIds.has(m.community_id))
      setSharedCommunities(shared)

      // Offentlige kretser de er med i (ikke felles)
      const publicComs = (theirMemberships || []).filter((m: any) =>
        m.communities?.is_public && !myComIds.has(m.community_id)
      )
      setPublicCommunities(publicComs)

      // Felles venner
      const { data: myFriendsFull } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, username, avatar_url)')
        .eq('user_a', user.id)
      const theirFriendSet = new Set(theirFriendIds)
      const mutual = (myFriendsFull || []).filter((f: any) => theirFriendSet.has(f.user_b))
      setMutualFriends(mutual.map((f: any) => f.profiles))

      let level: AccessLevel = 'stranger'
      if (friend) level = 'friend'
      else if (isFoF) level = 'friend_of_friend'
      else if (shared.length > 0) level = 'community'
      setAccessLevel(level)

      const { data: allItems } = await supabase
        .from('items').select('*, item_access(*)')
        .eq('owner_id', userId as string).eq('available', true)
        .order('created_at', { ascending: false })

      const visible = (allItems || []).filter((item: any) => {
        const access: any[] = item.item_access || []
        if (access.length === 0) return true
        return access.some((rule: any) => {
          if (rule.access_type === 'public') return true
          if (rule.access_type === 'friends' && friend) return true
          if (rule.access_type === 'friends_of_friends' && (friend || isFoF)) return true
          if (rule.access_type === 'community' && myComIds.has(rule.community_id)) return true
          return false
        })
      })
      setItems(visible)
      setLoading(false)
    }
    load()
  }, [userId])

  const toggleStar = async () => {
    const supabase = createClient()
    if (isStarred) {
      await supabase.from('starred_users').delete().eq('user_id', viewer.id).eq('starred_id', userId)
      setIsStarred(false)
    } else {
      await supabase.from('starred_users').insert({ user_id: viewer.id, starred_id: userId })
      setIsStarred(true)
      await supabase.from('notifications').insert({
        user_id: userId, type: 'starred',
        title: '❤️ Noen følger deg',
        body: `${viewerProfile?.name || viewer.email?.split('@')[0]} vil få varsel når du legger ut noe`,
      })
    }
  }

  const sendFriendRequest = async () => {
    const supabase = createClient()
    await supabase.from('friend_requests').insert({ from_id: viewer.id, to_id: userId })
    await supabase.from('notifications').insert({
      user_id: userId, type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${viewerProfile?.name || viewer.email?.split('@')[0]} vil bli venner`,
    })
    setFriendRequestSent(true)
  }

  const displayName = (p: any) => p?.name || p?.username || p?.email?.split('@')[0]
  const catEmoji = (cat: string) => CATEGORIES.find(c => c.id === cat)?.emoji || '📦'

  const availableCategories = CATEGORIES.filter(c => items.some(i => i.category === c.id))

  const filteredItems = items.filter(item => {
    const matchSearch = itemSearch.trim().length < 2 ||
      item.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(itemSearch.toLowerCase())
    const matchCat = !itemCategory || item.category === itemCategory
    return matchSearch && matchCat
  })

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>
  if (!profile) return <div className="p-8 text-center text-[#9C7B65]">Fant ikke brukeren</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Header */}
      <div className="bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-6">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-4 block">← Tilbake</button>

        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" />
              : displayName(profile)?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#2C1A0E]">{displayName(profile)}</h1>
            {profile.username && <p className="text-sm text-[#9C7B65]">@{profile.username}</p>}
            <p className="text-xs text-[#9C7B65] mt-1">
              {accessLevel === 'friend' ? '👥 Dere er venner'
                : accessLevel === 'friend_of_friend' ? '👥 Venn av venn'
                : accessLevel === 'community' ? '🏘️ Felles krets'
                : '👤 Ukjent'}
            </p>
          </div>
          <button onClick={toggleStar} className="text-2xl flex-shrink-0 mt-1">
            {isStarred ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Felles venner */}
        <div className="mt-4">
          {mutualFriends.length > 0 ? (
            <div>
              <p className="text-xs text-[#9C7B65] mb-2">
                {mutualFriends.length} felles {mutualFriends.length === 1 ? 'venn' : 'venner'}
              </p>
              <div className="flex gap-1 flex-wrap">
                {mutualFriends.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-white border border-[#E8DDD0] rounded-full px-2 py-1">
                    <div className="w-5 h-5 rounded-full bg-[#E8DDD0] flex items-center justify-center text-xs overflow-hidden">
                      {m.avatar_url
                        ? <img src={m.avatar_url} className="w-full h-full object-cover" />
                        : displayName(m)?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-[#6B4226]">{displayName(m)}</span>
                  </div>
                ))}
                {mutualFriends.length > 5 && (
                  <span className="text-xs text-[#9C7B65] self-center">+{mutualFriends.length - 5} til</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#9C7B65]">Ingen felles venner</p>
          )}
        </div>

        {/* Felles kretser */}
        {sharedCommunities.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-[#9C7B65] mb-1.5">Felles kretser</p>
            <div className="flex flex-wrap gap-2">
              {sharedCommunities.map((m: any) => (
                <Link key={m.community_id} href={`/community/${m.community_id}`}>
                  <span className="bg-white border border-[#E8DDD0] rounded-full px-3 py-1.5 text-xs text-[#6B4226] shadow-sm">
                    {m.communities?.avatar_emoji} {m.communities?.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Offentlige kretser */}
        {publicCommunities.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-[#9C7B65] mb-1.5">Kretser</p>
            <div className="flex flex-wrap gap-2">
              {publicCommunities.map((m: any) => (
                <Link key={m.community_id} href={`/community/${m.community_id}`}>
                  <span className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-full px-3 py-1.5 text-xs text-[#6B4226]">
                    {m.communities?.avatar_emoji} {m.communities?.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Legg til som venn */}
        {!isFriend && !friendRequestSent && (
          <button onClick={sendFriendRequest}
            className="mt-4 w-full bg-[#C4673A] text-white rounded-xl py-2.5 text-sm font-medium">
            + Legg til som venn
          </button>
        )}
        {friendRequestSent && (
          <div className="mt-4 w-full bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl py-2.5 text-sm text-[#9C7B65] text-center">
            Forespørsel sendt
          </div>
        )}
      </div>

      {/* Tilgjengelige ting */}
      <div className="px-4 pt-5 flex flex-col gap-3 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#2C1A0E]">
            Tilgjengelige ting
            {filteredItems.length > 0 && <span className="text-[#9C7B65] font-normal text-sm ml-1">({filteredItems.length})</span>}
          </h2>
          {accessLevel === 'stranger' && (
            <span className="text-xs text-[#9C7B65]">Offentlige ting</span>
          )}
        </div>

        {/* Søk */}
        {items.length > 3 && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
            <input
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              placeholder="Søk i tingene…"
              className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
            />
          </div>
        )}

        {/* Kategorifilter */}
        {availableCategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setItemCategory('')}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors flex-shrink-0 ${
                !itemCategory ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              Alle
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setItemCategory(itemCategory === cat.id ? '' : cat.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors flex-shrink-0 ${
                  itemCategory === cat.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-[#9C7B65] text-sm">
            {items.length === 0
              ? accessLevel === 'stranger' ? 'Ingen offentlige ting tilgjengelig' : 'Ingen ting tilgjengelig akkurat nå'
              : 'Ingen treff på søket'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map(item => (
              <Link key={item.id} href={`/items/${item.id}`}>
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  {item.image_url
                    ? <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-xl bg-[#E8DDD0] flex items-center justify-center text-xl flex-shrink-0">{catEmoji(item.category)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#2C1A0E] text-sm truncate">{item.name}</p>
                    <p className="text-xs text-[#9C7B65] mt-0.5">{catEmoji(item.category)} {item.category}</p>
                  </div>
                  {item.price && (
                    <span className="text-xs text-[#C4673A] font-medium flex-shrink-0">{item.price} kr/dag</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}