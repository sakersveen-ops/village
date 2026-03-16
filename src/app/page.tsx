'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'

const CATEGORIES = [
  { id: 'all',      label: 'Alle',     emoji: '✨' },
  { id: 'barn',     label: 'Barn',     emoji: '🧸' },
  { id: 'kjole',    label: 'Kjoler',   emoji: '👗' },
  { id: 'verktøy',  label: 'Verktøy',  emoji: '🔧' },
  { id: 'bok',      label: 'Bøker',    emoji: '📚' },
  { id: 'annet',    label: 'Annet',    emoji: '📦' },
]

export default function FeedPage() {
  const [user, setUser]           = useState<any>(null)
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
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
      const friendIds = (friendships || []).map((f: any) => f.user_b)

      let query = supabase
        .from('items')
        .select('*, profiles(id, name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(60)

      if (friendIds.length > 0) {
        query = query.in('owner_id', friendIds)
      }

      const { data: items } = await query
      setFeedItems(items || [])
      track(Events.FEED_VIEWED, { item_count: items?.length ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  const countByCategory = (catId: string) => {
    const base = feedItems.filter(i => i.owner_id !== user?.id)
    if (catId === 'all') return base.filter(i => i.available).length
    return base.filter(i => i.category === catId && i.available).length
  }

  const totalAvailable = feedItems.filter(i => i.owner_id !== user?.id && i.available).length

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

  const catEmoji = (cat: string) => CATEGORIES.find(c => c.id === cat)?.emoji ?? '📦'

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m siden`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}t siden`
    return `${Math.floor(hours / 24)}d siden`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p style={{ color: 'var(--terra-mid)', fontSize: 14 }}>Laster feed…</p>
      </div>
    )
  }

  const isEmpty = feedItems.length === 0

  return (
    <>
      {/* ── Sticky header — FULL WIDTH, outside max-w container ── */}
      <header className="page-header glass">
        <h1 className="page-header-title font-display">Village</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/notifications" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(196,103,58,0.10)',
              border: '1px solid rgba(196,103,58,0.15)',
              fontSize: 16,
            }}>🔔</div>
          </Link>
          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(196,103,58,0.10)',
              border: '1px solid rgba(196,103,58,0.15)',
              fontSize: 16,
            }}>👤</div>
          </Link>
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="max-w-lg mx-auto pb-28 px-4 pt-5" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {isEmpty && (
          <div className="glass" style={{ borderRadius: 20, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 40 }}>🏘️</span>
            <div>
              <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 18, fontWeight: 600 }}>Kretsen din er stille</p>
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
                Ingen har lagt ut ting ennå. Inviter venner eller legg ut ditt første objekt!
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <Link href="/add"><button className="btn-primary" style={{ padding: '10px 20px', fontSize: 14, width: 'auto' }}>+ Legg ut</button></Link>
              <Link href="/invite"><button className="btn-glass" style={{ padding: '10px 20px', fontSize: 14 }}>Inviter venner</button></Link>
            </div>
          </div>
        )}

        {!isEmpty && (
          <>
            <div>
              <h2 className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
                I kretsen din
              </h2>
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, marginTop: 2 }}>
                {totalAvailable > 0 ? `${totalAvailable} ting å låne` : 'Ingen ledige ting akkurat nå'}
              </p>
            </div>

            {/* Category grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {sortedCategories.map(cat => {
                const count = countByCategory(cat.id)
                const empty = cat.id !== 'all' && count === 0
                const isActive = activeCategory === cat.id

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id)
                      track(Events.CATEGORY_FILTERED, { category: cat.id })
                    }}
                    style={{
                      opacity: empty ? 0.45 : 1,
                      borderRadius: 16,
                      padding: '12px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      border: isActive ? '1.5px solid var(--terra)' : '1px solid rgba(196,103,58,0.18)',
                      background: isActive ? 'var(--terra)' : 'var(--glass-bg)',
                      backdropFilter: isActive ? 'none' : 'blur(16px)',
                      WebkitBackdropFilter: isActive ? 'none' : 'blur(16px)',
                      boxShadow: isActive ? '0 4px 12px rgba(196,103,58,0.25)' : 'inset 0 1px 0 rgba(255,255,255,0.7)',
                      cursor: empty ? 'default' : 'pointer',
                      pointerEvents: empty ? 'none' : 'auto',
                      transition: 'all 200ms ease',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'white' : 'var(--terra-dark)', lineHeight: 1.2 }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--terra-mid)' }}>
                      {cat.id === 'all'
                        ? `${totalAvailable} tilgjengelig`
                        : count === 0 ? '—' : `${count} ledig${count !== 1 ? 'e' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Recent items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <h2 className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 16, fontWeight: 600 }}>
                  Nylig lagt ut
                </h2>
                {filteredItems.length > 0 && (
                  <span style={{ color: 'var(--terra-mid)', fontSize: 12 }}>{filteredItems.length} gjenstander</span>
                )}
              </div>

              {filteredItems.length === 0 ? (
                <div className="glass" style={{ borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <p style={{ color: 'var(--terra-mid)', fontSize: 14 }}>Ingen ting i denne kategorien ennå</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredItems.map(item => (
                    <Link key={item.id} href={`/items/${item.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        borderRadius: 16,
                        border: '1px solid rgba(196,103,58,0.18)',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        transition: 'box-shadow 200ms ease, transform 200ms ease',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)'
                        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                        ;(e.currentTarget as HTMLElement).style.transform = 'none'
                      }}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {item.image_url ? (
                            <img src={item.image_url} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', display: 'block' }} alt={item.name} />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 12, background: '#E8DDD0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                              {catEmoji(item.category)}
                            </div>
                          )}
                          <span style={{
                            position: 'absolute', bottom: 2, right: 2,
                            width: 10, height: 10, borderRadius: '50%',
                            border: '2px solid white',
                            background: item.available ? '#4A7C59' : '#C4673A',
                          }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </p>
                          <p style={{ color: 'var(--terra-mid)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.profiles?.name ?? 'Ukjent'} · {relativeTime(item.created_at)}
                          </p>
                        </div>

                        <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Invite CTA */}
            <Link href="/invite" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--terra)',
                borderRadius: 20,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Utvid kretsen din</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Inviter venner og få flere ting å låne</p>
                </div>
                <span style={{ color: 'white', fontSize: 18 }}>→</span>
              </div>
            </Link>
          </>
        )}
      </div>
    </>
  )
}
