'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const ACCESS_LEVELS = [
  { id: 'close_friends', label: 'Nære venner', emoji: '❤️', description: 'Kun de du har merket som nære venner' },
  { id: 'friends', label: 'Venner', emoji: '👥', description: 'Alle du er venner med' },
  { id: 'friends_of_friends', label: 'Venners venner', emoji: '🌐', description: 'Venner og deres venner' },
  { id: 'community', label: 'Spesifikke kretser', emoji: '🏘️', description: 'Velg hvilke kretser som kan låne' },
  { id: 'public', label: 'Alle', emoji: '🌍', description: 'Synlig for alle på Village' },
]

const PRICE_TYPES = [
  { id: 'per_day', label: 'per dag' },
  { id: 'per_week', label: 'per uke' },
  { id: 'fixed', label: 'engangsbeløp' },
]

type AccessEntry = {
  access_type: string
  community_id?: string
  price?: number
  price_type: string
}

function AccessPageInner() {
  const [communities, setCommunities] = useState<any[]>([])
  const [selectedLevels, setSelectedLevels] = useState<AccessEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = searchParams.get('item')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: memberships } = await supabase
        .from('community_members')
        .select('communities(id, name, avatar_emoji)')
        .eq('user_id', user.id)
        .eq('status', 'active')
      setCommunities((memberships || []).map((m: any) => m.communities))

      // Hent eksisterende tilgang hvis redigering
      if (itemId) {
        const { data: existing } = await supabase
          .from('item_access')
          .select('*')
          .eq('item_id', itemId)
        if (existing && existing.length > 0) {
          setSelectedLevels(existing.map((e: any) => ({
            access_type: e.access_type,
            community_id: e.community_id,
            price: e.price,
            price_type: e.price_type || 'per_day',
          })))
        } else {
          // Standard: venner, gratis
          setSelectedLevels([{ access_type: 'friends', price_type: 'per_day' }])
        }
      }
      setLoading(false)
    }
    load()
  }, [itemId])

  const toggleLevel = (levelId: string, communityId?: string) => {
    const key = communityId ? `community_${communityId}` : levelId
    const exists = selectedLevels.find(l =>
      communityId ? l.community_id === communityId : l.access_type === levelId && !l.community_id
    )
    if (exists) {
      setSelectedLevels(prev => prev.filter(l =>
        communityId ? l.community_id !== communityId : !(l.access_type === levelId && !l.community_id)
      ))
    } else {
      setSelectedLevels(prev => [...prev, {
        access_type: levelId,
        community_id: communityId,
        price_type: 'per_day',
      }])
    }
  }

  const updatePrice = (levelId: string, communityId: string | undefined, price: string) => {
    setSelectedLevels(prev => prev.map(l => {
      const match = communityId ? l.community_id === communityId : l.access_type === levelId && !l.community_id
      return match ? { ...l, price: price ? parseInt(price) : undefined } : l
    }))
  }

  const updatePriceType = (levelId: string, communityId: string | undefined, priceType: string) => {
    setSelectedLevels(prev => prev.map(l => {
      const match = communityId ? l.community_id === communityId : l.access_type === levelId && !l.community_id
      return match ? { ...l, price_type: priceType } : l
    }))
  }

  const save = async () => {
    if (!itemId) return
    setSaving(true)
    const supabase = createClient()

    await supabase.from('item_access').delete().eq('item_id', itemId)

    if (selectedLevels.length > 0) {
      await supabase.from('item_access').insert(
        selectedLevels.map(l => ({
          item_id: itemId,
          access_type: l.access_type,
          community_id: l.community_id || null,
          price: l.price || null,
          price_type: l.price_type,
        }))
      )
    }

    router.push(`/items/${itemId}`)
  }

  const skip = () => router.push(itemId ? `/items/${itemId}` : '/')

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  const showCommunities = selectedLevels.some(l => l.access_type === 'community')

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-32">
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-1">Hvem kan låne dette?</h1>
      <p className="text-sm text-[#9C7B65] mb-6">Velg en eller flere grupper og sett pris per gruppe</p>

      <div className="flex flex-col gap-3">
        {ACCESS_LEVELS.map(level => {
          const entry = selectedLevels.find(l => l.access_type === level.id && !l.community_id)
          const selected = !!entry

          return (
            <div key={level.id}>
              <button
                onClick={() => toggleLevel(level.id)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm text-left transition-colors ${
                  selected ? 'bg-[#FFF0E6] border border-[#C4673A]' : 'bg-white border border-transparent'
                }`}
              >
                <span className="text-2xl">{level.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#2C1A0E] text-sm">{level.label}</p>
                  <p className="text-xs text-[#9C7B65] mt-0.5">{level.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-[#C4673A] border-[#C4673A]' : 'border-[#E8DDD0]'
                }`}>
                  {selected && <span className="text-white text-xs">✓</span>}
                </div>
              </button>

              {/* Pris for denne gruppen */}
              {selected && (
                <div className="mx-2 bg-[#FAF7F2] rounded-b-2xl px-4 py-3 flex items-center gap-2 border border-t-0 border-[#C4673A]">
                  <input
                    type="number"
                    placeholder="Gratis"
                    value={entry?.price || ''}
                    onChange={e => updatePrice(level.id, undefined, e.target.value)}
                    className="flex-1 bg-white border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm text-[#2C1A0E] outline-none focus:border-[#C4673A]"
                  />
                  <span className="text-xs text-[#9C7B65]">kr</span>
                  <select
                    value={entry?.price_type || 'per_day'}
                    onChange={e => updatePriceType(level.id, undefined, e.target.value)}
                    className="bg-white border border-[#E8DDD0] rounded-xl px-2 py-2 text-xs text-[#2C1A0E] outline-none"
                  >
                    {PRICE_TYPES.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kretser-velger */}
              {level.id === 'community' && showCommunities && (
                <div className="mt-2 flex flex-col gap-2 pl-2">
                  {communities.length === 0 ? (
                    <p className="text-xs text-[#9C7B65] px-2">Du er ikke med i noen kretser ennå</p>
                  ) : (
                    communities.map((c: any) => {
                      const cEntry = selectedLevels.find(l => l.community_id === c.id)
                      const cSelected = !!cEntry
                      return (
                        <div key={c.id}>
                          <button
                            onClick={() => toggleLevel('community', c.id)}
                            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm text-left transition-colors ${
                              cSelected ? 'bg-[#FFF0E6] border border-[#C4673A]' : 'bg-white border border-transparent'
                            }`}
                          >
                            <span className="text-lg">{c.avatar_emoji}</span>
                            <p className="flex-1 font-medium text-[#2C1A0E] text-sm">{c.name}</p>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              cSelected ? 'bg-[#C4673A] border-[#C4673A]' : 'border-[#E8DDD0]'
                            }`}>
                              {cSelected && <span className="text-white text-xs">✓</span>}
                            </div>
                          </button>
                          {cSelected && (
                            <div className="mx-2 bg-[#FAF7F2] rounded-b-2xl px-4 py-3 flex items-center gap-2 border border-t-0 border-[#C4673A]">
                              <input
                                type="number"
                                placeholder="Gratis"
                                value={cEntry?.price || ''}
                                onChange={e => updatePrice('community', c.id, e.target.value)}
                                className="flex-1 bg-white border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm text-[#2C1A0E] outline-none focus:border-[#C4673A]"
                              />
                              <span className="text-xs text-[#9C7B65]">kr</span>
                              <select
                                value={cEntry?.price_type || 'per_day'}
                                onChange={e => updatePriceType('community', c.id, e.target.value)}
                                className="bg-white border border-[#E8DDD0] rounded-xl px-2 py-2 text-xs text-[#2C1A0E] outline-none"
                              >
                                {PRICE_TYPES.map(pt => (
                                  <option key={pt.id} value={pt.id}>{pt.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-[#FAF7F2] border-t border-[#E8DDD0] flex gap-3">
        <button
          onClick={skip}
          className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-3 font-medium text-sm"
        >
          Hopp over
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-2 flex-grow bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Lagrer…' : 'Lagre tilgang'}
        </button>
      </div>
    </div>
  )
}

export default function AccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#9C7B65]">Laster…</div>}>
      <AccessPageInner />
    </Suspense>
  )
}