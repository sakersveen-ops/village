'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'
import GroupLoanRequestSheet from './GroupLoanRequestSheet'

interface SlideItem {
  id: string
  name: string
  image_url: string | null
  category: string
  available: boolean
  price: number | null
}

interface Slide {
  item_id: string
  sort_order: number
  caption: string | null
  items: SlideItem
}

export interface Story {
  id: string
  title: string
  type: 'category' | 'custom'
  category: string | null
  cover_url: string | null
  cover_text: string | null
  slides: Slide[]
}

interface StoryViewerProps {
  story: Story
  ownerId: string
  isOwner: boolean
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  onEdit?: (story: Story) => void    // owner: open editor
  onDeleted?: () => void             // owner: story was deleted
}

const SLIDE_DURATION = 5000

const CATEGORY_GRADIENT: Record<string, string> = {
  barn:    'linear-gradient(160deg, #F5E6D3 0%, #E8C9A8 100%)',
  kjole:   'linear-gradient(160deg, #F0E4F0 0%, #D8B8D8 100%)',
  verktøy: 'linear-gradient(160deg, #E8E0D4 0%, #C8B89A 100%)',
  bok:     'linear-gradient(160deg, #E4ECD8 0%, #B8CCA0 100%)',
  annet:   'linear-gradient(160deg, #EDE8E3 0%, #CCC0B4 100%)',
}
const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

