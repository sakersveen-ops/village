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
  available: boolean
  owner_id: string
  created_at: string
  profiles: { name: string; email: string }
}

const CATEGORIES = [
  { id: 'baby',     label: 'Baby',     emoji: '🍼' },
  { id: 'kjole',    label: 'Kjoler',   emoji: '👗' },
  { id: 'verktøy',  label: 'Verktøy',  emoji: '🔧' },
  { id: 'bok',      label: 'Bøker',    emoji: '📚' },
  { id: 'annet',    label: 'Annet',    emoji: '📦' },
]

export default function FeedPage() {
  const [items, setItems] = useState<Item[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
    })

    supabase
      .from('items')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(data || [])
        setLoading(false)
      })
  }, [])

  const isNew = (item: Item) => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(item.created_at) > sevenDaysAgo
  }

  const countFor = (categoryId: string) =>
    items.filter(i => i.category === categoryId && i.available).length

  const filteredItems = activeCategory
    ? items.filter(i => i.category === activeCategory)
    : []

  // ── STEG 2: filtrert kategori-feed ──
  if (activeCategory) {
    const cat = CATEGORIES.find(c => c.id === activeCategory)
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-3 z-10">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className="text-[#C4673A] text-sm"
            >
              ← Tilbake
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{cat?.emoji}</span>
            <h1 className="text-xl font-bold text-[#2C1A0E]">{cat?.label}</h1>
            <span className="text-sm text-[#9C7B65] ml-1">{filteredItems.filter(i => i.available).length} tilgjengelig</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-[#9C7B65]">
              <div className="text-4xl mb-2">{cat?.emoji}</div>
              <p>Ingen {cat?.label.toLowerCase()} i kretsen ennå</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <Link key={item.id} href={`/items/${item.id}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm relative">
                  {/* Ny-badge */}
                  {isNew(item) && (
                    <div className="absolute top-2 left-2 z-10 bg-[#C4673A] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Ny
                    </div>
                  )}
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-[#E8DDD0] flex items-center justify-center text-3xl">
                      {cat?.emoji}
                    </div>
                  )}
                  {!item.available && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="text-white text-xs font-bold tracking-wide">UTLÅNT</span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold text-[#2C1A0E] text-sm leading-tight">{item.name}</p>
                    <p className={`text-xs font-medium mt-1 ${item.profiles ? 'text-[#4A7C59]' : 'text-[#C4673A]'}`}>
                      {item.profiles?.name || item.profiles?.email?.split('@')[0]}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── STEG 1: kategori-grid ──
  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">Village</h1>
            <p className="text-xs text-[#9C7B65]">Lån og lån bort i kretsen din</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/invite">
              <button className="text-sm text-[#C4673A] font-medium border border-[#C4673A] rounded-full px-3 py-1">
                + Inviter
              </button>
            </Link>
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-[#C4673A] flex items-center justify-center text-white font-bold text-sm cursor-pointer">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Kategori-grid */}
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const count = countFor(cat.id)
                const newCount = items.filter(i => i.category === cat.id && isNew(i)).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="bg-white rounded-2xl p-5 shadow-sm text-left flex flex-col gap-2 active:scale-95 transition-transform"
                  >
                    <span className="text-3xl">{cat.emoji}</span>
                    <div>
                      <p className="font-bold text-[#2C1A0E]">{cat.label}</p>
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

            {/* Siste aktivitet */}
            {items.filter(isNew).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold text-[#2C1A0E] mb-3">🆕 Nylig lagt ut</p>
                <div className="flex flex-col gap-2">
                  {items.filter(isNew).slice(0, 3).map(item => {
                    const cat = CATEGORIES.find(c => c.id === item.category)
                    return (
                      <Link key={item.id} href={`/items/${item.id}`}>
                        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                          {item.image_url ? (
                            <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[#E8DDD0] flex items-center justify-center text-xl">
                              {cat?.emoji}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-[#2C1A0E] text-sm">{item.name}</p>
                            <p className="text-xs text-[#4A7C59] mt-0.5">
                              {item.profiles?.name || item.profiles?.email?.split('@')[0]}
                            </p>
                          </div>
                          <span className="text-xs text-[#C4673A] font-bold">{cat?.emoji}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>



      {/* FAB */}
      <Link href="/add">
        <button className="fixed bottom-20 right-6 bg-[#C4673A] text-white w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center">
          +
        </button>
      </Link>
    </div>
  )
}