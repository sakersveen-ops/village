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
  items: SlideItem
}

interface Story {
  id: string
  title: string
  type: 'category' | 'custom'
  slides: Slide[]
}

interface StoryViewerProps {
  story: Story
  ownerId: string
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
}

const SLIDE_DURATION = 5000 // ms per slide

const CATEGORY_GRADIENT: Record<string, string> = {
  barn:     'linear-gradient(160deg, #F5E6D3 0%, #E8C9A8 100%)',
  kjole:    'linear-gradient(160deg, #F0E4F0 0%, #D8B8D8 100%)',
  verktøy:  'linear-gradient(160deg, #E8E0D4 0%, #C8B89A 100%)',
  bok:      'linear-gradient(160deg, #E4ECD8 0%, #B8CCA0 100%)',
  annet:    'linear-gradient(160deg, #EDE8E3 0%, #CCC0B4 100%)',
}
const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function StoryViewer({
  story, ownerId, onClose, onNext, onPrev,
}: StoryViewerProps) {
  const slides = story.slides
  const [currentIdx, setCurrentIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hearted, setHearted] = useState<Set<string>>(new Set())
  const [showRequest, setShowRequest] = useState(false)
  const [showEndScreen, setShowEndScreen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<number>(0)
  const lastTickRef = useRef<number>(Date.now())
  const [progressPct, setProgressPct] = useState(0)

  const advance = useCallback(() => {
    setCurrentIdx(prev => {
      if (prev < slides.length - 1) {
        progressRef.current = 0
        setProgressPct(0)
        lastTickRef.current = Date.now()
        return prev + 1
      } else {
        // End of story
        setShowEndScreen(true)
        return prev
      }
    })
  }, [slides.length])

  // Progress tick
  useEffect(() => {
    if (showEndScreen) return
    const tick = () => {
      if (paused) {
        lastTickRef.current = Date.now()
        return
      }
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      progressRef.current = Math.min(progressRef.current + delta, SLIDE_DURATION)
      setProgressPct((progressRef.current / SLIDE_DURATION) * 100)
      if (progressRef.current >= SLIDE_DURATION) {
        progressRef.current = 0
        advance()
      }
    }
    timerRef.current = setInterval(tick, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, advance, showEndScreen])

  const goTo = (idx: number) => {
    progressRef.current = 0
    setProgressPct(0)
    lastTickRef.current = Date.now()
    setCurrentIdx(idx)
    setShowEndScreen(false)
  }

  const toggleHeart = (itemId: string) => {
    setHearted(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showEndScreen) return
    const x = e.clientX
    const w = (e.currentTarget as HTMLElement).offsetWidth
    if (x < w * 0.35) {
      if (currentIdx > 0) goTo(currentIdx - 1)
      else onPrev?.()
    } else {
      advance()
    }
  }

  const slide = slides[currentIdx]
  const item = slide?.items
  const bg = item
    ? (item.image_url
        ? undefined
        : (CATEGORY_GRADIENT[item.category] ?? CATEGORY_GRADIENT.annet))
    : undefined

  useEffect(() => {
    track('story_viewed', { story_id: story.id, owner_id: ownerId })
  }, [story.id])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#000', maxWidth: 480, margin: '0 auto' }}
    >
      {/* ── Progress bars ── */}
      <div className="flex gap-1 px-3 pt-safe pt-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        {slides.map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 2, background: 'rgba(255,255,255,0.3)' }}
          >
            <div
              className="h-full rounded-full transition-none"
              style={{
                background: '#fff',
                width: i < currentIdx
                  ? '100%'
                  : i === currentIdx
                    ? `${progressPct}%`
                    : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-3 pt-2 pb-1">
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 32, height: 32, background: 'var(--terra)', opacity: 0.8 }}
        />
        <span className="text-sm font-semibold flex-1" style={{ color: '#fff' }}>
          {story.title}
        </span>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', color: '#fff', flexShrink: 0 }}
          aria-label="Lukk"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* ── Slide area ── */}
      {!showEndScreen ? (
        <div
          className="flex-1 relative flex items-center justify-center"
          onClick={handleTap}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {item?.image_url ? (
            <img
              src={item.image_url}
              className="w-full h-full object-cover absolute inset-0"
              alt={item.name}
            />
          ) : (
            <div
              className="w-full h-full absolute inset-0"
              style={{ background: bg }}
            />
          )}

          {/* Gradient overlay for text legibility */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%, transparent 100%)' }}
          />

          {/* Item info */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 flex items-end justify-between">
            <div>
              {!item?.image_url && item?.category && (
                <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>
                  {CATEGORY_EMOJI[item.category] ?? '📦'}
                </div>
              )}
              <p className="font-display text-2xl font-bold" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                {item?.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {item?.price ? (
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {item.price} kr/dag
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Gratis</span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={item?.available
                    ? { background: 'rgba(74,124,89,0.9)', color: '#fff' }
                    : { background: 'rgba(196,103,58,0.9)', color: '#fff' }
                  }
                >
                  {item?.available ? 'Ledig' : 'Utlånt'}
                </span>
              </div>
            </div>

            {/* Heart button */}
            <button
              onClick={e => { e.stopPropagation(); if (item) toggleHeart(item.id) }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 52, height: 52,
                background: hearted.has(item?.id ?? '')
                  ? 'rgba(196,103,58,0.9)'
                  : 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                transition: 'background 200ms, transform 150ms',
                transform: hearted.has(item?.id ?? '') ? 'scale(1.15)' : 'scale(1)',
                flexShrink: 0,
              }}
              aria-label="Hjerte"
            >
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill={hearted.has(item?.id ?? '') ? '#fff' : 'none'}
                stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>

          {/* Slide counter dots */}
          <div className="absolute top-14 left-0 right-0 flex justify-center gap-1">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {currentIdx + 1} / {slides.length}
            </span>
          </div>
        </div>
      ) : (
        /* ── End screen ── */
        <div
          className="flex-1 flex flex-col items-center justify-center px-6"
          style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #1a0f08 100%)' }}
        >
          <div className="text-4xl mb-4">
            {hearted.size > 0 ? '❤️' : '✓'}
          </div>
          <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: '#fff' }}>
            {hearted.size > 0
              ? `${hearted.size} ${hearted.size === 1 ? 'gjenstand' : 'gjenstander'} likt`
              : 'Ferdig med storyen'}
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {hearted.size > 0
              ? 'Vil du sende en låneforespørsel for alle likte gjenstander?'
              : 'Du likte ingen gjenstander i denne storyen.'}
          </p>

          {hearted.size > 0 && (
            <>
              {/* Hearted items preview */}
              <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-xs">
                {slides
                  .filter(sl => hearted.has(sl.items?.id))
                  .map(sl => (
                    <div
                      key={sl.item_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      <span style={{ fontSize: 14 }}>{CATEGORY_EMOJI[sl.items.category] ?? '📦'}</span>
                      <span className="text-xs font-medium" style={{ color: '#fff' }}>{sl.items.name}</span>
                    </div>
                  ))
                }
              </div>

              <button
                onClick={() => { setPaused(true); setShowRequest(true) }}
                className="w-full py-4 rounded-2xl font-semibold text-base mb-3"
                style={{ background: 'var(--terra)', color: '#fff', maxWidth: 320 }}
              >
                Send låneforespørsel
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="py-2 px-6 rounded-xl text-sm"
            style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {hearted.size > 0 ? 'Avbryt' : 'Lukk'}
          </button>
        </div>
      )}

      {/* ── Group loan request sheet ── */}
      {showRequest && (
        <GroupLoanRequestSheet
          ownerId={ownerId}
          storyId={story.id}
          heartedItems={slides
            .filter(sl => hearted.has(sl.items?.id))
            .map(sl => sl.items)
          }
          onClose={() => setShowRequest(false)}
          onSent={() => { setShowRequest(false); onClose() }}
        />
      )}
    </div>
  )
}