export default function StoryViewer({
  story, ownerId, isOwner, onClose, onNext, onPrev, onEdit, onDeleted,
}: StoryViewerProps) {
  const slides = story.slides
  const hasCover = !!(story.cover_url || story.cover_text || story.title)
  const totalSlides = hasCover ? slides.length + 1 : slides.length

  const [currentIdx, setCurrentIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hearted, setHearted] = useState<Set<string>>(new Set())
  const [showRequest, setShowRequest] = useState(false)
  const [showEndScreen, setShowEndScreen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [nextAvailableMap, setNextAvailableMap] = useState<Record<string, string>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<number>(0)
  const lastTickRef = useRef<number>(Date.now())
  const [progressPct, setProgressPct] = useState(0)

  const isCoverSlide = hasCover && currentIdx === 0
  const itemSlideIdx = hasCover ? currentIdx - 1 : currentIdx
  const currentSlide = !isCoverSlide ? slides[itemSlideIdx] : null
  const currentItem = currentSlide?.items ?? null

  const advance = useCallback(() => {
    setCurrentIdx(prev => {
      if (prev < totalSlides - 1) {
        progressRef.current = 0; setProgressPct(0); lastTickRef.current = Date.now()
        return prev + 1
      } else {
        setShowEndScreen(true); return prev
      }
    })
  }, [totalSlides])

  useEffect(() => {
    if (showEndScreen) return
    const tick = () => {
      if (paused) { lastTickRef.current = Date.now(); return }
      const now = Date.now()
      progressRef.current = Math.min(progressRef.current + (now - lastTickRef.current), SLIDE_DURATION)
      lastTickRef.current = now
      setProgressPct((progressRef.current / SLIDE_DURATION) * 100)
      if (progressRef.current >= SLIDE_DURATION) { progressRef.current = 0; advance() }
    }
    timerRef.current = setInterval(tick, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, advance, showEndScreen])

  const goTo = (idx: number) => {
    progressRef.current = 0; setProgressPct(0); lastTickRef.current = Date.now()
    setCurrentIdx(idx); setShowEndScreen(false)
  }

  const toggleHeart = (itemId: string) => {
    if (isOwner) return
    setHearted(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n })
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showEndScreen) return
    const x = e.clientX; const w = (e.currentTarget as HTMLElement).offsetWidth
    if (x < w * 0.35) { if (currentIdx > 0) goTo(currentIdx - 1); else onPrev?.() }
    else advance()
  }

  useEffect(() => {
    track('story_viewed', { story_id: story.id, owner_id: ownerId, is_owner: isOwner })
  }, [story.id])

  // Fetch next available dates for unavailable items
  useEffect(() => {
    const unavailableIds = slides.filter(sl => sl.items && !sl.items.available).map(sl => sl.item_id)
    if (unavailableIds.length === 0) return
    const loadDates = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('loans').select('item_id, due_date')
        .in('item_id', unavailableIds)
        .in('status', ['active', 'pending', 'change_proposed'])
        .order('due_date', { ascending: true })
      if (!data) return
      const map: Record<string, string> = {}
      for (const loan of data) { if (!map[loan.item_id]) map[loan.item_id] = loan.due_date }
      setNextAvailableMap(map)
    }
    loadDates()
  }, [story.id])

  const deleteStory = async () => {
    setDeleting(true)
    const supabase = createClient()
    // Slides deleted by cascade
    await supabase.from('item_stories').delete().eq('id', story.id)
    track('story_deleted', { story_id: story.id })
    onDeleted?.()
  }

  const coverImg = story.cover_url ?? slides[0]?.items?.image_url ?? null
  const bg = currentItem
    ? (currentItem.image_url ? undefined : (CATEGORY_GRADIENT[currentItem.category] ?? CATEGORY_GRADIENT.annet))
    : undefined
  const isHearted = currentItem ? hearted.has(currentItem.id) : false

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Progress bars ── */}
      <div className="flex gap-1 px-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.3)' }}>
            <div className="h-full rounded-full" style={{
              background: '#fff',
              width: i < currentIdx ? '100%' : i === currentIdx ? `${progressPct}%` : '0%',
              transition: 'none',
            }} />
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-3 pt-2 pb-1">
        <div className="rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: 'var(--terra)', opacity: 0.8 }} />
        <span className="text-sm font-semibold flex-1" style={{ color: '#fff' }}>{story.title}</span>

        {/* ... menu — owner only */}
        {isOwner && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setPaused(true); setShowMenu(m => !m) }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              aria-label="Meny"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>

            {showMenu && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-10" onClick={() => { setShowMenu(false); setPaused(false) }} />
                <div className="absolute right-0 top-10 z-20 rounded-2xl overflow-hidden shadow-xl"
                  style={{ background: 'rgba(30,20,15,0.95)', border: '1px solid rgba(255,255,255,0.12)', minWidth: 160, backdropFilter: 'blur(16px)' }}>
                  <button
                    onClick={() => { setShowMenu(false); onEdit?.(story) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                    style={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Rediger story
                  </button>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                      style={{ color: 'rgba(255,100,100,0.9)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                      Slett story
                    </button>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Er du sikker?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-1.5 rounded-xl text-xs"
                          style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={deleteStory}
                          disabled={deleting}
                          className="flex-1 py-1.5 rounded-xl text-xs font-semibold"
                          style={{ background: 'rgba(200,50,50,0.85)', color: '#fff', opacity: deleting ? 0.6 : 1 }}
                        >
                          {deleting ? '…' : 'Slett'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <button onClick={onClose}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          aria-label="Lukk">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Slide area ── */}
      {!showEndScreen ? (
        <div className="flex-1 relative flex items-center justify-center"
          onClick={handleTap}
          onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {/* ── Cover slide ── */}
          {isCoverSlide && (
            <>
              {coverImg
                ? <img src={coverImg} className="w-full h-full object-cover absolute inset-0" alt={story.title} />
                : <div className="w-full h-full absolute inset-0" style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #6B3020 100%)' }} />
              }
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
                <p className="font-display text-3xl font-bold mb-1"
                  style={{ color: '#fff', letterSpacing: '-0.025em', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                  {story.cover_text || story.title}
                </p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {slides.length} {slides.length === 1 ? 'gjenstand' : 'gjenstander'}
                </p>
              </div>
            </>
          )}

          {/* ── Item slide ── */}
          {!isCoverSlide && currentItem && (
            <>
              {currentItem.image_url
                ? <img src={currentItem.image_url} className="w-full h-full object-cover absolute inset-0" alt={currentItem.name} />
                : <div className="w-full h-full absolute inset-0" style={{ background: bg }} />
              }
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />

              <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {!currentItem.image_url && currentItem.category && (
                    <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>{CATEGORY_EMOJI[currentItem.category] ?? '📦'}</div>
                  )}
                  <p className="font-display text-2xl font-bold" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                    {currentItem.name}
                  </p>
                  {currentSlide?.caption && (
                    <p className="text-sm mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                      "{currentSlide.caption}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {currentItem.price
                      ? <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{currentItem.price} kr/dag</span>
                      : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>Gratis</span>
                    }
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={currentItem.available
                        ? { background: 'rgba(74,124,89,0.85)', color: '#fff' }
                        : { background: 'rgba(196,103,58,0.85)', color: '#fff' }
                      }>
                      {currentItem.available ? 'Ledig'
                        : nextAvailableMap[currentItem.id]
                          ? `Ledig fra ${formatDate(nextAvailableMap[currentItem.id])}`
                          : 'Utlånt'
                      }
                    </span>
                  </div>
                </div>

                {!isOwner && (
                  <button onClick={e => { e.stopPropagation(); toggleHeart(currentItem.id) }}
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 52, height: 52,
                      background: isHearted ? 'rgba(196,103,58,0.9)' : 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(255,255,255,0.3)',
                      transform: isHearted ? 'scale(1.15)' : 'scale(1)',
                      transition: 'background 200ms, transform 150ms',
                    }}>
                    <svg width="22" height="22" viewBox="0 0 24 24"
                      fill={isHearted ? '#fff' : 'none'} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                )}
              </div>

              <div className="absolute top-14 left-0 right-0 flex justify-center">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{itemSlideIdx + 1} / {slides.length}</span>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ── End screen ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6"
          style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #1a0f08 100%)' }}>

          {isOwner ? (
            /* ── Owner end screen ── */
            <>
              <div className="text-4xl mb-4">✏️</div>
              <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: '#fff' }}>
                {story.title}
              </h2>
              <p className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {slides.length} {slides.length === 1 ? 'gjenstand' : 'gjenstander'}
              </p>
              <button
                onClick={() => onEdit?.(story)}
                className="w-full py-4 rounded-2xl font-semibold text-base mb-3"
                style={{ background: 'var(--terra)', color: '#fff', maxWidth: 320 }}
              >
                ✏️ Rediger story
              </button>
              <button onClick={onClose} className="py-2 px-6 rounded-xl text-sm mt-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Lukk
              </button>
            </>
          ) : (
            /* ── Friend end screen ── */
            <>
              <div className="text-4xl mb-4">{hearted.size > 0 ? '❤️' : '✓'}</div>
              <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: '#fff' }}>
                {hearted.size > 0 ? `${hearted.size} ${hearted.size === 1 ? 'gjenstand' : 'gjenstander'} likt` : 'Ferdig med storyen'}
              </h2>
              <p className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {hearted.size > 0 ? 'Vil du sende en låneforespørsel for alle likte gjenstander?' : 'Du likte ingen gjenstander i denne storyen.'}
              </p>
              {hearted.size > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-xs">
                    {slides.filter(sl => hearted.has(sl.items?.id)).map(sl => (
                      <div key={sl.item_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <span style={{ fontSize: 14 }}>{CATEGORY_EMOJI[sl.items.category] ?? '📦'}</span>
                        <span className="text-xs font-medium" style={{ color: '#fff' }}>{sl.items.name}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setPaused(true); setShowRequest(true) }}
                    className="w-full py-4 rounded-2xl font-semibold text-base mb-3"
                    style={{ background: 'var(--terra)', color: '#fff', maxWidth: 320 }}>
                    Send låneforespørsel
                  </button>
                </>
              )}
              <button onClick={onClose} className="py-2 px-6 rounded-xl text-sm"
                style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {hearted.size > 0 ? 'Avbryt' : 'Lukk'}
              </button>
            </>
          )}
        </div>
      )}

      {!isOwner && showRequest && (
        <GroupLoanRequestSheet
          ownerId={ownerId}
          storyId={story.id}
          heartedItems={slides.filter(sl => hearted.has(sl.items?.id)).map(sl => sl.items)}
          onClose={() => setShowRequest(false)}
          onSent={() => { setShowRequest(false); onClose() }}
        />
      )}
    </div>
  )
}
