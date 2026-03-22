'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'

const CATEGORIES = [
  { id: 'all',      label: 'Alle',    emoji: '✨' },
  { id: 'barn',     label: 'Barn',    emoji: '🧸' },
  { id: 'kjole',    label: 'Kjoler',  emoji: '👗' },
  { id: 'verktøy',  label: 'Verktøy', emoji: '🔧' },
  { id: 'bok',      label: 'Bøker',   emoji: '📚' },
  { id: 'annet',    label: 'Annet',   emoji: '📦' },
]

const CAT_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', 'verktøy': '🔧', bok: '📚', annet: '📦',
}

const DEFAULT_VISIBLE = 5

export default function FeedPage() {
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [feedItems, setFeedItems]     = useState<any[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [requests, setRequests]       = useState<any[]>([])
  const [seenIds, setSeenIds]         = useState<Set<string>>(new Set())
  const [activeStory, setActiveStory] = useState<any | null>(null)
  const [loading, setLoading]         = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAllItems, setShowAllItems] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

      const friendIds = new Set(
        (friendships || []).map((f: any) =>
          f.user_a === user.id ? f.user_b : f.user_a
        )
      )
      setFriendCount(friendIds.size)

      const { data: items, error } = await supabase
        .from('items')
        .select('*, profiles!items_owner_id_fkey(id, name, email, avatar_url)')
        .neq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60)

      if (error) console.error('Feed query error:', error)

      const sorted = (items || []).sort((a: any, b: any) => {
        const aFriend = friendIds.has(a.owner_id) ? 0 : 1
        const bFriend = friendIds.has(b.owner_id) ? 0 : 1
        if (aFriend !== bFriend) return aFriend - bFriend
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setFeedItems(sorted)
      track(Events.FEED_VIEWED, { item_count: sorted.length })

      try {
        const { data: reqs } = await supabase
          .from('item_requests')
          .select('*, profiles!item_requests_user_id_fkey(id, name, avatar_url)')
          .in('user_id', [...friendIds])
          .eq('status', 'open')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(20)

        if (reqs) setRequests(reqs)

        const { data: views } = await supabase
          .from('item_request_views')
          .select('request_id')
          .eq('user_id', user.id)
        setSeenIds(new Set((views || []).map((v: any) => v.request_id)))
      } catch {
        // item_requests-tabellen finnes ikke ennå — ignorer
      }

      setLoading(false)
    }
    load()
  }, [])

  const openStory = async (req: any) => {
    setActiveStory(req)
    if (seenIds.has(req.id)) return
    setSeenIds(prev => new Set([...prev, req.id]))
    try {
      const supabase = createClient()
      await supabase.from('item_request_views').insert({
        user_id: user.id,
        request_id: req.id,
      })
    } catch { /* tabell mangler */ }
  }

  const closeStory = () => setActiveStory(null)

  const handleHarDette = async () => {
    if (!activeStory) return
    const params = new URLSearchParams()
    if (activeStory.item_name) params.set('name', activeStory.item_name)
    if (activeStory.category) params.set('category', activeStory.category)
    if (activeStory.image_url) params.set('image_url', activeStory.image_url)

    const senderName = profile?.name || user?.email?.split('@')[0] || 'Noen'

    try {
      const supabase = createClient()
      const { error } = await supabase.from('notifications').insert({
        user_id: activeStory.user_id,
        type: 'item_request_response',
        title: 'Noen har dette!',
        body: `${senderName} svarte på forespørselen din om ${activeStory.item_name}`,
      })
      if (error) console.error('Notification error:', error)
    } catch (e) {
      console.error('Notification exception:', e)
    }

    track(Events.ITEM_REQUEST_RESPONSE, { request_id: activeStory.id })
    router.push(`/add?${params.toString()}`)
  }

  const countByCategory = (catId: string) => {
    if (catId === 'all') return feedItems.filter(i => i.available).length
    return feedItems.filter(i => i.category === catId && i.available).length
  }

  const totalAvailable = feedItems.filter(i => i.available).length

  const sortedCategories = [...CATEGORIES].sort((a, b) => {
    if (a.id === 'all') return -1
    if (b.id === 'all') return 1
    const countA = countByCategory(a.id)
    const countB = countByCategory(b.id)
    if (countA === 0 && countB > 0) return 1
    if (countB === 0 && countA > 0) return -1
    return countB - countA
  })

  const allFilteredItems = feedItems
    .filter(i => activeCategory === 'all' || i.category === activeCategory)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const visibleItems = showAllItems
    ? allFilteredItems
    : allFilteredItems.slice(0, DEFAULT_VISIBLE)

  const hasMore = allFilteredItems.length > DEFAULT_VISIBLE

  const catEmoji = (cat: string) =>
    CATEGORIES.find(c => c.id === cat)?.emoji ?? '📦'

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m siden`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}t siden`
    const days = Math.floor(hours / 24)
    return `${days}d siden`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-[#9C7B65] text-sm">Laster feed…</p>
      </div>
    )
  }

  const noFriends = friendCount === 0
  const noItems   = feedItems.length === 0
  const hasNewRequests = requests.some(r => !seenIds.has(r.id))

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* ── RequestStory-rad ── */}
        {requests.length > 0 && (
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="font-display text-[#2C1A0E] text-base font-semibold">
                Kretsen trenger
              </h2>
              {hasNewRequests && (
                <span className="text-[10px] font-semibold text-[var(--terra)] uppercase tracking-wide">
                  Nytt
                </span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4"
              style={{ scrollbarWidth: 'none' }}>
              {requests.map(req => {
                const isSeen = seenIds.has(req.id)
                const avatar = req.profiles?.avatar_url
                const initials = (req.profiles?.name || '?')[0].toUpperCase()
                return (
                  <button
                    key={req.id}
                    onClick={() => openStory(req)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16"
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{
                        padding: '2px',
                        background: isSeen ? 'rgba(156,123,101,0.3)' : 'var(--terra)',
                        opacity: isSeen ? 0.5 : 1,
                        transition: 'opacity 300ms ease',
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-[#FAF7F2] flex items-center justify-center overflow-hidden"
                        style={{ padding: '2px' }}>
                        {avatar ? (
                          <img src={avatar} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[#E8DDD0] flex items-center justify-center text-sm font-bold text-[#6B4226]">
                            {initials}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#2C1A0E] text-center leading-tight w-full truncate">
                      {CAT_EMOJI[req.category] ?? '📦'} {req.item_name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Tom tilstand: ingen venner ── */}
        {noFriends && (
          <div className="glass rounded-[20px] p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">🏘️</span>
            <div>
              <p className="font-display text-[#2C1A0E] text-lg font-semibold">Kretsen din er tom</p>
              <p className="text-[#9C7B65] text-sm mt-1 leading-relaxed">
                Legg til venner for å se hva de har å låne ut.
              </p>
            </div>
            <div className="flex gap-3 mt-1">
              <Link href="/friends">
                <button className="btn-primary px-5 py-2.5 text-sm">Finn venner</button>
              </Link>
              <Link href="/invite">
                <button className="btn-glass px-5 py-2.5 text-sm">Inviter</button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Tom tilstand: har venner, ingen items ── */}
        {!noFriends && noItems && (
          <div className="glass rounded-[20px] p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">📭</span>
            <div>
              <p className="font-display text-[#2C1A0E] text-lg font-semibold">Kretsen din er stille</p>
              <p className="text-[#9C7B65] text-sm mt-1 leading-relaxed">
                Ingen har lagt ut noe ennå. Vær den første!
              </p>
            </div>
            <div className="flex gap-3 mt-1">
              <Link href="/add">
                <button className="btn-primary px-5 py-2.5 text-sm">+ Legg ut</button>
              </Link>
              <Link href="/invite">
                <button className="btn-glass px-5 py-2.5 text-sm">Inviter flere</button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Feed med innhold ── */}
        {!noItems && (
          <>
            <div>
              <h2 className="font-display text-[#2C1A0E] text-xl font-semibold leading-tight">
                I kretsen din
              </h2>
              <p className="text-[#9C7B65] text-sm mt-0.5">
                {totalAvailable > 0
                  ? `${totalAvailable} ting å låne`
                  : 'Ingen ledige ting akkurat nå'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {sortedCategories.map(cat => {
                const count = countByCategory(cat.id)
                const isCatEmpty = cat.id !== 'all' && count === 0
                const isActive = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (isCatEmpty) return
                      setActiveCategory(cat.id)
                      setShowAllItems(false)
                      track(Events.CATEGORY_FILTERED, { category: cat.id })
                    }}
                    disabled={isCatEmpty}
                    style={{ opacity: isCatEmpty ? 0.45 : 1 }}
                    className={[
                      'rounded-[16px] p-3 flex flex-col items-center gap-1.5 border transition-all duration-200',
                      isActive
                        ? 'bg-[var(--terra)] border-[var(--terra)] shadow-sm'
                        : 'glass border-[rgba(196,103,58,0.18)]',
                      isCatEmpty ? 'cursor-default' : 'active:scale-95',
                    ].join(' ')}
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className={`text-xs font-medium leading-tight ${isActive ? 'text-white' : 'text-[#2C1A0E]'}`}>
                      {cat.label}
                    </span>
                    <span className={`text-[10px] font-semibold tabular-nums ${isActive ? 'text-white/80' : 'text-[#9C7B65]'}`}>
                      {cat.id === 'all'
                        ? `${totalAvailable} tilgjengelig`
                        : count === 0 ? '—' : `${count} ledig${count !== 1 ? 'e' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-3">
                <h2 className="font-display text-[#2C1A0E] text-base font-semibold">
                  Nylig lagt ut
                </h2>
                {allFilteredItems.length > 0 && (
                  <span className="text-[#9C7B65] text-xs">
                    {showAllItems ? allFilteredItems.length : Math.min(DEFAULT_VISIBLE, allFilteredItems.length)} av {allFilteredItems.length}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {visibleItems.map(item => (
                  <Link key={item.id} href={`/items/${item.id}`}>
                    <div
                      className="item-card glass-hover flex items-center gap-3 px-3 py-3"
                      style={{ borderRadius: '16px', border: '1px solid rgba(196,103,58,0.18)' }}
                    >
                      <div className="relative flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-14 h-14 rounded-[12px] object-cover" alt={item.name} />
                        ) : (
                          <div className="w-14 h-14 rounded-[12px] bg-[#E8DDD0] flex items-center justify-center text-2xl">
                            {catEmoji(item.category)}
                          </div>
                        )}
                        <span
                          className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: item.available ? 'var(--terra-green)' : 'var(--terra)' }}
                          title={item.available ? 'Ledig' : 'Utlånt'}
                        />
                      </div>
                      <div className="item-card-body flex-1 min-w-0" style={{ background: 'transparent' }}>
                        <p className="item-name font-display text-[#2C1A0E] text-sm font-semibold truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#9C7B65] mt-0.5 truncate">
                          {item.profiles?.name ?? 'Ukjent'} · {relativeTime(item.created_at)}
                        </p>
                      </div>
                      <span className="text-[#9C7B65] text-sm flex-shrink-0">›</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Se alle / Vis færre */}
              {hasMore && (
                <button
                  onClick={() => setShowAllItems(v => !v)}
                  className="btn-glass w-full mt-3 py-2.5 text-sm"
                >
                  {showAllItems
                    ? 'Vis færre'
                    : `Se alle ${allFilteredItems.length} gjenstander`}
                </button>
              )}
            </div>

            <Link href="/invite">
              <div
                className="flex items-center justify-between p-4 mb-2"
                style={{ background: 'var(--terra)', borderRadius: '20px' }}
              >
                <div>
                  <p className="text-white font-semibold text-sm">Utvid kretsen din</p>
                  <p className="text-white/70 text-xs mt-0.5">Inviter venner og få flere ting å låne</p>
                </div>
                <span className="text-white text-lg">→</span>
              </div>
            </Link>
          </>
        )}

      </div>

      {/* ── Story-drawer ── */}
      {activeStory && (
        <>
          <div className="modal-backdrop" onClick={closeStory} />
          <div className="drawer-sheet glass-heavy" style={{ borderRadius: '24px 24px 0 0' }}>
            <div className="drawer-handle" />

            <div className="flex items-center gap-3 px-5 pt-2 pb-4">
              <Link href={`/profile/${activeStory.user_id}`} onClick={closeStory}>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#E8DDD0] flex items-center justify-center flex-shrink-0">
                  {activeStory.profiles?.avatar_url
                    ? <img src={activeStory.profiles.avatar_url} className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-[#6B4226]">
                        {(activeStory.profiles?.name || '?')[0].toUpperCase()}
                      </span>}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${activeStory.user_id}`} onClick={closeStory}>
                  <p className="font-semibold text-[#2C1A0E] text-sm truncate">
                    {activeStory.profiles?.name ?? 'Ukjent'}
                  </p>
                </Link>
                <p className="text-[10px] text-[#9C7B65]">{relativeTime(activeStory.created_at)}</p>
              </div>
              <button onClick={closeStory} className="text-[#9C7B65] text-lg px-1">✕</button>
            </div>

            {activeStory.image_url && (
              <div className="mx-5 mb-4 rounded-[16px] overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <img src={activeStory.image_url} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="px-5 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{CAT_EMOJI[activeStory.category] ?? '📦'}</span>
                <h2 className="font-display text-[#2C1A0E] text-xl font-semibold">
                  {activeStory.item_name}
                </h2>
              </div>
              {activeStory.category && (
                <p className="text-[#9C7B65] text-sm capitalize">{activeStory.category}</p>
              )}
            </div>

            <div className="px-5 pt-4 pb-6 flex flex-col gap-3">
              <button onClick={handleHarDette} className="btn-primary w-full py-3">
                Jeg har dette! →
              </button>
              <Link href={`/profile/${activeStory.user_id}`} onClick={closeStory}>
                <button className="btn-glass w-full py-3">Se profil</button>
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="nav-spacer" />
    </div>
  )
}
