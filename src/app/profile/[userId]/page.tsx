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

type AccessLevel = 'friend' | 'friend_of_friend' | 'community' | 'stranger'

export default function UserProfilePage() {
  const [viewer, setViewer] = useState<any>(null)
  const [viewerProfile, setViewerProfile] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
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

      // Egen profil → redirect
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

      // Gjenstander — kun hvis venn
      if (friend) {
        const { data: allItems } = await supabase
          .from('items').select('*, item_access(*)')
          .eq('owner_id', userId as string)
          .order('created_at', { ascending: false })

        const visible = (allItems || []).filter((item: any) => {
          const access: any[] = item.item_access || []
          if (access.length === 0) return true
          return access.some((rule: any) => {
            if (rule.access_type === 'public') return true
            if (rule.access_type === 'friends') return true
            if (rule.access_type === 'friends_of_friends') return true
            if (rule.access_type === 'community' && myComIds.has(rule.community_id)) return true
            return false
          })
        })
        setItems(visible)

        // Venneliste til denne brukeren (for venner-seksjonen)
        const { data: theirFriendsFull } = await supabase
          .from('friendships')
          .select('user_b, profiles!friendships_user_b_fkey(id, name, username, avatar_url)')
          .eq('user_a', userId as string)
          .limit(12)
        setFriends((theirFriendsFull || []).map((f: any) => f.profiles))
      }

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

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  if (!profile) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Fant ikke brukeren</div>

  // ── Fremmed-visning ──
  // Kun profilbilde, navn, brukernavn og legg-til-venn-knapp
  if (!isFriend) {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DDD0' }} className="px-4 pt-6 pb-8">

          {/* Avatar + navn */}
          <div className="flex flex-col items-center text-center pt-4">
            <div className="flex items-center justify-center text-white font-bold text-3xl overflow-hidden mb-4"
              style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--terra)' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={displayName(profile)} />
                : displayName(profile)?.[0]?.toUpperCase()}
            </div>

            <h1 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)' }}>
              {displayName(profile)}
            </h1>
            {profile.username && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--terra-mid)' }}>@{profile.username}</p>
            )}

            {/* Relasjons-hint */}
            <p className="text-xs mt-2" style={{ color: 'var(--terra-mid)' }}>
              {accessLevel === 'friend_of_friend'
                ? `${mutualFriends.length > 0 ? mutualFriends.length : ''} felles ${mutualFriends.length === 1 ? 'venn' : 'venner'}`
                : accessLevel === 'community'
                ? '🏘️ Dere er i samme krets'
                : '👤 Ikke tilkoblet'}
            </p>

            {/* Følg-knapp */}
            <button onClick={toggleStar} className="mt-3 text-xl" aria-label={isStarred ? 'Slutt å følge' : 'Følg'}>
              {isStarred ? '❤️' : '🤍'}
            </button>
          </div>

          {/* Legg til som venn */}
          <div className="mt-6">
            {!friendRequestSent ? (
              <button onClick={sendFriendRequest} className="btn-primary w-full"
                style={{ borderRadius: 12, padding: '12px 0', fontSize: 15 }}>
                + Legg til som venn
              </button>
            ) : (
              <div className="w-full rounded-xl py-3 text-sm text-center"
                style={{ background: '#FAF7F2', border: '1px solid #E8DDD0', color: 'var(--terra-mid)' }}>
                Forespørsel sendt
              </div>
            )}
          </div>
        </div>
        <div className="nav-spacer" />
      </div>
    )
  }

  // ── Venn-visning ──
  // Full profil: gjenstander, venner, kretser
  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Profilhode */}
      <div style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DDD0' }} className="px-4 pt-6 pb-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0"
            style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--terra)' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={displayName(profile)} />
              : displayName(profile)?.[0]?.toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)' }}>
              {displayName(profile)}
            </h1>
            {profile.username && (
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>@{profile.username}</p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>👥 Dere er venner</p>
          </div>

          <button onClick={toggleStar} className="text-2xl flex-shrink-0 mt-1" aria-label={isStarred ? 'Slutt å følge' : 'Følg'}>
            {isStarred ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Felles venner */}
        {mutualFriends.length > 0 && (
          <div className="mt-4">
            <p className="text-xs mb-2" style={{ color: 'var(--terra-mid)' }}>
              {mutualFriends.length} felles {mutualFriends.length === 1 ? 'venn' : 'venner'}
            </p>
            <div className="flex gap-1 flex-wrap">
              {mutualFriends.slice(0, 5).map((m: any) => (
                <Link key={m.id} href={`/profile/${m.id}`}>
                  <div className="flex items-center gap-1.5 rounded-full px-2 py-1"
                    style={{ background: '#fff', border: '1px solid #E8DDD0' }}>
                    <div className="flex items-center justify-center text-xs overflow-hidden flex-shrink-0"
                      style={{ width: 20, height: 20, borderRadius: '50%', background: '#E8DDD0' }}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" />
                        : displayName(m)?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs" style={{ color: '#6B4226' }}>{displayName(m)}</span>
                  </div>
                </Link>
              ))}
              {mutualFriends.length > 5 && (
                <span className="text-xs self-center" style={{ color: 'var(--terra-mid)' }}>+{mutualFriends.length - 5} til</span>
              )}
            </div>
          </div>
        )}

        {/* Felles kretser */}
        {sharedCommunities.length > 0 && (
          <div className="mt-3">
            <p className="text-xs mb-1.5" style={{ color: 'var(--terra-mid)' }}>Felles kretser</p>
            <div className="flex flex-wrap gap-2">
              {sharedCommunities.map((m: any) => (
                <Link key={m.community_id} href={`/community/${m.community_id}`}>
                  <span className="rounded-full px-3 py-1.5 text-xs shadow-sm"
                    style={{ background: '#fff', border: '1px solid #E8DDD0', color: '#6B4226' }}>
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
            <p className="text-xs mb-1.5" style={{ color: 'var(--terra-mid)' }}>Kretser</p>
            <div className="flex flex-wrap gap-2">
              {publicCommunities.map((m: any) => (
                <Link key={m.community_id} href={`/community/${m.community_id}`}>
                  <span className="rounded-full px-3 py-1.5 text-xs"
                    style={{ background: '#FAF7F2', border: '1px solid #E8DDD0', color: '#6B4226' }}>
                    {m.communities?.avatar_emoji} {m.communities?.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6 pb-8">

        {/* Venner-seksjon */}
        {friends.length > 0 && (
          <div>
            <h2 className="font-bold mb-3" style={{ color: 'var(--terra-dark)' }}>
              Venner
              <span className="font-normal text-sm ml-1.5" style={{ color: 'var(--terra-mid)' }}>({friends.length})</span>
            </h2>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-1 shadow-sm flex-wrap" style={{ background: '#fff' }}>
              {friends.slice(0, 10).map((f: any) => (
                <Link key={f.id} href={`/profile/${f.id}`}>
                  <div className="flex items-center justify-center font-bold text-sm overflow-hidden"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', border: '2px solid #fff' }}>
                    {f.avatar_url
                      ? <img src={f.avatar_url} className="w-full h-full object-cover" alt="" />
                      : <span className="text-xs" style={{ color: '#6B4226' }}>{displayName(f)?.[0]?.toUpperCase()}</span>}
                  </div>
                </Link>
              ))}
              {friends.length > 10 && (
                <div className="flex items-center justify-center text-xs font-bold"
                  style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}>
                  +{friends.length - 10}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delte gjenstander */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: 'var(--terra-dark)' }}>
              Delte gjenstander
              {items.length > 0 && (
                <span className="font-normal text-sm ml-1.5" style={{ color: 'var(--terra-mid)' }}>({items.length})</span>
              )}
            </h2>
          </div>

          {/* Søk — kun hvis > 3 gjenstander */}
          {items.length > 3 && (
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                placeholder="Søk i gjenstander…"
                className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
                style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
              />
            </div>
          )}

          {/* Kategorifilter */}
          {availableCategories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
              <button onClick={() => setItemCategory('')}
                className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
                style={!itemCategory
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                }>
                Alle
              </button>
              {availableCategories.map(cat => (
                <button key={cat.id} onClick={() => setItemCategory(itemCategory === cat.id ? '' : cat.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
                  style={itemCategory === cat.id
                    ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                    : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                  }>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl p-6 text-center text-sm" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
              {items.length === 0 ? 'Ingen gjenstander delt ennå' : 'Ingen treff på søket'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map(item => (
                <Link key={item.id} href={`/items/${item.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm" style={{ background: '#fff' }}>
                    {item.image_url
                      ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                          style={{ width: 48, height: 48 }} alt={item.name} />
                      : <div className="flex items-center justify-center text-xl flex-shrink-0 rounded-xl"
                          style={{ width: 48, height: 48, background: '#E8DDD0' }}>
                          {catEmoji(item.category)}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>{item.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                        {catEmoji(item.category)} {CATEGORIES.find(c => c.id === item.category)?.label || item.category}
                      </p>
                    </div>
                    {item.price && (
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--terra)' }}>
                        {item.price} kr/dag
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="nav-spacer" />
    </div>
  )
}

