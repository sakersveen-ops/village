'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function FriendsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [mutualMap, setMutualMap] = useState<Record<string, any[]>>({})
  const [expandedMutual, setExpandedMutual] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, username, email, avatar_url)')
        .eq('user_a', user.id)
      setFriends(friendships || [])

      const { data: starredRows } = await supabase.from('starred_users').select('starred_id').eq('user_id', user.id)
      setStarred(new Set((starredRows || []).map((s: any) => s.starred_id)))

      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('*, profiles!friend_requests_from_id_fkey(id, name, username, email, avatar_url)')
        .eq('to_id', user.id).eq('status', 'pending')
      setPendingRequests(incoming || [])

      const { data: sent } = await supabase
        .from('friend_requests')
        .select('*, profiles!friend_requests_to_id_fkey(id, name, username, email, avatar_url)')
        .eq('from_id', user.id).eq('status', 'pending')
      setSentRequests(sent || [])

      setLoading(false)
    }
    load()
  }, [])

  const toggleStar = async (userId: string) => {
    const supabase = createClient()
    if (starred.has(userId)) {
      await supabase.from('starred_users').delete().eq('user_id', user.id).eq('starred_id', userId)
      setStarred(prev => { const n = new Set(prev); n.delete(userId); return n })
    } else {
      await supabase.from('starred_users').insert({ user_id: user.id, starred_id: userId })
      setStarred(prev => new Set([...prev, userId]))
    }
  }

  const respondToFriendRequest = async (requestId: string, fromId: string, accept: boolean) => {
    const supabase = createClient()
    await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', requestId)
    if (accept) {
      await supabase.from('friendships').insert([
        { user_a: user.id, user_b: fromId },
        { user_a: fromId, user_b: user.id },
      ])
      const accepted = pendingRequests.find(r => r.id === requestId)
      if (accepted) setFriends(prev => [...prev, { user_b: fromId, profiles: accepted.profiles }])
    }
    setPendingRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const cancelFriendRequest = async (requestId: string) => {
    const supabase = createClient()
    await supabase.from('friend_requests').delete().eq('id', requestId)
    setSentRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const searchUsers = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles').select('id, name, username, email, avatar_url')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`)
      .neq('id', user.id).limit(10)

    const friendIds = new Set(friends.map((f: any) => f.user_b))
    const sentIds = new Set(sentRequests.map((r: any) => r.to_id))
    const results = (data || []).map(p => ({
      ...p,
      isFriend: friendIds.has(p.id),
      requestSent: sentIds.has(p.id),
    }))
    setSearchResults(results)

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

  const sendFriendRequest = async (toId: string) => {
    const supabase = createClient()
    const { data: newReq } = await supabase
      .from('friend_requests')
      .insert({ from_id: user.id, to_id: toId })
      .select('*, profiles!friend_requests_to_id_fkey(id, name, username, email, avatar_url)')
      .single()
    await supabase.from('notifications').insert({
      user_id: toId, type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${profile?.name || user.email?.split('@')[0]} vil bli venner`,
    })
    setSearchResults(prev => prev.map(r => r.id === toId ? { ...r, requestSent: true } : r))
    if (newReq) setSentRequests(prev => [...prev, newReq])
  }

  const sortedFriends = [...friends].sort((a, b) => {
    const aStarred = starred.has(a.user_b) ? 0 : 1
    const bStarred = starred.has(b.user_b) ? 0 : 1
    return aStarred - bStarred
  })

  const displayName = (p: any) => p?.name || p?.username || p?.email?.split('@')[0]

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#2C1A0E]">Venner</h1>
          {pendingRequests.length > 0 && (
            <span className="bg-[#C4673A] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingRequests.length} ny
            </span>
          )}
        </div>

        {/* Søk */}
        <div className="relative mt-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
          <input
            value={searchQuery}
            onChange={e => searchUsers(e.target.value)}
            placeholder="Søk på navn, brukernavn eller e-post…"
            className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
          />
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">

        {/* Søkeresultater */}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map(result => (
              <div key={result.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${result.id}`}>
                    <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                      {result.avatar_url
                        ? <img src={result.avatar_url} className="w-full h-full object-cover" />
                        : displayName(result)?.[0]?.toUpperCase()}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#2C1A0E] text-sm">{displayName(result)}</p>
                    {result.username && <p className="text-xs text-[#9C7B65]">@{result.username}</p>}
                    {mutualMap[result.id]?.length > 0 && (
                      <button onClick={() => setExpandedMutual(expandedMutual === result.id ? null : result.id)} className="text-xs text-[#C4673A] mt-0.5">
                        {mutualMap[result.id].length} felles {mutualMap[result.id].length === 1 ? 'venn' : 'venner'} ↓
                      </button>
                    )}
                  </div>
                  {result.isFriend ? (
                    <span className="text-xs text-[#4A7C59] font-medium flex-shrink-0">✓ Venn</span>
                  ) : result.requestSent ? (
                    <span className="text-xs text-[#9C7B65] flex-shrink-0">Sendt</span>
                  ) : (
                    <button onClick={() => sendFriendRequest(result.id)} className="text-xs bg-[#C4673A] text-white rounded-full px-3 py-1.5 font-medium flex-shrink-0">
                      + Legg til
                    </button>
                  )}
                </div>
                {expandedMutual === result.id && mutualMap[result.id]?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E8DDD0] flex flex-wrap gap-2">
                    {mutualMap[result.id].map((m: any) => (
                      <div key={m.id} className="flex items-center gap-1.5 bg-[#FAF7F2] rounded-full px-2 py-1">
                        <div className="w-5 h-5 rounded-full bg-[#E8DDD0] flex items-center justify-center text-xs font-bold overflow-hidden">
                          {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : m.name?.[0]?.toUpperCase()}
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

        {/* Innkommende forespørsler */}
        {pendingRequests.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-[#2C1A0E] mb-2">Venneforespørsler</h2>
            <div className="flex flex-col gap-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                    {req.profiles?.avatar_url
                      ? <img src={req.profiles.avatar_url} className="w-full h-full object-cover" />
                      : displayName(req.profiles)?.[0]?.toUpperCase()}
                  </div>
                  <p className="flex-1 font-medium text-[#2C1A0E] text-sm">{displayName(req.profiles)}</p>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, true)} className="text-xs bg-[#4A7C59] text-white rounded-full px-3 py-1.5 font-medium">✓ Godta</button>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, false)} className="text-xs border border-[#E8DDD0] text-[#9C7B65] rounded-full px-3 py-1.5">Avslå</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sendte forespørsler */}
        {sentRequests.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-[#2C1A0E] mb-2">Venter på svar</h2>
            <div className="flex flex-col gap-2">
              {sentRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                    {req.profiles?.avatar_url
                      ? <img src={req.profiles.avatar_url} className="w-full h-full object-cover" />
                      : displayName(req.profiles)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#2C1A0E] text-sm">{displayName(req.profiles)}</p>
                    {req.profiles?.username && <p className="text-xs text-[#9C7B65]">@{req.profiles.username}</p>}
                  </div>
                  <button onClick={() => cancelFriendRequest(req.id)} className="text-xs border border-[#E8DDD0] text-[#9C7B65] rounded-full px-3 py-1.5">
                    Trekk tilbake
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Venneliste */}
        <div>
          <h2 className="text-sm font-bold text-[#2C1A0E] mb-2">
            Mine venner {friends.length > 0 && <span className="text-[#9C7B65] font-normal">({friends.length})</span>}
          </h2>
          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">
              Ingen venner ennå – <Link href="/invite" className="text-[#C4673A]">inviter noen!</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedFriends.map((f: any) => (
                <Link key={f.user_b} href={`/profile/${f.user_b}`}>
                  <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                      {f.profiles?.avatar_url
                        ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" />
                        : displayName(f.profiles)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1A0E] text-sm">{displayName(f.profiles)}</p>
                      {f.profiles?.username && <p className="text-xs text-[#9C7B65]">@{f.profiles.username}</p>}
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); toggleStar(f.user_b) }}
                      className="text-lg flex-shrink-0"
                    >
                      {starred.has(f.user_b) ? '❤️' : '🤍'}
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

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