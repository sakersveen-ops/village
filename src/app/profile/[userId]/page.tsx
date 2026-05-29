// Path of this file: src/app/profile/[userId]/items/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'hjem-og-hage',          label: 'Hjem & hage',        emoji: '🏠' },
  { id: 'baby-og-barn',          label: 'Baby & barn',        emoji: '🧸' },
  { id: 'fest-og-arrangement',   label: 'Fest & arrangement', emoji: '🎉' },
  { id: 'friluft-og-sport',      label: 'Friluft & sport',    emoji: '⛷️' },
  { id: 'klar-og-mote',          label: 'Klær & mote',        emoji: '👗' },
  { id: 'boker',                 label: 'Bøker',              emoji: '📚' },
]

const CATEGORY_EMOJI: Record<string, string> = {
  'hjem-og-hage':        '🏠',
  'baby-og-barn':        '🧸',
  'fest-og-arrangement': '🎉',
  'friluft-og-sport':    '⛷️',
  'klar-og-mote':        '👗',
  'boker':               '📚',
}

type SortKey = 'newest' | 'oldest' | 'name' | 'available'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Nyeste' },
  { id: 'oldest', label: 'Eldste' },
  { id: 'name', label: 'Navn A–Å' },
  { id: 'available', label: 'Ledig først' },
]

export default function UserItemsPage() {
  const [items, setItems] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategory, setItemCategory] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const router = useRouter()
  const { userId } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Redirect to own manage page if viewing own profile
      if (userId === user.id) { router.push('/items/manage'); return }

      // Must be friends to see items
      const { data: friendship } = await supabase
        .from('friendships').select('id').eq('user_a', user.id).eq('user_b', userId).maybeSingle()
      if (!friendship) { router.push(`/profile/${userId}`); return }

      const { data: targetProfile } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      setProfile(targetProfile)

      // Load communities for access filtering
      const { data: myMemberships } = await supabase
        .from('community_members').select('community_id').eq('user_id', user.id).eq('status', 'active')
      const myComIds = new Set((myMemberships || []).map((m: any) => m.community_id))

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
      setLoading(false)
    }
    load()
  }, [userId])

  const displayName = (p: any) => p?.name || p?.username || p?.email?.split('@')[0]

  const availableCategories = CATEGORIES.filter(c => items.some(i => i.category === c.id))

  const filtered = items.filter(item => {
    const matchSearch = itemSearch.trim().length < 2 ||
      item.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(itemSearch.toLowerCase())
    const matchCat = !itemCategory || item.category === itemCategory
    return matchSearch && matchCat
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortKey === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortKey === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'no')
    if (sortKey === 'available') return (b.available ? 1 : 0) - (a.available ? 1 : 0)
    return 0
  })

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <Link href={`/profile/${userId}`} aria-label="Tilbake">
          <span className="w-9 h-9 flex items-center justify-center rounded-full shadow-sm"
            style={{ background: '#fff', border: '1px solid var(--glass-border)', color: '#1A3542' }}>
            ←
          </span>
        </Link>
        <span className="text-sm font-semibold" style={{ color: 'var(--terra-dark)' }}>
          {profile ? `${displayName(profile)}s gjenstander` : 'Gjenstander'}
        </span>
        <div style={{ width: 36 }} /> {/* spacer for centering */}
      </header>

      <div className="px-4 pt-4">

        {/* Stats + sort */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            {items.length} gjenstander
          </p>
          <div className="flex gap-1.5 overflow-x-auto">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setSortKey(opt.id)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-colors"
                style={sortKey === opt.id
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#1A3542', border: '1px solid var(--glass-border)' }
                }>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        {items.length > 5 && (
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
              placeholder="Søk i gjenstander…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid var(--glass-border)', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            />
          </div>
        )}

        {/* Category filter */}
        {availableCategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setItemCategory('')}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
              style={!itemCategory
                ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                : { background: '#fff', color: '#1A3542', border: '1px solid var(--glass-border)' }
              }>
              Alle
            </button>
            {availableCategories.map(cat => (
              <button key={cat.id} onClick={() => setItemCategory(itemCategory === cat.id ? '' : cat.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
                style={itemCategory === cat.id
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#1A3542', border: '1px solid var(--glass-border)' }
                }>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl p-6 text-center text-sm" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
            {items.length === 0 ? 'Ingen gjenstander delt ennå' : 'Ingen treff på søket'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map(item => (
              <Link key={item.id} href={`/items/${item.id}`}>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm" style={{ background: '#fff' }}>
                  {item.image_url
                    ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                        style={{ width: 48, height: 48 }} alt={item.name} />
                    : <div className="flex items-center justify-center text-xl flex-shrink-0 rounded-xl"
                        style={{ width: 48, height: 48, background: 'var(--glass-border)' }}>
                        {CATEGORY_EMOJI[item.category] ?? '📦'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                      {CATEGORY_EMOJI[item.category] ?? '📦'}{' '}
                      {CATEGORIES.find(c => c.id === item.category)?.label || item.category?.replace(/-/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={item.available
                      ? { background: '#EEF4F0', color: 'var(--terra-green)' }
                      : { background: 'var(--glass-bg)', color: 'var(--terra)' }
                    }>
                    {item.available ? 'Ledig' : 'Utlånt'}
                  </span>
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

      <div className="nav-spacer" />
    </div>
  )
}
