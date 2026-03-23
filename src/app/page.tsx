'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track, Events } from '@/lib/track'
import { CATEGORIES } from '@/lib/categories'

const CAT_EMOJI: Record<string, string> = {
  'hjem-og-hage': '🏠',
  'baby-og-barn': '🧸',
  'fest-og-arrangement': '🎉',
  'friluft-og-sport': '⛺',
  'klar-og-mote': '👗',
  'boker': '📚',
}

// Legacy DB values → new top-level IDs
const LEGACY_CAT_MAP: Record<string, string> = {
  'barn':     'baby-og-barn',
  'kjole':    'klar-og-mote',
  'verktøy':  'hjem-og-hage',
  'bok':      'boker',
  'annet':    'hjem-og-hage',
}

function normalizeCategory(cat: string): string {
  return LEGACY_CAT_MAP[cat] ?? cat
}

const DEFAULT_VISIBLE = 5

interface RequestGroup {
  userId: string
  name: string
  avatar_url: string | null
  requests: any[]
  hasSeen: boolean
}

// ── "Jeg har dette" confirmation modal ──
function HarDetteModal({
  req,
  senderName,
  onClose,
  onSent,
}: {
  req: any
  senderName: string
  onClose: () => void
  onSent: () => void
}) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const sendNotification = async () => {
    setSending(true)
    try {
      const supabase = createClient()
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'item_request_response',
        title: 'Noen har dette!',
        body: `${senderName} svarte på forespørselen din om ${req.name}`,
      })
    } catch (e) { console.error(e) }
    track(Events.ITEM_REQUEST_RESPONSE, { request_id: req.id })
    setSending(false)
    setDone(true)
  }

  const goAddItem = async () => {
    await sendNotification()
    const params = new URLSearchParams()
    if (req.name)      params.set('name', req.name)
    if (req.category)  params.set('category', normalizeCategory(req.category))
    if (req.image_url) params.set('image_url', req.image_url)
    router.push(`/add?${params.toString()}`)
  }

  const emoji = CAT_EMOJI[normalizeCategory(req.category)] ?? '🔍'

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 65 }} />
      <div className="fixed inset-x-0 bottom-0 z-[70] glass-heavy flex flex-col"
        style={{ borderRadius: '24px 24px 0 0', maxWidth: 480, margin: '0 auto' }}>
        <div className="drawer-handle" />
        <div className="px-5 pt-2 pb-8 flex flex-col gap-4">

          {/* Item preview */}
          <div className="flex items-center gap-3 py-2">
            {req.image_url
              ? <img src={req.image_url} className="w-14 h-14 rounded-[14px] object-cover flex-shrink-0" alt={req.name} />
              : <div className="w-14 h-14 rounded-[14px] bg-[#E8DDD0] flex items-center justify-center text-2xl flex-shrink-0">{emoji}</div>
            }
            <div className="min-w-0">
              <p className="font-display text-[var(--terra-dark)] font-semibold truncate">{req.name}</p>
              <p className="text-xs text-[var(--terra-mid)] mt-0.5">
                Forespørsel fra {req.profiles?.name ?? 'ukjent'}
              </p>
            </div>
          </div>

          {done ? (
            <div className="rounded-2xl py-3 text-center text-sm font-semibold"
              style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)', border: '1px solid rgba(74,124,89,0.3)' }}>
              ✓ Melding sendt!
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--terra-mid)] -mt-1">
                Vil du legge ut denne gjenstanden slik at {req.profiles?.name ?? 'vedkommende'} kan sende en låneforespørsel?
              </p>

              <button
                onClick={goAddItem}
                disabled={sending}
                className="btn-primary w-full py-3.5 text-sm font-semibold"
              >
                {sending ? '…' : `📦 Legg ut "${req.name}"`}
              </button>

              <button
                onClick={async () => { await sendNotification(); onSent() }}
                disabled={sending}
                className="btn-glass w-full py-3 text-sm"
              >
                Bare send melding (uten å legge ut)
              </button>
            </>
          )}

        </div>
      </div>
    </>
  )
}

