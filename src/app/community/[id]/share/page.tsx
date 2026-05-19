'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const CATEGORIES = [
  { id: 'baby', label: 'Barn', emoji: '🍼' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

export default function ShareWithCommunityPage() {
  const [items, setItems] = useState<any[]>([])
  const [community, setCommunity] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: community } = await supabase
        .from('communities').select('*').eq('id', id).single()
      setCommunity(community)

      const { data: items } = await supabase
        .from('items').select('*').eq('owner_id', user.id)
      setItems(items || [])

      // Allerede delte
      const alreadyShared = (items || []).filter((i: any) => i.community_id === id)
      setSelectedIds(new Set(alreadyShared.map((i: any) => i.id)))

      setLoading(false)
    }
    load()
  }, [id])

  const toggleItem = (itemId: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(itemId) ? n.delete(itemId) : n.add(itemId)
      return n
    })
  }

  const toggleCategory = (categoryId: string) => {
    const categoryItems = items.filter(i => i.category === categoryId).map(i => i.id)
    const allSelected = categoryItems.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSelected) {
        categoryItems.forEach(id => n.delete(id))
        setSelectedCategories(c => { const nc = new Set(c); nc.delete(categoryId); return nc })
      } else {
        categoryItems.forEach(id => n.add(id))
        setSelectedCategories(c => new Set([...c, categoryId]))
      }
      return n
    })
  }

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    // Fjern alle fra denne kretsen
    await supabase.from('items').update({ community_id: null })
      .eq('community_id', id)
    // Sett valgte
    if (selectedIds.size > 0) {
      await supabase.from('items').update({ community_id: id })
        .in('id', [...selectedIds])
    }
    router.push(`/community/${id}`)
  }

  const groupedItems = CATEGORIES.map(cat => ({
    ...cat,
    items: items.filter(i => i.category === cat.id)
  })).filter(g => g.items.length > 0)

  if (loading) return <div className="p-8 text-center text-[var(--terra-mid)]">Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-32">
      <div className="sticky top-0 bg-[var(--glass-bg-heavy)] border-b border-[var(--glass-border)] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[var(--terra)] text-sm mb-2 block">← Tilbake</button>
        <h1 className="text-xl font-bold text-[var(--terra-dark)]">Del med {community?.name}</h1>
        <p className="text-sm text-[var(--terra-mid)] mt-0.5">{selectedIds.size} gjenstander valgt</p>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-[var(--terra-mid)] text-sm">
            Du har ingen gjenstander å dele ennå
          </div>
        ) : (
          groupedItems.map(group => (
            <div key={group.id}>
              {/* Kategori-header med velg-alle */}
              <button
                onClick={() => toggleCategory(group.id)}
                className="flex items-center gap-2 mb-2 w-full"
              >
                <span>{group.emoji}</span>
                <span className="font-semibold text-[var(--terra-dark)] text-sm flex-1 text-left">{group.label}</span>
                <span className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  group.items.every(i => selectedIds.has(i.id))
                    ? 'bg-[var(--terra)] text-white border-transparent'
                    : 'bg-white text-[var(--terra-mid)] border-[var(--glass-border)]'
                }`}>
                  Velg alle
                </span>
              </button>

              <div className="flex flex-col gap-2">
                {group.items.map(item => {
                  const selected = selectedIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm transition-colors text-left ${
                        selected ? 'bg-[#FFF0E6] border border-[var(--terra)]' : 'bg-white border border-transparent'
                      }`}
                    >
                      {item.image_url ? (
                        <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[var(--glass-border)] flex items-center justify-center text-xl flex-shrink-0">
                          {group.emoji}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--terra-dark)] text-sm truncate">{item.name}</p>
                        {item.price && <p className="text-xs text-[var(--terra-mid)] mt-0.5">{item.price} kr/dag</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[var(--glass-border)]'
                      }`}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--glass-bg-heavy)] border-t border-[var(--glass-border)]">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-[var(--terra)] text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Lagrer…' : `Del ${selectedIds.size} gjenstander med kretsen`}
        </button>
      </div>
    </div>
  )
}