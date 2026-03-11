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
  const [loanHistory, setLoanHistory] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [mutualMap, setMutualMap] = useState<Record<string, any[]>>({})
  const [expandedMutual, setExpandedMutual] = useState<string | null>(null)
  const [showLoanHistory, setShowLoanHistory] = useState(false)
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

      // Innkommende venneforespørsler
      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('*, profiles!friend_requests_from_id_fkey(id, name, email, avatar_url)')
        .eq('to_id', user.id)
        .eq('status', 'pending')
      setPendingRequests(incoming || [])

      // Lånehistorikk
      const { data: loans } = await supabase
        .from('loans')
        .select('*, items(name, image_url, category), profiles!loans_borrower_id_fkey(name, email, avatar_url)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setLoanHistory(loans || [])

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

    // Sjekk sendte forespørsler
    const { data: sentReqs } = await supabase
      .from('friend_requests')
      .select('to_id, status')
      .eq('from_id', user.id)
    const sentMap = new Map((sentReqs || []).map(r => [r.to_id, r.status]))

    const results = (data || []).map(p => ({
      ...p,
      isFriend: friendIds.has(p.id),
      requestSent: sentMap.get(p.id) === 'pending',
    }))
    setSearchResults(results)

    // Felles venner
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
    await supabase.from('friend_requests').insert({ from_id: user.id, to_id: toId })
    await supabase.from('notifications').insert({
      user_id: toId,
      type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${profile?.name || user.email?.split('@')[0]} vil bli venner`,
    })
    setSearchResults(prev => prev.map(r => r.id === toId ? { ...r, requestSent: true } : r))
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.name || user?.email?.split('@')[0]
  const lentOut = myItems.filter(i => !i.available).length
  const totalLoans = loanHistory.length

  const formatDate = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const loanStatusLabel = (status: string) => {
    if (status === 'active') return { label: 'Aktiv', color: 'text-[#C4673A] bg-[#FFF0E6]' }
    if (status === 'returned') return { label: 'Returnert', color: 'text-[#4A7C59] bg-[#EEF4F0]' }
    if (status === 'pending') return { label: 'Venter', color: 'text-[#9C7B65] bg-[#FAF7F2]' }
    return { label: status, color: 'text-[#9C7B65] bg-[#FAF7F2]' }
  }

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
          <label className="relative cursor-pointer flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" />
                : displayName?.[0]?.toUpperCase()}
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
        <div className="flex gap-2 mt-5">
          <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-[#2C1A0E]">{myItems.length}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5 leading-tight">Delte gjenstander</p>
            {lentOut > 0 && <p className="text-xs text-[#C4673A] mt-0.5">{lentOut} utlånt</p>}
          </div>
          <button
            onClick={() => setShowLoanHistory(true)}
            className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm active:bg-[#FFF0E6] transition-colors"
          >
            <p className="text-lg font-bold text-[#2C1A0E]">{totalLoans}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5 leading-tight">Antall utlån</p>
            <p className="text-xs text-[#C4673A] mt-0.5">Se logg →</p>
          </button>
          <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-[#2C1A0E]">{friends.length}</p>
            <p className="text-xs text-[#9C7B65] mt-0.5 leading-tight">Venner</p>
          </div>
        </div>
      </div>

      {/* Lånelogg modal */}
      {showLoanHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 pt-5 pb-3 border-b border-[#E8DDD0] flex justify-between items-center">
              <h2 className="font-bold text-[#2C1A0E]">Lånelogg</h2>
              <button onClick={() => setShowLoanHistory(false)} className="text-[#9C7B65] text-lg">✕</button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {loanHistory.length === 0 ? (
                <p className="text-center py-8 text-[#9C7B65] text-sm">Ingen utlån ennå</p>
              ) : (
                loanHistory.map(loan => {
                  const { label, color } = loanStatusLabel(loan.status)
                  return (
                    <div key={loan.id} className="bg-[#FAF7F2] rounded-2xl px-4 py-3 flex items-center gap-3">
                      {loan.items?.image_url ? (
                        <img src={loan.items.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#E8DDD0] flex items-center justify-center text-xl flex-shrink-0">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2C1A0E] text-sm truncate">{loan.items?.name}</p>
                        <p className="text-xs text-[#9C7B65] mt-0.5">
                          {loan.profiles?.name || loan.profiles?.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-[#9C7B65]">
                          {formatDate(loan.created_at)}
                          {loan.due_date ? ` → ${formatDate(loan.due_date)}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${color}`}>{label}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Innkommende venneforespørsler */}
        {pendingRequests.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-[#2C1A0E] mb-3">
              Venneforespørsler <span className="text-[#C4673A]">({pendingRequests.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                    {req.profiles?.avatar_url
                      ? <img src={req.profiles.avatar_url} className="w-full h-full object-cover" />
                      : (req.profiles?.name || req.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <p className="flex-1 font-medium text-[#2C1A0E] text-sm">
                    {req.profiles?.name || req.profiles?.email?.split('@')[0]}
                  </p>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, true)} className="text-xs bg-[#4A7C59] text-white rounded-full px-3 py-1.5 font-medium">✓ Godta</button>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, false)} className="text-xs border border-[#E8DDD0] text-[#9C7B65] rounded-full px-3 py-1.5">Avslå</button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                      <span className="text-xs text-[#4A7C59] font-medium flex-shrink-0">✓ Venn</span>
                    ) : result.requestSent ? (
                      <span className="text-xs text-[#9C7B65] flex-shrink-0">Forespørsel sendt</span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(result.id)}
                        className="text-xs bg-[#C4673A] text-white rounded-full px-3 py-1.5 font-medium flex-shrink-0"
                      >
                        + Legg til
                      </button>
                    )}
                  </div>

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
            <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">Du har ikke lagt ut noe ennå</div>
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
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.available ? 'bg-[#4A7C59]' : 'bg-[#C4673A]'}`} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Inviter */}
        <Link href="/invite">
          <div className="bg-[#C4673A] rounded-2xl p-4 flex items-center justify-between mb-4">
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