'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = {
  id: string
  name: string
  description: string
  image_url: string
  category: string
  available: boolean
  owner_id: string
  profiles: { name: string; email: string }
}

export default function FeedPage() {
  const [items, setItems] = useState<Item[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('alle')
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

  const categories = ['alle', 'baby', 'kjole', 'verktøy', 'bok', 'annet']
  const filtered = filter === 'alle' ? items : items.filter(i => i.category === filter)

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Header */}
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-8 pb-3 z-10">
        <div className="flex justify-between items-center mb-4">
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

        {/* Kategorifilter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                filter === c
                  ? 'bg-[#C4673A] text-white border-transparent'
                  : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              {c === 'alle' ? 'Alle' : c === 'baby' ? '🍼 Baby' : c === 'kjole' ? '👗 Kjoler' : c === 'verktøy' ? '🔧 Verktøy' : c === 'bok' ? '📚 Bøker' : 'Annet'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-[#9C7B65]">
            <div className="text-4xl mb-2">📭</div>
            <p>Ingen ting her ennå</p>
          </div>
        ) : (
          filtered.map(item => (
            <Link key={item.id} href={`/items/${item.id}`}>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-[#E8DDD0] flex items-center justify-center text-3xl">
                    {item.category === 'baby' ? '🍼' : item.category === 'kjole' ? '👗' : item.category === 'verktøy' ? '🔧' : item.category === 'bok' ? '📚' : '📦'}
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-[#2C1A0E] text-sm leading-tight">{item.name}</p>
                  <p className="text-xs text-[#4A7C59] font-medium mt-1">
                    {item.profiles?.name || item.profiles?.email?.split('@')[0]}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* FAB */}
      <Link href="/add">
        <button className="fixed bottom-6 right-6 bg-[#C4673A] text-white w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center">
          +
        </button>
      </Link>

    </div>
  )
}