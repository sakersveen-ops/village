'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'barn', emoji: '🧸' }, { id: 'kjole', emoji: '👗' },
  { id: 'verktøy', emoji: '🔧' }, { id: 'bok', emoji: '📚' }, { id: 'annet', emoji: '📦' },
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

      // Sjekk starred
      const { data: starredRow } = await supabase
        .from('starred_users').select('id').eq('user_id', user.id).eq('starred_id', userId).single()
      setIsStarred(!!starredRow)

      // Sjekk vennskap
      const { data: friendship } = await supabase
        .from('friendships').select('id').eq('user_a', user.id).eq('user_b', userId).single()
      const friend = !!friendship
      setIsFriend(friend)

      // Sjekk sendt forespørsel
      const { data: sentReq } = await supabase
        .from('friend_requests').select('id').eq('from_id', user.id).eq('to_id', userId).eq('status', 'pending').single()
      setFriendRequestSent(!!sentReq)

      // Sjekk venn av venn
      let isFoF = false
      if (!friend) {
        const { data: myFriends } = await supabase.from('friendships').select('user_b').eq('user_a', user.id)
        const myFriendIds = (myFriends || []).map((f: any) => f.user_b)
        const { data: theirFriends } = await supabase.from('friendships').select('user_b').eq('user_a', userId as string)
        const theirFriendIds = (theirFriends || []).map((f: any) => f.user_b)
        isFoF = myFriendIds.some(id => theirFriendIds.includes(id))
      }

      // Felles kretser
      const { data: myMemberships } = await supabase
        .from('community_members').select('community_id').eq('user_id', user.id).eq('status', 'active')
      const { data: theirMemberships } = await supabase
        .from('community_members').select('community_id, communities(name, avatar_emoji)').eq('user_id', userId as string).eq('status', 'active')
      const myComIds = new Set((myMemberships || []).map((m: any) => m.community_id))
      const shared = (theirMemberships || []).filter((m: any) => myComIds.has(m.community_id))
      setSharedCommunities(shared)
      const inSameCommunity = shared.length > 0

      // Sett tilgangsnivå
      let level: AccessLevel = 'stranger'
      if (friend) level = 'friend'
      else if (isFoF) level = 'friend_of_friend'
      else if (inSameCommunity) level = 'community'
      setAccessLevel(level)

      // Hent gjenstander basert på tilgangsnivå
      const { data: allItems } = await supabase
        .from('items')
        .select('*, item_access(*)')
        .eq('owner_id', userId as string)
        .eq('available', true)
        .order('created_at', { ascending: false })

      const { data: myFriendsForFilter } = await supabase.from('friendships').select('user_b').eq('user_a', user.id)
      const myFriendIds = (myFriendsForFilter || []).map((f: any) => f.user_b)

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
        user_id: userId,
        type: 'starred',
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

  const accessLabel = () => {
    if (accessLevel === 'friend') return { label: 'Venn', color: 'bg-[#EEF4F0] text-[#4A7C59]' }
    if (accessLevel === 'friend_of_friend') return { label: 'Venn av venn', color: 'bg-[#FFF0E6] text-[#C4673A]' }
    if (accessLevel === 'community') return { label: 'Felles krets', color: 'bg-[#F0F0FF] text-[#6B6B9C]' }
    return null
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>
  if (!profile) return <div className="p-8 text-center text-[#9C7B65]">Fant ikke brukeren</div>

  const badge = accessLabel()

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-6">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-4 block">← Tilbake</button>

        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" />
              : displayName(profile)?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#2C1A0E]">{displayName(profile)}</h1>
              {badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
              )}
            </div>
            {profile.username && <p className="text-sm text-[#9C7B65]">@{profile.username}</p>}
          </div>
          <button onClick={toggleStar} className="text-2xl flex-shrink-0 mt-1">
            {isStarred ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Felles kretser */}
        {sharedCommunities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sharedCommunities.map((m: any) => (
              <span key={m.community_id} className="bg-white border border-[#E8DDD0] rounded-full px-3 py-1 text-xs text-[#6B4226]">
                {m.communities?.avatar_emoji} {m.communities?.name}
              </span>
            ))}
          </div>
        )}

        {/* Handlinger */}
        <div className="flex gap-2 mt-4">
          {!isFriend && !friendRequestSent && (
            <button onClick={sendFriendRequest}
              className="flex-1 bg-[#C4673A] text-white rounded-xl py-2.5 text-sm font-medium">
              + Legg til som venn
            </button>
          )}
          {friendRequestSent && (
            <div className="flex-1 bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl py-2.5 text-sm text-[#9C7B65] text-center">
              Forespørsel sendt
            </div>
          )}
          {isFriend && (
            <div className="flex-1 bg-[#EEF4F0] rounded-xl py-2.5 text-sm text-[#4A7C59] font-medium text-center">
              ✓ Dere er venner
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#2C1A0E]">
            Tilgjengelige ting
            {items.length > 0 && <span className="text-[#9C7B65] font-normal text-sm ml-1">({items.length})</span>}
          </h2>
          {accessLevel === 'stranger' && (
            <span className="text-xs text-[#9C7B65]">Viser offentlige ting</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-[#9C7B65] text-sm">
            {accessLevel === 'stranger'
              ? 'Ingen offentlige ting tilgjengelig'
              : 'Ingen ting tilgjengelig akkurat nå'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
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