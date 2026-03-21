'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'
import StoryRing from '@/components/StoryRing'

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

type AccessLevel = 'self' | 'friend' | 'friend_of_friend' | 'community' | 'stranger'

export default function UserProfilePage() {
  const params = useParams()
  const userId = params?.userId as string
  const router = useRouter()

  const [viewer, setViewer] = useState<any>(null)
  const [viewerProfile, setViewerProfile] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('stranger')
  const [isStarred, setIsStarred] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [isFoF, setIsFoF] = useState(false)
  const [friendRequestSent, setFriendRequestSent] = useState(false)
  const [sharedCommunities, setSharedCommunities] = useState<any[]>([])
  const [publicCommunities, setPublicCommunities] = useState<any[]>([])
  const [mutualFriends, setMutualFriends] = useState<any[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategory, setItemCategory] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setViewer(user)

      // Redirect self → own profile
      if (user.id === userId) { router.replace('/profile'); return }

      const [{ data: vp }, { data: tp }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
      ])
      setViewerProfile(vp)
      if (!tp) { setLoading(false); return }
      setProfile(tp)

      track(Events.PROFILE_VIEWED, { profile_id: userId })

      // ── Friendship ──
      const { data: friendshipRow } = await supabase
        .from('friendships').select('user_b')
        .eq('user_a', user.id).eq('user_b', userId).maybeSingle()
      const friend = !!friendshipRow
      setIsFriend(friend)

      const { data: sentReq } = await supabase
        .from('friend_requests').select('id')
        .eq('from_id', user.id).eq('to_id', userId).eq('status', 'pending').maybeSingle()
      setFriendRequestSent(!!sentReq)

      // ── Friend id sets ──
      const { data: myFriendships } = await supabase
        .from('friendships').select('user_b').eq('user_a', user.id)
      const myFriendIds: string[] = (myFriendships || []).map((f: any) => f.user_b)

      const { data: theirFriendships } = await supabase
        .from('friendships').select('user_b, profiles!friendships_user_b_fkey(id, name, avatar_url)')
        .eq('user_a', userId)
      const theirFriendIds: string[] = (theirFriendships || []).map((f: any) => f.user_b)

      const fof = myFriendIds.some(id => theirFriendIds.includes(id))
      setIsFoF(fof)

      // Mutual friends
      const mutual = (theirFriendships || [])
        .filter((f: any) => myFriendIds.includes(f.user_b))
        .map((f: any) => f.profiles)
      setMutualFriends(mutual)

      // ── Communities ──
      const { data: myMemberships } = await supabase
        .from('community_members')
        .select('community_id, communities(id, name, avatar_emoji, is_public)')
        .eq('user_id', user.id).eq('status', 'active')
      const myComIds = new Set((myMemberships || []).map((m: any) => m.community_id))

      const { data: theirMemberships } = await supabase
        .from('community_members')
        .select('community_id, communities(id, name, avatar_emoji, is_public)')
        .eq('user_id', userId).eq('status', 'active')

      const shared = (theirMemberships || [])
        .filter((m: any) => myComIds.has(m.community_id))
        .map((m: any) => m.communities)
      setSharedCommunities(shared)

      const pub = (theirMemberships || [])
        .filter((m: any) => !myComIds.has(m.community_id) && m.communities?.is_public)
        .map((m: any) => m.communities)
      setPublicCommunities(pub)

      // ── Access level ──
      let level: AccessLevel = 'stranger'
      if (friend) level = 'friend'
      else if (fof) level = 'friend_of_friend'
      else if (shared.length > 0) level = 'community'
      setAccessLevel(level)

      // ── Starred ──
      const { data: starRow } = await supabase
        .from('starred_users').select('starred_id')
        .eq('user_id', user.id).eq('starred_id', userId).maybeSingle()
      setIsStarred(!!starRow)

      // ── Items with access filter ──
      const { data: allItems } = await supabase
        .from('items').select('*, item_access(access_type, community_id)')
        .eq('owner_id', userId).order('created_at', { ascending: false })

      const visible = (allItems || []).filter((item: any) => {
        const rules: any[] = item.item_access || []
        if (rules.length === 0) return true
        return rules.some((r: any) => {
          if (r.access_type === 'public') return true
          if (r.access_type === 'friends') return friend
          if (r.access_type === 'friends_of_friends') return friend || fof
          if (r.access_type === 'community') return myComIds.has(r.community_id)
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
      await supabase.from('starred_users')
        .delete().eq('user_id', viewer.id).eq('starred_id', userId)
      setIsStarred(false)
    } else {
      await supabase.from('starred_users')
        .insert({ user_id: viewer.id, starred_id: userId })
      await supabase.from('notifications').insert({
        user_id: userId, type: 'starred',
        title: 'Noen likte profilen din',
        body: `${viewerProfile?.name || viewer.email?.split('@')[0]} fulgte deg`,
      })
      setIsStarred(true)
    }
  }

  const sendFriendRequest = async () => {
    const supabase = createClient()
    await supabase.from('friend_requests')
      .insert({ from_id: viewer.id, to_id: userId })
    await supabase.from('notifications').insert({
      user_id: userId, type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${viewerProfile?.name || viewer.email?.split('@')[0]} vil bli venner`,
    })
    setFriendRequestSent(true)
    track(Events.FRIEND_REQUEST_SENT)
  }

  // Filtered + searched items
  const availableCategories = [...new Set(items.map(i => i.category).filter(Boolean))]
  const filteredItems = items.filter(i => {
    const matchCat = !itemCategory || i.category === itemCategory
    const matchSearch = itemSearch.length < 2
      || i.name?.toLowerCase().includes(itemSearch.toLowerCase())
      || i.description?.toLowerCase().includes(itemSearch.toLowerCase())
    return matchCat && matchSearch
  })

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Bruker'

  if (loading) return (
    <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  )

  if (!profile) return (
    <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>
      Fant ikke denne brukeren.
    </div>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* ── Topbar ── */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: '#fff', border: '1px solid #E8DDD0', color: '#6B4226' }}
          aria-label="Tilbake"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1" />
        {/* Star button */}
        <button
          onClick={toggleStar}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: '#fff', border: '1px solid #E8DDD0', color: isStarred ? '#C4673A' : '#9C7B65' }}
          aria-label={isStarred ? 'Fjern stjerne' : 'Stjernemark'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={isStarred ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {/* ── Profilhode ── */}
      <div style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DDD0' }} className="px-4 pt-2 pb-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className="flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0"
            style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--terra)' }}
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={displayName} />
              : displayName?.[0]?.toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate" style={{ color: 'var(--terra-dark)' }}>
              {displayName}
            </h1>

            {/* Access level badge */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {isFriend && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: '#EEF4F0', color: 'var(--terra-green)' }}>
                  ✓ Venn
                </span>
              )}
              {!isFriend && isFoF && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: '#FAF7F2', color: 'var(--terra-mid)', border: '1px solid #E8DDD0' }}>
                  Felles venner
                </span>
              )}
              {accessLevel === 'stranger' && !isFoF && (
                <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Ukjent</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Mutual friends ── */}
        {mutualFriends.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-1">
              {mutualFriends.slice(0, 4).map((f: any) => (
                <div key={f.id}
                  className="flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{ width: 24, height: 24, borderRadius: '50%', background: '#E8DDD0', border: '2px solid #FAF7F2', color: '#6B4226' }}>
                  {f.avatar_url
                    ? <img src={f.avatar_url} className="w-full h-full object-cover" alt="" />
                    : f.name?.[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
              {mutualFriends.length} felles {mutualFriends.length === 1 ? 'venn' : 'venner'}
            </p>
          </div>
        )}

        {/* ── Communities ── */}
        {(sharedCommunities.length > 0 || publicCommunities.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {sharedCommunities.map((c: any) => (
              <Link key={c.id} href={`/communities/${c.id}`}>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: '#EEF4F0', color: 'var(--terra-green)', border: '1px solid #B8D8C4' }}>
                  {c.avatar_emoji} {c.name}
                </span>
              </Link>
            ))}
            {publicCommunities.map((c: any) => (
              <Link key={c.id} href={`/communities/${c.id}`}>
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: '#FAF7F2', color: 'var(--terra-mid)', border: '1px solid #E8DDD0' }}>
                  {c.avatar_emoji} {c.name}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="flex gap-2 mt-4">
          <div className="glass flex-1 rounded-2xl p-3 text-center" style={{ borderRadius: 16 }}>
            <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{items.length}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>gjenstander</p>
          </div>
          <div className="glass flex-1 rounded-2xl p-3 text-center" style={{ borderRadius: 16 }}>
            <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{mutualFriends.length}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>felles venner</p>
          </div>
          <div className="glass flex-1 rounded-2xl p-3 text-center" style={{ borderRadius: 16 }}>
            <p className="text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>{sharedCommunities.length}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>felles kretser</p>
          </div>
        </div>

        {/* ── Friend request CTA ── */}
        {!isFriend && (
          <div className="mt-4">
            {friendRequestSent ? (
              <div
                className="w-full py-3 rounded-2xl text-sm font-medium text-center"
                style={{ background: '#FAF7F2', color: 'var(--terra-mid)', border: '1px solid #E8DDD0' }}
              >
                Forespørsel sendt ✓
              </div>
            ) : (
              <button
                onClick={sendFriendRequest}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--terra)', color: '#fff' }}
              >
                + Legg til som venn
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stories ── */}
      <div style={{ borderBottom: '1px solid #E8DDD0', background: '#FAF7F2' }}>
        <StoryRing
          ownerId={userId}
          isOwner={false}
        />
      </div>

      {/* ── Gjenstander ── */}
      <div className="px-4 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold flex-1" style={{ color: 'var(--terra-dark)' }}>
            Gjenstander
            {items.length > 0 && (
              <span className="font-normal text-sm ml-1.5" style={{ color: 'var(--terra-mid)' }}>
                ({items.length})
              </span>
            )}
          </h2>
        </div>

        {/* Search — only if > 3 items */}
        {items.length > 3 && (
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--terra-mid)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              placeholder="Søk i gjenstander…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>
        )}

        {/* Category filter — only if > 1 category */}
        {availableCategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setItemCategory('')}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
              style={!itemCategory
                ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
              }
            >
              Alle
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setItemCategory(cat)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
                style={itemCategory === cat
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                }
              >
                <span>{CATEGORY_EMOJI[cat] ?? '📦'}</span>
                <span className="capitalize">{cat}</span>
              </button>
            ))}
          </div>
        )}

        {/* Item list */}
        {filteredItems.length === 0 ? (
          <div
            className="rounded-2xl p-5 text-center text-sm"
            style={{ background: '#fff', color: 'var(--terra-mid)' }}
          >
            {items.length === 0
              ? `${displayName} har ikke lagt ut noe ennå`
              : 'Ingen gjenstander matcher søket'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map((item: any) => (
              <Link key={item.id} href={`/items/${item.id}`}>
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
                  style={{ background: '#fff' }}
                >
                  {item.image_url
                    ? <img
                        src={item.image_url}
                        className="rounded-xl object-cover flex-shrink-0"
                        style={{ width: 48, height: 48 }}
                        alt={item.name}
                      />
                    : <div
                        className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ width: 48, height: 48, background: '#E8DDD0' }}
                      >
                        {CATEGORY_EMOJI[item.category] ?? '📦'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                      {item.name}
                    </p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--terra-mid)' }}>
                      {item.category}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                    style={{
                      fontSize: 10,
                      ...(item.available
                        ? { background: '#EEF4F0', color: 'var(--terra-green)' }
                        : { background: '#FFF0E6', color: 'var(--terra)' })
                    }}
                  >
                    {item.available ? 'Ledig' : 'Utlånt'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
