'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

interface Item {
  id: string
  name: string
  image_url: string | null
  category: string
  available: boolean
}

interface StoryCreatorProps {
  onClose: () => void
  onCreated: () => void // refresh stories in parent
}

const CATEGORIES = [
  { id: 'barn',    label: 'Barn',     emoji: '🧸' },
  { id: 'kjole',   label: 'Kjoler',   emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy',  emoji: '🔧' },
  { id: 'bok',     label: 'Bøker',    emoji: '📚' },
  { id: 'annet',   label: 'Annet',    emoji: '📦' },
]
const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

type Step = 'type' | 'select' | 'order' | 'saving'

export default function StoryCreator({ onClose, onCreated }: StoryCreatorProps) {
  const [step, setStep] = useState<Step>('type')
  const [storyType, setStoryType] = useState<'category' | 'custom' | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [myItems, setMyItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<string[]>([]) // ordered item ids
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadItems = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('items')
        .select('id, name, image_url, category, available')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setMyItems(data || [])
    }
    loadItems()
  }, [])

  // When category type is chosen, pre-select all matching items
  const handleCategoryChosen = (catId: string) => {
    setSelectedCategory(catId)
    const matching = myItems
      .filter(i => i.category === catId)
      .map(i => i.id)
    setSelected(matching)
    setStep('select')
  }

  const toggleItem = (itemId: string) => {
    setSelected(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setSelected(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx: number) => {
    if (idx === selected.length - 1) return
    setSelected(prev => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const saveStory = async () => {
    if (selected.length === 0) { setError('Velg minst én gjenstand'); return }
    const title = storyType === 'category'
      ? (CATEGORIES.find(c => c.id === selectedCategory)?.label ?? selectedCategory ?? '')
      : customTitle.trim()
    if (!title) { setError('Gi storyen et navn'); return }

    setStep('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: story, error: storyErr } = await supabase
      .from('item_stories')
      .insert({
        owner_id: user.id,
        title,
        type: storyType,
        category: storyType === 'category' ? selectedCategory : null,
      })
      .select('id')
      .single()

    if (storyErr || !story) {
      setError('Noe gikk galt. Prøv igjen.')
      setStep('order')
      return
    }

    const slides = selected.map((itemId, idx) => ({
      story_id: story.id,
      item_id: itemId,
      sort_order: idx,
    }))
    await supabase.from('item_story_slides').insert(slides)

    track('story_created', {
      story_id: story.id,
      type: storyType,
      items_count: selected.length,
    })

    onCreated()
  }

  const visibleItems = storyType === 'category' && selectedCategory
    ? myItems.filter(i => i.category === selectedCategory)
    : myItems

  const orderedItems = selected.map(id => myItems.find(i => i.id === id)).filter(Boolean) as Item[]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000', maxWidth: 480, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          onClick={step === 'type' ? onClose : () => setStep(prev => {
            if (prev === 'order') return 'select'
            if (prev === 'select') return 'type'
            return 'type'
          })}
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', color: '#fff', flexShrink: 0 }}
        >
          {step === 'type'
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          }
        </button>
        <h1 className="font-display text-lg font-bold flex-1 text-center" style={{ color: '#fff' }}>
          {step === 'type' && 'Ny story'}
          {step === 'select' && 'Velg gjenstander'}
          {step === 'order' && 'Sorter rekkefølge'}
          {step === 'saving' && 'Lagrer…'}
        </h1>
        <div style={{ width: 36 }} />
      </div>

      {/* ── Step: Type ── */}
      {step === 'type' && (
        <div className="flex-1 flex flex-col px-5 pt-8">
          <p className="text-sm mb-6 text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Velg hva slags story du vil lage
          </p>

          {/* By category */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Etter kategori
            </p>
            <div className="flex flex-col gap-2">
              {CATEGORIES.filter(cat => myItems.some(i => i.category === cat.id)).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setStoryType('category')
                    handleCategoryChosen(cat.id)
                  }}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span style={{ fontSize: 28 }}>{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: '#fff' }}>{cat.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {myItems.filter(i => i.category === cat.id).length} gjenstander
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Egendefinert
            </p>
            <div className="mb-3">
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="F.eks. «Bryllup», «Baby 0–6 mnd»…"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                }}
              />
            </div>
            <button
              onClick={() => {
                if (!customTitle.trim()) { setError('Skriv et navn for storyen'); return }
                setError('')
                setStoryType('custom')
                setSelectedCategory(null)
                setSelected([])
                setStep('select')
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'rgba(196,103,58,0.8)', color: '#fff' }}
            >
              Lag egendefinert story →
            </button>
            {error && <p className="text-xs mt-2" style={{ color: '#F5A87C' }}>{error}</p>}
          </div>
        </div>
      )}

      {/* ── Step: Select items ── */}
      {step === 'select' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 pt-4">
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Trykk for å velge/fjerne. Valgte: {selected.length}
            </p>
            <div className="flex flex-col gap-2 pb-4">
              {visibleItems.map(item => {
                const isSelected = selected.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                    style={{
                      background: isSelected ? 'rgba(196,103,58,0.25)' : 'rgba(255,255,255,0.06)',
                      border: isSelected ? '1.5px solid rgba(196,103,58,0.6)' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 200ms',
                    }}
                  >
                    {item.image_url
                      ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                          style={{ width: 44, height: 44 }} alt={item.name} />
                      : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.1)' }}>
                          {CATEGORY_EMOJI[item.category] ?? '📦'}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: '#fff' }}>{item.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {item.available ? 'Ledig' : 'Utlånt'}
                      </p>
                    </div>
                    <div
                      className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 24, height: 24,
                        background: isSelected ? 'var(--terra)' : 'rgba(255,255,255,0.1)',
                        transition: 'background 200ms',
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="px-5 pb-safe pb-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => {
                if (selected.length === 0) { setError('Velg minst én gjenstand'); return }
                setError('')
                setStep('order')
              }}
              className="w-full py-4 rounded-2xl font-semibold text-base mt-3"
              style={{
                background: selected.length > 0 ? 'var(--terra)' : 'rgba(255,255,255,0.15)',
                color: '#fff',
              }}
            >
              Neste: Sorter rekkefølge ({selected.length})
            </button>
            {error && <p className="text-xs mt-2 text-center" style={{ color: '#F5A87C' }}>{error}</p>}
          </div>
        </div>
      )}

      {/* ── Step: Order ── */}
      {step === 'order' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 pt-4">
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Bestem rekkefølgen på gjenstander i storyen
            </p>

            {/* Custom title input if custom type */}
            {storyType === 'custom' && (
              <div className="mb-4">
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Storynavn</label>
                <input
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 pb-4">
              {orderedItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span className="text-sm font-bold w-5 text-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {idx + 1}
                  </span>
                  {item.image_url
                    ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                        style={{ width: 44, height: 44 }} alt={item.name} />
                    : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.1)' }}>
                        {CATEGORY_EMOJI[item.category] ?? '📦'}
                      </div>
                  }
                  <p className="font-medium text-sm flex-1 truncate" style={{ color: '#fff' }}>{item.name}</p>
                  {/* Up/down */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      style={{ opacity: idx === 0 ? 0.25 : 1, color: 'rgba(255,255,255,0.6)' }}
                      aria-label="Flytt opp"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === orderedItems.length - 1}
                      style={{ opacity: idx === orderedItems.length - 1 ? 0.25 : 1, color: 'rgba(255,255,255,0.6)' }}
                      aria-label="Flytt ned"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pb-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {error && <p className="text-xs mb-2 text-center" style={{ color: '#F5A87C' }}>{error}</p>}
            <button
              onClick={saveStory}
              className="w-full py-4 rounded-2xl font-semibold text-base mt-3"
              style={{ background: 'var(--terra)', color: '#fff' }}
            >
              Publiser story ✓
            </button>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {step === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">✨</div>
          <p className="font-display text-xl font-bold" style={{ color: '#fff' }}>Lagrer story…</p>
        </div>
      )}
    </div>
  )
}