// ── Fullskjerm story viewer for én venns requests ──
function RequestStoryViewer({
  group, user, profile, onClose, onHarDette,
}: {
  group: RequestGroup
  user: any
  profile: any
  onClose: () => void
  onHarDette: (req: any) => void
}) {
  const [idx, setIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [activeReq, setActiveReq] = useState<any | null>(null)

  const total = group.requests.length
  const req = group.requests[idx]

  const advance = useCallback(() => {
    setIdx(prev => {
      if (prev < total - 1) { setProgress(0); return prev + 1 }
      onClose(); return prev
    })
  }, [total, onClose])

  useEffect(() => {
    if (paused || activeReq) return
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { advance(); return 0 }
        return prev + 2
      })
    }, 50)
    return () => clearInterval(interval)
  }, [paused, activeReq, advance])

  const goTo = (i: number) => { setIdx(i); setProgress(0) }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeReq) return
    const x = e.clientX
    const w = (e.currentTarget as HTMLElement).offsetWidth
    if (x < w * 0.35) { if (idx > 0) goTo(idx - 1) }
    else advance()
  }

  if (!req) return null

  const emoji = CAT_EMOJI[normalizeCategory(req.category)] ?? '🔍'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#1a0f08', maxWidth: 480, margin: '0 auto' }}>
      {/* Progress bars */}
      <div className="flex gap-1 px-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full rounded-full" style={{
              background: '#fff',
              width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
              transition: 'none',
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: 'var(--terra)' }}>
          {group.avatar_url
            ? <img src={group.avatar_url} className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-white">{group.name[0].toUpperCase()}</span>
          }
        </div>
        <span className="text-sm font-semibold flex-1 text-white">{group.name}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{idx + 1} / {total}</span>
        <button onClick={onClose}
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Slide */}
      <div
        className="flex-1 relative"
        onClick={handleTap}
        onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {req.image_url
          ? <img src={req.image_url} className="absolute inset-0 w-full h-full object-cover" alt={req.name} />
          : <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(160deg, #3a1f0f 0%, #1a0f08 100%)' }}>
              <span style={{ fontSize: 120, opacity: 0.2 }}>{emoji}</span>
            </div>
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {group.name} ønsker å låne
          </p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{emoji}</span>
            <h2 className="font-display text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              {req.name}
            </h2>
          </div>
          {req.description && (
            <p className="text-sm mt-1 mb-2" style={{ color: 'rgba(255,255,255,0.65)', fontStyle: 'italic' }}>
              {req.description}
            </p>
          )}
          {(req.loan_from || req.loan_to) && (
            <div className="flex items-center gap-1.5 mb-3">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {req.loan_from ? new Date(req.loan_from).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '?'}
                {' → '}
                {req.loan_to ? new Date(req.loan_to).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '?'}
              </span>
            </div>
          )}

          <button
            onClick={e => { e.stopPropagation(); setPaused(true); setActiveReq(req) }}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold mt-3"
            style={{ background: 'var(--terra)', color: '#fff' }}>
            🤝 Jeg har dette!
          </button>
        </div>
      </div>

      {activeReq && (
        <HarDetteModal
          req={activeReq}
          senderName={profile?.name || user?.email?.split('@')[0] || 'Noen'}
          onClose={() => { setActiveReq(null); setPaused(false) }}
          onSent={() => { setActiveReq(null); setPaused(false); onClose() }}
        />
      )}
    </div>
  )
}

