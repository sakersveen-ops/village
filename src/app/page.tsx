'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = {
  id: string
  name: string
  image_url: string
  category: string
  subcategory?: string
  available: boolean
  owner_id: string
  created_at: string
  description?: string
  price?: number
  profiles: { name: string; email: string; avatar_url?: string }
}

const CATEGORIES = [
  { id: 'barn', label: 'Barn', emoji: '🧸', subcategories: ['Spise', 'Leke', 'Tur', 'Stelle', 'Sove', 'Bade', 'Klær'] },
  { id: 'kjole', label: 'Kjoler', emoji: '👗', subcategories: [] },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧', subcategories: [] },
  { id: 'bok', label: 'Bøker', emoji: '📚', subcategories: [] },
  { id: 'annet', label: 'Annet', emoji: '📦', subcategories: [] },
]

export default function FeedPage() {
  const [items, setItems] = useState<Item[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: friendships } = await supabase
        .from('friendships').select('user_b').eq('user_a', user.id)
      const friendIds = (friendships || []).map((f: any) => f.user_b)

      let friendsOfFriendIds: string[] = []
      if (friendIds.length > 0) {
        const { data: fof } = await supabase
          .from('friendships').select('user_b').in('user_a', friendIds).neq('user_b', user.id)
        friendsOfFriendIds = [...new Set((fof || []).map((f: any) => f.user_b))]
      }

      const { data: closeFriendRows } = await supabase
        .from('close_friends').select('friend_id').eq('user_id', user.id)
      const closeFriendIds = (closeFriendRows || []).map((f: any) => f.friend_id)

      const { data: myMemberships } = await supabase
        .from('community_members').select('community_id').eq('user_id', user.id).eq('status', 'active')
      const myCommunityIds = (myMemberships || []).map((m: any) => m.community_id)

      const { data: allItems } = await supabase
        .from('items')
        .select('*, profiles(name, email, avatar_url), item_access(*)')
        .order('created_at', { ascending: false })

      const visible = (allItems || []).filter((item: any) => {
        if (item.owner_id === user.id) return true
        const access: any[] = item.item_access || []
        if (access.length === 0) return true
        return access.some((rule: any) => {
          if (rule.access_type === 'public') return true
          if (rule.access_type === 'close_friends' && closeFriendIds.includes(item.owner_id)) return true
          if (rule.access_type === 'friends' && friendIds.includes(item.owner_id)) return true
          if (rule.access_type === 'friends_of_friends' &&
            (friendIds.includes(item.owner_id) || friendsOfFriendIds.includes(item.owner_id))) return true
          if (rule.access_type === 'community' && rule.community_id && myCommunityIds.includes(rule.community_id)) return true
          return false
        })
      })

      setItems(visible)
      setLoading(false)
    }
    load()
  }, [])

  const isNew = (item: Item) => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(item.created_at) > sevenDaysAgo
  }

  const countFor = (categoryId: string) =>
    items.filter(i => (i.category === categoryId || (categoryId === 'barn' && i.category === 'baby')) && i.available).length

  const searchResults = searchQuery.trim().length >= 2
    ? items.filter(i => {
        const q = searchQuery.toLowerCase()
        return i.name?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      })
    : []

  const isSearching = searchQuery.trim().length >= 2

  const ItemCard = ({ item }: { item: Item }) => {
    const cat = CATEGORIES.find(c => c.id === item.category || (c.id === 'barn' && item.category === 'baby'))
    return (
      <Link href={`/items/${item.id}`}>
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          {item.image_url ? (
            <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#E8DDD0] flex items-center justify-center text-xl flex-shrink-0">
              {cat?.emoji || '📦'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#2C1A0E] text-sm truncate">{item.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-4 h-4 rounded-full bg-[#E8DDD0] flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.profiles?.avatar_url
                  ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" />
                  : <span className="font-bold text-[#6B4226]" style={{ fontSize: '8px' }}>{(item.profiles?.name || item.profiles?.email)?.[0]?.toUpperCase()}</span>}
              </div>
              <p className="text-xs text-[#4A7C59] truncate">
                {item.profiles?.name || item.profiles?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-sm">{cat?.emoji}</span>
            {!item.available && (
              <span className="text-xs text-[#C4673A] font-medium">Utlånt</span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  const cat = CATEGORIES.find(c => c.id === activeCategory)

  const filteredItems = activeCategory
    ? items.filter(i => {
        const matchCat = i.category === activeCategory || (activeCategory === 'barn' && i.category === 'baby')
        const matchSub = activeSubcategory ? i.subcategory === activeSubcategory : true
        return matchCat && matchSub
      })
    : []

  // ── SØKEVISNING ──
  if (isSearching) {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                placeholder="Søk på navn eller beskrivelse…"
                className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-[#9C7B65] px-2"
            >
              Avbryt
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 flex flex-col gap-2">
          {searchResults.length > 0 ? (
            <>
              <p className="text-xs text-[#9C7B65] mb-1">{searchResults.length} treff på "{searchQuery}"</p>
              {searchResults.map(item => <ItemCard key={item.id} item={item} />)}
              <Link href={`/watches?q=${encodeURIComponent(searchQuery)}`}>
                <div className="mt-3 bg-white border border-dashed border-[#C4673A] rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">🔔</span>
                  <div>
                    <p className="text-sm font-medium text-[#C4673A]">Få varsel om flere treff</p>
                    <p className="text-xs text-[#9C7B65]">Opprett søkevarsel for "{searchQuery}"</p>
                  </div>
                </div>
              </Link>
            </>
          ) : (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <div className="text-4xl">🔍</div>
              <p className="font-medium text-[#2C1A0E]">Ingen treff på "{searchQuery}"</p>
              <p className="text-sm text-[#9C7B65]">Vil du få varsel hvis noen legger det ut?</p>
              <Link href={`/watches?q=${encodeURIComponent(searchQuery)}`}>
                <button className="bg-[#C4673A] text-white rounded-xl px-6 py-2.5 text-sm font-medium mt-1">
                  🔔 Opprett søkevarsel
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── KATEGORI-FEED ──
  if (activeCategory && cat) {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-3 z-10">
          <button
            onClick={() => { setActiveCategory(null); setActiveSubcategory(null) }}
            className="text-[#C4673A] text-sm mb-2 block"
          >
            ← Tilbake
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{cat.emoji}</span>
            <h1 className="text-xl font-bold text-[#2C1A0E]">{cat.label}</h1>
            <span className="text-sm text-[#9C7B65] ml-1">
              {filteredItems.filter(i => i.available).length} tilgjengelig
            </span>
          </div>
          {cat.subcategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors flex-shrink-0 ${!activeSubcategory ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'}`}
              >
                Alle
              </button>
              {cat.subcategories.map(sub => (
                <button
                  key={sub}
                  onClick={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors flex-shrink-0 ${activeSubcategory === sub ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'}`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-[#9C7B65]">
              <div className="text-4xl mb-2">{cat.emoji}</div>
              <p>Ingen {cat.label.toLowerCase()} tilgjengelig for deg</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <Link key={item.id} href={`/items/${item.id}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm relative">
                  {isNew(item) && (
                    <div className="absolute top-2 left-2 z-10 bg-[#C4673A] text-white text-xs font-bold px-2 py-0.5 rounded-full">Ny</div>
                  )}
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-[#E8DDD0] flex items-center justify-center text-3xl">{cat.emoji}</div>
                  )}
                  {!item.available && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="text-white text-xs font-bold tracking-wide">UTLÅNT</span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold text-[#2C1A0E] text-sm leading-tight truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#E8DDD0] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.profiles?.avatar_url
                          ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" />
                          : <span className="text-xs font-bold text-[#6B4226]">{(item.profiles?.name || item.profiles?.email)?.[0]?.toUpperCase()}</span>}
                      </div>
                      <p className="text-xs text-[#4A7C59] font-medium truncate">
                        {item.profiles?.name || item.profiles?.email?.split('@')[0]}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── KATEGORI-GRID ──
  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">VILLAGE</h1>
            <p className="text-xs text-[#9C7B65]">Lån og lån bort i kretsen din</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/invite">
              <button className="text-sm text-[#C4673A] font-medium border border-[#C4673A] rounded-full px-3 py-1">
                + Inviter
              </button>
            </Link>
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-sm cursor-pointer overflow-hidden">
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
                  : user?.email?.[0]?.toUpperCase()}
              </div>
            </Link>
          </div>
        </div>

        {/* Søkefelt */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Søk etter gjenstander…"
            className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
          />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const count = countFor(cat.id)
                const newCount = items.filter(i =>
                  (i.category === cat.id || (cat.id === 'barn' && i.category === 'baby')) && isNew(i)
                ).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="bg-white rounded-2xl p-4 shadow-sm text-left flex flex-col gap-2 active:scale-95 transition-transform"
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <div>
                      <p className="font-bold text-[#2C1A0E] text-sm">{cat.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#9C7B65]">{count} tilgjengelig</p>
                        {newCount > 0 && (
                          <span className="bg-[#FFF0E6] text-[#C4673A] text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {newCount} ny
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {items.filter(isNew).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold text-[#2C1A0E] mb-3">🆕 Nylig lagt ut</p>
                <div className="flex flex-col gap-2">
                  {items.filter(isNew).slice(0, 3).map(item => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}