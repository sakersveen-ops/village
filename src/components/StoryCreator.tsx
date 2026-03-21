'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

interface Item {
  id: string
  name: string
  image_url: string | null
  category: string
  available: boolean
  next_available?: string | null
}

export interface ExistingStory {
  id: string
  title: string
  cover_url: string | null
  cover_text: string | null
  slides: {
    item_id: string
    sort_order: number
    caption: string | null
  }[]
}

interface StoryCreatorProps {
  onClose: () => void
  onCreated: () => void
  existingStory?: ExistingStory  // present = edit mode
}

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

type Step = 'select' | 'order' | 'cover' | 'saving'

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

export default function StoryCreator({ onClose, onCreated, existingStory }: StoryCreatorProps) {
  const isEditing = !!existingStory

  const [step, setStep] = useState<Step>('select')
  const [title, setTitle] = useState(existingStory?.title ?? '')
  const [myItems, setMyItems] = useState<Item[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selected, setSelected] = useState<string[]>(
    existingStory ? [...existingStory.slides].sort((a, b) => a.sort_order - b.sort_order).map(s => s.item_id) : []
  )
  const [captions, setCaptions] = useState<Record<string, string>>(
    existingStory
      ? Object.fromEntries(existingStory.slides.filter(s => s.caption).map(s => [s.item_id, s.caption!]))
      : {}
  )
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Cover — pre-fill from existing
  const [coverUrl, setCoverUrl] = useState<string | null>(existingStory?.cover_url ?? null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverText, setCoverText] = useState(existingStory?.cover_text ?? '')
  const [coverUploading, setCoverUploading] = useState(false)
  const [savedStoryId, setSavedStoryId] = useState<string | null>(existingStory?.id ?? null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: itemRows } = await supabase
        .from('items')
        .select('id, name, image_url, category, available')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      if (!itemRows) return
      const unavailableIds = itemRows.filter(i => !i.available).map(i => i.id)
      const nextMap: Record<string, string | null> = {}
      if (unavailableIds.length > 0) {
        const { data: loans } = await supabase
          .from('loans').select('item_id, due_date')
          .in('item_id', unavailableIds)
          .in('status', ['active', 'pending', 'change_proposed'])
          .order('due_date', { ascending: true })
        for (const loan of loans || []) {
          if (!nextMap[loan.item_id]) nextMap[loan.item_id] = loan.due_date
        }
      }
      setMyItems(itemRows.map(i => ({ ...i, next_available: nextMap[i.id] ?? null })))
    }
    load()
  }, [])

  const availableCategories = [...new Set(myItems.map(i => i.category).filter(Boolean))]
  const visibleItems = categoryFilter ? myItems.filter(i => i.category === categoryFilter) : myItems
  const orderedItems = selected.map(id => myItems.find(i => i.id === id)).filter(Boolean) as Item[]
  const defaultCoverImg = orderedItems[0]?.image_url ?? null

  const toggleItem = (itemId: string) =>
    setSelected(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setSelected(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })
  }
  const moveDown = (idx: number) => {
    if (idx === selected.length - 1) return
    setSelected(prev => { const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })
  }

  const pickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !savedStoryId) return
    setCoverUploading(true)
    setCoverPreview(URL.createObjectURL(file))
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `story-covers/${savedStoryId}.${ext}`
    await supabase.storage.from('item-images').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('item-images').getPublicUrl(path)
    setCoverUrl(data.publicUrl)
    setCoverUploading(false)
  }

  // ── Save / update story + slides ──
  const saveStoryAndSlides = async (): Promise<boolean> => {
    setStep('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    if (isEditing && savedStoryId) {
      // Update title
      const { error: titleErr } = await supabase
        .from('item_stories')
        .update({ title: title.trim() })
        .eq('id', savedStoryId)
      if (titleErr) { setError('Noe gikk galt. Prøv igjen.'); setStep('order'); return false }

      // Replace slides: delete all existing, re-insert in new order
      await supabase.from('item_story_slides').delete().eq('story_id', savedStoryId)
      const slides = selected.map((itemId, idx) => ({
        story_id: savedStoryId,
        item_id: itemId,
        sort_order: idx,
        caption: captions[itemId]?.trim() || null,
      }))
      await supabase.from('item_story_slides').insert(slides)
      track('story_edited', { story_id: savedStoryId, items_count: selected.length })
    } else {
      // Create new
      const { data: story, error: storyErr } = await supabase
        .from('item_stories')
        .insert({ owner_id: user.id, title: title.trim(), type: 'custom', category: null, cover_url: null, cover_text: null })
        .select('id').single()
      if (storyErr || !story) { setError('Noe gikk galt. Prøv igjen.'); setStep('order'); return false }
      const slides = selected.map((itemId, idx) => ({
        story_id: story.id, item_id: itemId, sort_order: idx, caption: captions[itemId]?.trim() || null,
      }))
      await supabase.from('item_story_slides').insert(slides)
      setSavedStoryId(story.id)
      track('story_created', { story_id: story.id, items_count: selected.length })
    }
    return true
  }

  const publish = async () => {
    if (!savedStoryId) return
    setStep('saving')
    const supabase = createClient()
    const finalCoverUrl = coverUrl ?? defaultCoverImg
    await supabase.from('item_stories').update({
      cover_url: finalCoverUrl,
      cover_text: coverText.trim() || null,
    }).eq('id', savedStoryId)
    onCreated()
  }

  const goToOrder = () => {
    if (!title.trim()) { setError('Gi storyen et navn'); return }
    if (selected.length === 0) { setError('Velg minst én gjenstand'); return }
    setError(''); setStep('order')
  }

  const goToCover = async () => {
    const ok = await saveStoryAndSlides()
    if (ok) setStep('cover')
  }

  const handleBack = () => {
    if (step === 'select') { onClose(); return }
    if (step === 'order') { setStep('select'); return }
    if (step === 'cover') { onCreated(); return } // slides already saved
  }

  const stepTitle: Record<Step, string> = {
    select: isEditing ? 'Rediger story' : 'Ny story',
    order: 'Sorter rekkefølge',
    cover: 'Forsidebilde',
    saving: 'Lagrer…',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#111', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={handleBack}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
          {step === 'select'
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          }
        </button>
        <h1 className="font-display text-lg font-bold flex-1 text-center" style={{ color: '#fff' }}>
          {stepTitle[step]}
        </h1>
        <div style={{ width: 36 }} />
      </div>

      {/* ════════ STEP: select ════════ */}
      {step === 'select' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              autoFocus
              value={title}
              onChange={e => { setTitle(e.target.value); setError('') }}
              placeholder="Navn på storyen, f.eks. «Bryllup»…"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-3"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: `1.5px solid ${title.trim() ? 'rgba(196,103,58,0.6)' : 'rgba(255,255,255,0.15)'}`,
                color: '#fff',
              }}
            />
            {availableCategories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setCategoryFilter('')}
                  className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-medium"
                  style={!categoryFilter
                    ? { background: 'var(--terra)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }
                  }
                >
                  Alle ({myItems.length})
                </button>
                {availableCategories.map(cat => {
                  const count = myItems.filter(i => i.category === cat).length
                  const active = categoryFilter === cat
                  return (
                    <button key={cat}
                      onClick={() => setCategoryFilter(active ? '' : cat)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-medium"
                      style={active
                        ? { background: 'var(--terra)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }
                      }
                    >
                      <span>{CATEGORY_EMOJI[cat] ?? '📦'}</span>
                      <span>{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {visibleItems.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Ingen gjenstander</p>
              : (
                <div className="flex flex-col gap-2 pb-2">
                  {visibleItems.map(item => {
                    const isSelected = selected.includes(item.id)
                    const isCaptionOpen = expandedCaption === item.id
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                          style={{
                            background: isSelected ? 'rgba(196,103,58,0.2)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1.5px solid rgba(196,103,58,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            borderBottomLeftRadius: isCaptionOpen ? 0 : undefined,
                            borderBottomRightRadius: isCaptionOpen ? 0 : undefined,
                            transition: 'all 150ms',
                          }}
                        >
                          {item.image_url
                            ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0" style={{ width: 44, height: 44 }} alt={item.name} />
                            : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.08)' }}>
                                {CATEGORY_EMOJI[item.category] ?? '📦'}
                              </div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate" style={{ color: '#fff' }}>{item.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {item.available ? 'Ledig' : item.next_available ? `Ledig fra ${formatDate(item.next_available)}` : 'Utlånt'}
                            </p>
                          </div>
                          <div className="rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ width: 24, height: 24, background: isSelected ? 'var(--terra)' : 'rgba(255,255,255,0.1)', transition: 'background 150ms' }}>
                            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        </button>
                        {isSelected && (
                          <div style={{ background: 'rgba(196,103,58,0.12)', border: '1.5px solid rgba(196,103,58,0.5)', borderTop: 'none', borderRadius: '0 0 16px 16px' }}>
                            {isCaptionOpen ? (
                              <div className="px-4 py-2.5">
                                <input
                                  autoFocus
                                  value={captions[item.id] ?? ''}
                                  onChange={e => setCaptions(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onBlur={() => setExpandedCaption(null)}
                                  placeholder="Legg til tekst til dette bildet…"
                                  className="w-full text-xs outline-none bg-transparent"
                                  style={{ color: 'rgba(255,255,255,0.9)' }}
                                  maxLength={120}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setExpandedCaption(item.id) }}
                                className="w-full text-left px-4 py-2 text-xs"
                                style={{ color: captions[item.id] ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}
                              >
                                {captions[item.id] ? `"${captions[item.id]}"` : '+ Legg til bildetekst'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>

          <div className="flex-shrink-0 px-4 py-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#111' }}>
            {error && <p className="text-xs mb-2 text-center" style={{ color: '#F5A87C' }}>{error}</p>}
            <button onClick={goToOrder} className="w-full py-4 rounded-2xl font-semibold text-base"
              style={{ background: selected.length > 0 && title.trim() ? 'var(--terra)' : 'rgba(255,255,255,0.12)', color: '#fff' }}>
              {selected.length > 0 ? `Neste: Sorter rekkefølge (${selected.length})` : 'Velg minst én gjenstand'}
            </button>
          </div>
        </div>
      )}

      {/* ════════ STEP: order ════════ */}
      {step === 'order' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Første gjenstand vises øverst i storyen.
            </p>
            <div className="flex flex-col gap-2 pb-2">
              {orderedItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="text-sm font-bold w-5 text-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {idx + 1}
                  </span>
                  {item.image_url
                    ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0" style={{ width: 44, height: 44 }} alt={item.name} />
                    : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.08)' }}>
                        {CATEGORY_EMOJI[item.category] ?? '📦'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: '#fff' }}>{item.name}</p>
                    {captions[item.id] && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>"{captions[item.id]}"</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0}
                      style={{ opacity: idx === 0 ? 0.2 : 1, color: 'rgba(255,255,255,0.6)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button onClick={() => moveDown(idx)} disabled={idx === orderedItems.length - 1}
                      style={{ opacity: idx === orderedItems.length - 1 ? 0.2 : 1, color: 'rgba(255,255,255,0.6)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 px-4 py-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#111' }}>
            {error && <p className="text-xs mb-2 text-center" style={{ color: '#F5A87C' }}>{error}</p>}
            <button onClick={goToCover} className="w-full py-4 rounded-2xl font-semibold text-base"
              style={{ background: 'var(--terra)', color: '#fff' }}>
              Neste: Forsidebilde →
            </button>
          </div>
        </div>
      )}

      {/* ════════ STEP: cover ════════ */}
      {step === 'cover' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Standard er det første bildet i storyen.
            </p>
            <div className="relative w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center"
              style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {(coverPreview ?? coverUrl ?? defaultCoverImg) ? (
                <img src={coverPreview ?? coverUrl ?? defaultCoverImg!} className="w-full h-full object-cover" alt="Forsidebilde" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span style={{ fontSize: 40 }}>{CATEGORY_EMOJI[orderedItems[0]?.category ?? ''] ?? '📦'}</span>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Ingen bilde</p>
                </div>
              )}
              {coverText.trim() && (
                <div className="absolute bottom-0 left-0 right-0 px-4 py-4"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
                  <p className="font-display text-lg font-bold" style={{ color: '#fff', letterSpacing: '-0.02em' }}>{coverText}</p>
                </div>
              )}
              <button onClick={() => coverInputRef.current?.click()}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {coverUploading ? '…' : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Bytt bilde</>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={pickCover} className="hidden" />
            </div>
            <div className="mb-2">
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Tekst på forsiden (valgfritt)
              </label>
              <input value={coverText} onChange={e => setCoverText(e.target.value)}
                placeholder={`F.eks. «${title || 'Min story'}»`} maxLength={60}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
              <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{coverText.length}/60</p>
            </div>
          </div>
          <div className="flex-shrink-0 px-4 py-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#111' }}>
            <button onClick={publish} disabled={coverUploading} className="w-full py-4 rounded-2xl font-semibold text-base"
              style={{ background: 'var(--terra)', color: '#fff', opacity: coverUploading ? 0.6 : 1 }}>
              {isEditing ? 'Lagre endringer ✓' : 'Publiser story ✓'}
            </button>
          </div>
        </div>
      )}

      {/* ════════ STEP: saving ════════ */}
      {step === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">✨</div>
          <p className="font-display text-xl font-bold" style={{ color: '#fff' }}>Lagrer…</p>
        </div>
      )}
    </div>
  )
}
