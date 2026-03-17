'use client'
import { useEffect, useState } from 'react'
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

export default function FeedPage() {
  const [user, setUser]               = useState<any>(null)
  const [feedItems, setFeedItems]     = useState<any[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b')
        .eq('user_a', user.id)
      const friendIds = new Set((friendships || []).map((f: any) => f.user_b))
      setFriendCount(friendIds.size)

      const { data: items, error } = await supabase
        .from('items')
        .select('*, profiles(id, name, avatar_url)')
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
      setLoading(false)
    }
    load()
  }, [])

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

  const filteredItems = feedItems
    .filter(i => activeCategory === 'all' || i.category === activeCategory)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)

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

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Tom tilstand: ingen venner */}
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

        {/* Tom tilstand: har venner, ingen items */}
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

        {/* Feed med innhold */}
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
                {filteredItems.length > 0 && (
                  <span className="text-[#9C7B65] text-xs">{filteredItems.length} gjenstander</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {filteredItems.map(item => (
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
      <div className="nav-spacer" />
    </div>
  )
}