export default function FeedPage() {
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [feedItems, setFeedItems]     = useState<any[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [requestGroups, setRequestGroups] = useState<RequestGroup[]>([])
  const [seenIds, setSeenIds]         = useState<Set<string>>(new Set())
  const [activeGroup, setActiveGroup] = useState<RequestGroup | null>(null)
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
        .from('profiles').select('name').eq('id', user.id).single()
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

      if (friendIds.size > 0) {
        try {
          const { data: reqs } = await supabase
            .from('item_requests')
            .select('*, profiles!item_requests_user_id_fkey(id, name, avatar_url)')
            .in('user_id', [...friendIds])
            .eq('post_to_friends', true)
            .order('created_at', { ascending: false })
            .limit(40)

          const { data: views } = await supabase
            .from('item_request_views')
            .select('request_id')
            .eq('user_id', user.id)

          const seen = new Set((views || []).map((v: any) => v.request_id))
          setSeenIds(seen)

          const groupMap = new Map<string, RequestGroup>()
          for (const req of reqs || []) {
            if (!groupMap.has(req.user_id)) {
              groupMap.set(req.user_id, {
                userId: req.user_id,
                name: req.profiles?.name ?? 'Ukjent',
                avatar_url: req.profiles?.avatar_url ?? null,
                requests: [],
                hasSeen: true,
              })
            }
            const g = groupMap.get(req.user_id)!
            g.requests.push(req)
            if (!seen.has(req.id)) g.hasSeen = false
          }
          setRequestGroups([...groupMap.values()])
        } catch {
          // item_requests-tabellen finnes ikke ennå
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const openGroup = async (group: RequestGroup) => {
    setActiveGroup(group)
    const unseenIds = group.requests.filter(r => !seenIds.has(r.id)).map(r => r.id)
    if (unseenIds.length === 0) return
    setSeenIds(prev => new Set([...prev, ...unseenIds]))
    setRequestGroups(prev =>
      prev.map(g => g.userId === group.userId ? { ...g, hasSeen: true } : g)
    )
    try {
      const supabase = createClient()
      await supabase.from('item_request_views').insert(
        unseenIds.map(id => ({ user_id: user.id, request_id: id }))
      )
    } catch { /* tabell mangler */ }
  }

  const countByCategory = (catId: string) => {
    if (catId === 'all') return feedItems.filter(i => i.available).length
    return feedItems.filter(i =>
      i.available && normalizeCategory(i.category) === catId
    ).length
  }

  const totalAvailable = feedItems.filter(i => i.available).length

  const feedCategories = [
    { id: 'all', label: 'Alle', emoji: '✨' },
    ...CATEGORIES.map((c: any) => ({ id: c.id, label: c.label, emoji: CAT_EMOJI[c.id] ?? '📦' })),
  ]

  const sortedCategories = [...feedCategories].sort((a, b) => {
    if (a.id === 'all') return -1
    if (b.id === 'all') return 1
    return countByCategory(b.id) - countByCategory(a.id)
  })

  const allFilteredItems = feedItems
    .filter(i => activeCategory === 'all' || normalizeCategory(i.category) === activeCategory)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const visibleItems = showAllItems ? allFilteredItems : allFilteredItems.slice(0, DEFAULT_VISIBLE)
  const hasMore = allFilteredItems.length > DEFAULT_VISIBLE

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
        <p className="text-[var(--terra-mid)] text-sm">Laster feed…</p>
      </div>
    )
  }

  const noFriends = friendCount === 0
  const noItems   = feedItems.length === 0
  const hasNewRequests = requestGroups.some(g => !g.hasSeen)

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* ── RequestStory-rad ── */}
        {requestGroups.length > 0 && (
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="font-display text-[var(--terra-dark)] text-base font-semibold">Kretsen trenger</h2>
              {hasNewRequests && (
                <span className="text-[10px] font-semibold text-[var(--terra)] uppercase tracking-wide">Nytt</span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
              {requestGroups.map(group => (
                <button key={group.userId} onClick={() => openGroup(group)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{
                    padding: '2px',
                    background: group.hasSeen ? 'rgba(156,123,101,0.3)' : 'var(--terra)',
                    opacity: group.hasSeen ? 0.55 : 1,
                    transition: 'opacity 300ms ease',
                  }}>
                    <div className="w-full h-full rounded-full bg-[#FAF7F2] flex items-center justify-center overflow-hidden" style={{ padding: '2px' }}>
                      {group.avatar_url
                        ? <img src={group.avatar_url} className="w-full h-full rounded-full object-cover" />
                        : <div className="w-full h-full rounded-full bg-[#E8DDD0] flex items-center justify-center text-sm font-bold text-[#6B4226]">
                            {group.name[0].toUpperCase()}
                          </div>
                      }
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--terra-dark)] text-center leading-tight w-full truncate">{group.name}</span>
                  {group.requests.length > 1 && (
                    <span className="text-[9px] text-[var(--terra-mid)]">{group.requests.length} ting</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tom tilstand: ingen venner ── */}
        {noFriends && (
          <div className="glass rounded-[20px] p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">🏘️</span>
            <div>
              <p className="font-display text-[var(--terra-dark)] text-lg font-semibold">Kretsen din er tom</p>
              <p className="text-[var(--terra-mid)] text-sm mt-1 leading-relaxed">Legg til venner for å se hva de har å låne ut.</p>
            </div>
            <div className="flex gap-3 mt-1">
              <Link href="/friends"><button className="btn-primary px-5 py-2.5 text-sm">Finn venner</button></Link>
              <Link href="/invite"><button className="btn-glass px-5 py-2.5 text-sm">Inviter</button></Link>
            </div>
          </div>
        )}

        {/* ── Tom tilstand: har venner, ingen items ── */}
        {!noFriends && noItems && (
          <div className="glass rounded-[20px] p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">📭</span>
            <div>
              <p className="font-display text-[var(--terra-dark)] text-lg font-semibold">Kretsen din er stille</p>
              <p className="text-[var(--terra-mid)] text-sm mt-1 leading-relaxed">Ingen har lagt ut noe ennå. Vær den første!</p>
            </div>
            <div className="flex gap-3 mt-1">
              <Link href="/add"><button className="btn-primary px-5 py-2.5 text-sm">+ Legg ut</button></Link>
              <Link href="/invite"><button className="btn-glass px-5 py-2.5 text-sm">Inviter flere</button></Link>
            </div>
          </div>
        )}

        {/* ── Feed med innhold ── */}
        {!noItems && (
          <>
            <div>
              <h2 className="font-display text-[var(--terra-dark)] text-xl font-semibold leading-tight">I kretsen din</h2>
              <p className="text-[var(--terra-mid)] text-sm mt-0.5">
                {totalAvailable > 0 ? `${totalAvailable} ting å låne` : 'Ingen ledige ting akkurat nå'}
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
                      if (cat.id !== 'all') track(Events.CATEGORY_FILTERED, { category: cat.id })
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
                    <span className={`text-xs font-medium leading-tight ${isActive ? 'text-white' : 'text-[var(--terra-dark)]'}`}>
                      {cat.label}
                    </span>
                    <span className={`text-[10px] font-semibold tabular-nums ${isActive ? 'text-white/80' : 'text-[var(--terra-mid)]'}`}>
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
                <h2 className="font-display text-[var(--terra-dark)] text-base font-semibold">Nylig lagt ut</h2>
                {allFilteredItems.length > 0 && (
                  <span className="text-[var(--terra-mid)] text-xs">
                    {showAllItems ? allFilteredItems.length : Math.min(DEFAULT_VISIBLE, allFilteredItems.length)} av {allFilteredItems.length}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {visibleItems.map(item => (
                  <Link key={item.id} href={`/items/${item.id}`}>
                    <div className="item-card glass-hover flex items-center gap-3 px-3 py-3" style={{ borderRadius: '16px', border: '1px solid rgba(196,103,58,0.18)' }}>
                      <div className="relative flex-shrink-0">
                        {item.image_url
                          ? <img src={item.image_url} className="w-14 h-14 rounded-[12px] object-cover" alt={item.name} />
                          : <div className="w-14 h-14 rounded-[12px] bg-[#E8DDD0] flex items-center justify-center text-2xl">
                              {CAT_EMOJI[normalizeCategory(item.category)] ?? '📦'}
                            </div>
                        }
                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: item.available ? 'var(--terra-green)' : 'var(--terra)' }} />
                      </div>
                      <div className="item-card-body flex-1 min-w-0" style={{ background: 'transparent' }}>
                        <p className="item-name font-display text-[var(--terra-dark)] text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-[var(--terra-mid)] mt-0.5 truncate">
                          {item.profiles?.name ?? 'Ukjent'} · {relativeTime(item.created_at)}
                        </p>
                      </div>
                      <span className="text-[var(--terra-mid)] text-sm flex-shrink-0">›</span>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <button onClick={() => setShowAllItems(v => !v)} className="btn-glass w-full mt-3 py-2.5 text-sm">
                  {showAllItems ? 'Vis færre' : `Se alle ${allFilteredItems.length} gjenstander`}
                </button>
              )}
            </div>

            <Link href="/invite">
              <div className="flex items-center justify-between p-4 mb-2" style={{ background: 'var(--terra)', borderRadius: '20px' }}>
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

      {activeGroup && (
        <RequestStoryViewer
          group={activeGroup}
          user={user}
          profile={profile}
          onClose={() => setActiveGroup(null)}
          onHarDette={() => {}}
        />
      )}

      <div className="nav-spacer" />
    </div>
  )
}
