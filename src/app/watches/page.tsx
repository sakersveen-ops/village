'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { id: 'barn', label: 'Barn', emoji: '🧸' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

export default function WatchesPage() {
  const [watches, setWatches] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableTo, setAvailableTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data } = await supabase
        .from('item_watches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setWatches(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    if (!query.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('item_watches').insert({
      user_id: user.id,
      query,
      max_price: maxPrice ? parseInt(maxPrice) : null,
      category: category || null,
      location: location || null,
      available_from: availableFrom || null,
      available_to: availableTo || null,
    }).select().single()

    if (data) setWatches(prev => [data, ...prev])
    setQuery('')
    setMaxPrice('')
    setCategory('')
    setLocation('')
    setAvailableFrom('')
    setAvailableTo('')
    setShowForm(false)
    setSaving(false)
  }

  const deleteWatch = async (id: string) => {
    const supabase = createClient()
    await supabase.from('item_watches').delete().eq('id', id)
    setWatches(prev => prev.filter(w => w.id !== id))
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })

  const watchLabel = (w: any) => {
    const parts = []
    if (w.category) {
      const cat = CATEGORIES.find(c => c.id === w.category)
      if (cat) parts.push(`${cat.emoji} ${cat.label}`)
    }
    if (w.max_price) parts.push(`maks ${w.max_price} kr`)
    if (w.location) parts.push(`📍 ${w.location}`)
    if (w.available_from) parts.push(`fra ${formatDate(w.available_from)}`)
    if (w.available_to) parts.push(`til ${formatDate(w.available_to)}`)
    return parts.join(' · ')
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[#2C1A0E]">Søkevarsler</h1>
            <p className="text-xs text-[#9C7B65] mt-0.5">Få varsel når noen legger ut det du leter etter</p>
          </div>
          <button
            onClick={() => setShowForm(f => !f)}
            className="bg-[#C4673A] text-white rounded-full px-4 py-2 text-sm font-medium"
          >
            + Nytt
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Skjema */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <p className="font-semibold text-[#2C1A0E]">Nytt søkevarsel</p>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Søkeord *</label>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="eks. barnevogn, kjole str 38, drill…"
                className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Kategori</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategory('')}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${!category ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'}`}
                >
                  Alle
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id === category ? '' : cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${category === cat.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'}`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Maks pris (kr)</label>
                <input
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  type="number"
                  placeholder="La stå for alle"
                  className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Lokasjon</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="eks. Grünerløkka"
                  className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Tilgjengelig fra</label>
                <input
                  type="date"
                  value={availableFrom}
                  onChange={e => setAvailableFrom(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Tilgjengelig til</label>
                <input
                  type="date"
                  value={availableTo}
                  onChange={e => setAvailableTo(e.target.value)}
                  min={availableFrom || new Date().toISOString().split('T')[0]}
                  className="bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl px-3 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2.5 text-sm"
              >
                Avbryt
              </button>
              <button
                onClick={save}
                disabled={saving || !query.trim()}
                className="flex-1 bg-[#C4673A] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Lagrer…' : 'Lagre varsel'}
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />
          ))
        ) : watches.length === 0 && !showForm ? (
          <div className="text-center py-16 text-[#9C7B65]">
            <div className="text-4xl mb-2">🔔</div>
            <p className="font-medium text-[#2C1A0E] mb-1">Ingen søkevarsler ennå</p>
            <p className="text-sm">Opprett et varsel så får du beskjed når noen legger ut det du leter etter</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 bg-[#C4673A] text-white rounded-xl px-6 py-2.5 text-sm font-medium"
            >
              + Opprett varsel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {watches.map(w => (
              <div key={w.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2C1A0E] text-sm">🔍 {w.query}</p>
                    {watchLabel(w) && (
                      <p className="text-xs text-[#9C7B65] mt-1">{watchLabel(w)}</p>
                    )}
                    <p className="text-xs text-[#9C7B65] mt-1">Opprettet {formatDate(w.created_at)}</p>
                  </div>
                  <button
                    onClick={() => deleteWatch(w.id)}
                    className="text-[#9C7B65] text-lg flex-shrink-0 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}