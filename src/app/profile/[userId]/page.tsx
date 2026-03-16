'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'all', label: 'Alle', emoji: '✨' },
  { id: 'barn', label: 'Barn', emoji: '🧸' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myItems, setMyItems] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [activeLoansCount, setActiveLoansCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [mutualMap, setMutualMap] = useState<Record<string, any[]>>({})
  const [expandedMutual, setExpandedMutual] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const router = useRouter()
  const [starred, setStarred] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)

      const { data: items } = await supabase
        .from('items').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      setMyItems(items || [])

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', user.id)
      setFriends(friendships || [])

      const { data: starredRows } = await supabase
        .from('starred_users').select('starred_id').eq('user_id', user.id)
      setStarred(new Set((starredRows || []).map((s: any) => s.starred_id)))

      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('*, profiles!friend_requests_from_id_fkey(id, name, email, avatar_url)')
        .eq('to_id', user.id).eq('status', 'pending')
      setPendingRequests(incoming || [])

      const { data: sent } = await supabase
        .from('friend_requests')
        .select('*, profiles!friend_requests_to_id_fkey(id, name, email, avatar_url)')
        .eq('from_id', user.id).eq('status', 'pending')
      setSentRequests(sent || [])

      // Teller aktive lån (begge retninger) til stats-boksen
      const { count: lendCount } = await supabase
        .from('loans').select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id).in('status', ['pending', 'active', 'change_proposed'])
      const { count: borrowCount } = await supabase
        .from('loans').select('id', { count: 'exact', head: true })
        .eq('borrower_id', user.id).in('status', ['pending', 'active', 'change_proposed'])
      setActiveLoansCount((lendCount ?? 0) + (borrowCount ?? 0))

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
      .from('profiles').select('id, name, email, avatar_url')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
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
      .select('*, profiles!friend_requests_to_id_fkey(id, name, email, avatar_url)')
      .single()
    await supabase.from('notifications').insert({
      user_id: toId, type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${profile?.name || user.email?.split('@')[0]} vil bli venner`,
    })
    setSearchResults(prev => prev.map(r => r.id === toId ? { ...r, requestSent: true } : r))
    if (newReq) setSentRequests(prev => [...prev, newReq])
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.name || user?.email?.split('@')[0]
  const lentOut = myItems.filter(i => !i.available).length

  const catEmoji = (cat: string) => {
    if (cat === 'barn') return '🧸'
    if (cat === 'kjole') return '👗'
    if (cat === 'verktøy') return '🔧'
    if (cat === 'bok') return '📚'
    return '📦'
  }

  const filteredItems = activeCategory === 'all'
    ? myItems
    : myItems.filter(i => i.category === activeCategory)

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Header */}
      <div style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DDD0' }} className="px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-4">
          <Link href="/" style={{ color: 'var(--terra)' }} className="text-sm">← Feed</Link>
          <div className="relative">
            <button onClick={() => setShowMenu(m => !m)}
              className="w-9 h-9 flex items-center justify-center rounded-full shadow-sm text-lg"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: '#6B4226' }}>
              ···
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-11 z-50 rounded-2xl shadow-lg overflow-hidden w-44"
                  style={{ background: '#fff', border: '1px solid #E8DDD0' }}>
                  <Link href="/settings" onClick={() => setShowMenu(false)}>
                    <div className="px-4 py-3 flex items-center gap-2 text-sm" style={{ color: 'var(--terra-dark)' }}>
                      ⚙️ Innstillinger
                    </div>
                  </Link>
                  <button onClick={signOut} className="w-full px-4 py-3 flex items-center gap-2 text-sm"
                    style={{ color: 'var(--terra)', borderTop: '1px solid #E8DDD0' }}>
                    🚪 Logg ut
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Avatar + navn */}
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer flex-shrink-0">
            <div className="flex items-center justify-center text-white font-bold text-2xl overflow-hidden"
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--terra)' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={displayName} />
                : displayName?.[0]?.toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center text-xs"
              style={{ background: '#fff', border: '1px solid #E8DDD0' }}>
              {avatarUploading ? '…' : '📷'}
            </div>
            <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
          </label>
          <div>
            <h1 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)' }}>{displayName}</h1>
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{user?.email}</p>
          </div>
        </div>

        {/* Stats — 3 bokser, tall + én linje, hele boksen er lenken */}
        <div className="flex gap-2 mt-5">
          <Link href="/items" className="flex-1">
            <div className="glass rounded-2xl p-3 text-center" style={{ borderRadius: 16, cursor: 'pointer' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{myItems.length}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                {lentOut > 0 ? `${lentOut} utlånt` : 'gjenstander'}
              </p>
            </div>
          </Link>
          <Link href="/schedule" className="flex-1">
            <div className="glass rounded-2xl p-3 text-center" style={{ borderRadius: 16, cursor: 'pointer' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{activeLoansCount}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>avtaler</p>
            </div>
          </Link>
          <Link href="/friends" className="flex-1">
            <div className="glass rounded-2xl p-3 text-center" style={{ borderRadius: 16, cursor: 'pointer' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{friends.length}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>venner</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Innkommende venneforespørsler */}
        {pendingRequests.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--terra-dark)' }}>
              Venneforespørsler <span style={{ color: 'var(--terra)' }}>({pendingRequests.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
                  <div className="flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}>
                    {req.profiles?.avatar_url
                      ? <img src={req.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                      : (req.profiles?.name || req.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <p className="flex-1 font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>
                    {req.profiles?.name || req.profiles?.email?.split('@')[0]}
                  </p>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, true)}
                    className="text-xs rounded-full px-3 py-1.5 font-medium"
                    style={{ background: 'var(--terra-green)', color: '#fff' }}>
                    ✓ Godta
                  </button>
                  <button onClick={() => respondToFriendRequest(req.id, req.from_id, false)}
                    className="text-xs rounded-full px-3 py-1.5"
                    style={{ border: '1px solid #E8DDD0', color: 'var(--terra-mid)' }}>
                    Avslå
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sendte venneforespørsler */}
        {sentRequests.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--terra-dark)' }}>
              Venter på svar <span className="font-normal text-sm" style={{ color: 'var(--terra-mid)' }}>({sentRequests.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {sentRequests.map(req => (
                <div key={req.id} className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
                  <div className="flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}>
                    {req.profiles?.avatar_url
                      ? <img src={req.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                      : (req.profiles?.name || req.profiles?.email)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>
                      {req.profiles?.name || req.profiles?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Forespørsel sendt</p>
                  </div>
                  <button onClick={() => cancelFriendRequest(req.id)}
                    className="text-xs rounded-full px-3 py-1.5"
                    style={{ border: '1px solid #E8DDD0', color: 'var(--terra-mid)' }}>
                    Trekk tilbake
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Venner */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold" style={{ color: 'var(--terra-dark)' }}>
              Venner {friends.length > 0 && (
                <span className="font-normal text-sm" style={{ color: 'var(--terra-mid)' }}>({friends.length})</span>
              )}
            </h2>
            <Link href="/invite"
              className="flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'var(--terra)', color: '#fff' }}>
              + Inviter
            </Link>
          </div>

          {/* Søk — øverst i venner-seksjonen */}
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
            <input
              value={searchQuery}
              onChange={e => searchUsers(e.target.value)}
              placeholder="Finn folk på navn eller e-post…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          {/* Søkeresultater */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {searchResults.map(result => (
                <div key={result.id} className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
                  <div className="flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}>
                    {result.avatar_url
                      ? <img src={result.avatar_url} className="w-full h-full object-cover" alt="" />
                      : (result.name || result.email)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                      {result.name || result.email?.split('@')[0]}
                    </p>
                    {mutualMap[result.id]?.length > 0 && (
                      <button onClick={() => setExpandedMutual(expandedMutual === result.id ? null : result.id)}
                        className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                        {mutualMap[result.id].length} felles {mutualMap[result.id].length === 1 ? 'venn' : 'venner'} ↓
                      </button>
                    )}
                    {expandedMutual === result.id && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mutualMap[result.id].map((m: any) => (
                          <span key={m.id} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#FAF7F2', color: '#6B4226' }}>
                            {m.name || m.email?.split('@')[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {result.isFriend ? (
                    <span className="text-xs px-3 py-1.5 rounded-full"
                      style={{ background: '#EEF4F0', color: 'var(--terra-green)' }}>Venn ✓</span>
                  ) : result.requestSent ? (
                    <span className="text-xs px-3 py-1.5 rounded-full"
                      style={{ background: '#FAF7F2', color: 'var(--terra-mid)' }}>Sendt</span>
                  ) : (
                    <button onClick={() => sendFriendRequest(result.id)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{ background: 'var(--terra)', color: '#fff' }}>
                      + Legg til
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Avatar-rad med eksisterende venner */}
          {friends.length === 0 && !searchQuery ? (
            <div className="rounded-2xl p-5 text-center text-sm" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
              Ingen venner ennå – <Link href="/invite" style={{ color: 'var(--terra)' }}>inviter noen!</Link>
            </div>
          ) : friends.length > 0 && (
            <Link href="/friends">
              <div className="rounded-2xl px-4 py-3 flex items-center gap-1 shadow-sm flex-wrap" style={{ background: '#fff' }}>
                {[...friends]
                  .sort((a, b) => (starred.has(a.user_b) ? -1 : 1))
                  .slice(0, 8)
                  .map((f: any) => (
                    <div key={f.user_b} className="relative">
                      <div className="flex items-center justify-center font-bold text-sm overflow-hidden"
                        style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', border: '2px solid #fff' }}>
                        {f.profiles?.avatar_url
                          ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                          : <span className="text-xs" style={{ color: '#6B4226' }}>{(f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}</span>}
                      </div>
                      {starred.has(f.user_b) && <span className="absolute -top-0.5 -right-0.5 text-xs">❤️</span>}
                    </div>
                  ))}
                {friends.length > 8 && (
                  <div className="flex items-center justify-center text-xs font-bold"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', border: '2px solid #fff', color: '#6B4226' }}>
                    +{friends.length - 8}
                  </div>
                )}
              </div>
            </Link>
          )}
        </div>

        {/* Mine gjenstander */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold" style={{ color: 'var(--terra-dark)' }}>Mine gjenstander</h2>
            <Link href="/add" className="text-sm font-medium" style={{ color: 'var(--terra)' }}>+ Legg ut</Link>
          </div>

          {myItems.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {CATEGORIES.filter(c => c.id === 'all' || myItems.some(i => i.category === c.id)).map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-colors"
                  style={activeCategory === cat.id
                    ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                    : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                  }>
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl p-5 text-center text-sm" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
              {myItems.length === 0 ? 'Du har ikke lagt ut noe ennå' : 'Ingen gjenstander i denne kategorien'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map(item => (
                <Link key={item.id} href={`/items/${item.id}`}>
                  <div className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
                    {item.image_url
                      ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                          style={{ width: 48, height: 48 }} alt={item.name} />
                      : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ width: 48, height: 48, background: '#E8DDD0' }}>
                          {catEmoji(item.category)}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>{item.name}</p>
                      <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--terra-mid)' }}>{item.category}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                      style={item.available
                        ? { background: '#EEF4F0', color: 'var(--terra-green)' }
                        : { background: '#FFF0E6', color: 'var(--terra)' }
                      }>
                      {item.available ? 'Ledig' : 'Utlånt'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sekundær inviter-lenke */}
        <Link href="/invite"
          className="flex items-center justify-center gap-1.5 text-sm w-full py-2.5 rounded-xl mb-4"
          style={{ color: 'var(--terra)', border: '1px solid rgba(196,103,58,0.25)', background: 'rgba(196,103,58,0.04)' }}>
          <span>👥</span>
          <span>Inviter venner til Village</span>
        </Link>

      </div>

      <div className="nav-spacer" />
    </div>
  )
}
