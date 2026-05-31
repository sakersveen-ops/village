// Path of this file: src/components/StoryRing.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface Slide {
  id: string
  item_id: string
  caption: string | null
  sort_order: number
  item?: { id: string; name: string; image_url: string | null }
}

interface Story {
  id: string
  title: string
  type: 'category' | 'custom'
  category: string | null
  cover_url: string | null
  cover_text: string | null
  sort_order: number
  created_at: string
  slides: Slide[]
}

interface Props {
  ownerId: string
  isOwner: boolean
  onCreateStory?: () => void
  canView?: boolean
}

export default function StoryRing({ ownerId, isOwner, onCreateStory, canView = true }: Props) {
  const [stories, setStories] = useState<Story[]>([])
  const [ownerProfile, setOwnerProfile] = useState<any>(null)
  const [openStoryIdx, setOpenStoryIdx] = useState<number | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  const dragStartY = useRef<number | null>(null)
  const dragCurrentY = useRef<number>(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const [{ data: profileData }, { data: storiesData }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').eq('id', ownerId).single(),
        supabase.from('item_stories')
          .select('*')
          .eq('owner_id', ownerId)
          .order('sort_order', { ascending: true }),
      ])

      setOwnerProfile(profileData)

      if (!storiesData || storiesData.length === 0) {
        setLoading(false)
        return
      }

      const storyIds = storiesData.map((s: any) => s.id)
      const { data: slidesData } = await supabase
        .from('item_story_slides')
        .select('*, item:items(id, name, image_url)')
        .in('story_id', storyIds)
        .order('sort_order', { ascending: true })

      const slidesByStory: Record<string, Slide[]> = {}
      for (const slide of (slidesData || [])) {
        if (!slidesByStory[slide.story_id]) slidesByStory[slide.story_id] = []
        slidesByStory[slide.story_id].push(slide)
      }

      const merged: Story[] = storiesData.map((s: any) => ({
        ...s,
        slides: slidesByStory[s.id] || [],
      }))

      setStories(merged)
      setLoading(false)
    }
    load()
  }, [ownerId])

  const openStory = (i: number) => {
    setOpenStoryIdx(i)
    setSlideIdx(0)
    setDragOffset(0)
  }

  const close = () => {
    setOpenStoryIdx(null)
    setDragOffset(0)
    setIsDragging(false)
  }

  const currentStory = openStoryIdx !== null ? stories[openStoryIdx] : null
  const slides = currentStory?.slides ?? []

  const next = () => {
    if (slideIdx < slides.length - 1) setSlideIdx(i => i + 1)
    else if (openStoryIdx !== null && openStoryIdx < stories.length - 1) {
      setOpenStoryIdx(i => i! + 1)
      setSlideIdx(0)
    } else close()
  }

  const prev = () => {
    if (slideIdx > 0) setSlideIdx(i => i - 1)
    else if (openStoryIdx !== null && openStoryIdx > 0) {
      const prevStory = stories[openStoryIdx - 1]
      setOpenStoryIdx(i => i! - 1)
      setSlideIdx(Math.max(0, prevStory.slides.length - 1))
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragCurrentY.current = 0
    setIsDragging(false)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy < 0) return
    dragCurrentY.current = dy
    setIsDragging(true)
    setDragOffset(dy)
  }
  const onTouchEnd = () => {
    if (dragCurrentY.current > 120) close()
    else { setDragOffset(0); setIsDragging(false) }
    dragStartY.current = null
  }
  const onMouseDown = (e: React.MouseEvent) => { dragStartY.current = e.clientY; dragCurrentY.current = 0 }
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStartY.current === null) return
    const dy = e.clientY - dragStartY.current
    if (dy < 0) return
    dragCurrentY.current = dy
    setIsDragging(true)
    setDragOffset(dy)
  }
  const onMouseUp = () => {
    if (dragCurrentY.current > 120) close()
    else { setDragOffset(0); setIsDragging(false) }
    dragStartY.current = null
  }

  const opacity = dragOffset > 0 ? Math.max(0.3, 1 - dragOffset / 300) : 1
  const scale = dragOffset > 0 ? Math.max(0.88, 1 - dragOffset / 1200) : 1

  // Resolve cover image for a story
  const getCoverImage = (story: Story): string | null => {
    if (story.cover_url) return story.cover_url
    return story.slides[0]?.item?.image_url ?? null
  }

  // Resolve image for current slide
  const currentSlide = slides[slideIdx]
  const slideImage = currentSlide?.item?.image_url ?? null

  if (loading) return null

  const hasStories = stories.length > 0

  return (
    <>
      {/* Ring row */}
      <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {isOwner && onCreateStory && (
          <button
            onClick={onCreateStory}
            className="flex flex-col items-center gap-1 flex-shrink-0"
            aria-label="Legg til story"
          >
            <div
              className="flex items-center justify-center text-2xl"
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--glass-bg-heavy)',
                border: '2px dashed var(--terra)',
              }}
            >
              +
            </div>
            <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Ny story</span>
          </button>
        )}

        {hasStories && canView && stories.map((story, i) => {
          const cover = getCoverImage(story)
          return (
            <button
              key={story.id}
              onClick={() => openStory(i)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              aria-label={story.title}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg, var(--terra), #5E9A78)' }}>
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ border: '2px solid var(--glass-bg-heavy)', background: 'var(--glass-border)' }}>
                  {cover
                    ? <img src={cover} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xl">{story.type === 'category' ? '📦' : '✨'}</span>
                  }
                </div>
              </div>
              <span className="text-xs truncate max-w-[56px]" style={{ color: 'var(--terra-mid)' }}>
                {story.title}
              </span>
            </button>
          )
        })}
      </div>

      {/* Fullscreen story viewer */}
      {openStoryIdx !== null && currentStory && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 60, background: `rgba(0,0,0,${0.85 * opacity})` }}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="relative w-full max-w-sm flex flex-col"
            style={{
              height: '100dvh',
              transform: `translateY(${dragOffset}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.25s ease',
              borderRadius: dragOffset > 20 ? 20 : 0,
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* Progress bars — per slide */}
            <div className="absolute top-0 left-0 right-0 flex gap-1 p-2" style={{ zIndex: 2 }}>
              {slides.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.35)' }}>
                  <div className="h-full rounded-full" style={{
                    background: '#fff',
                    width: i < slideIdx ? '100%' : i === slideIdx ? '50%' : '0%',
                  }} />
                </div>
              ))}
            </div>

            {/* Header */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center gap-3 px-3 pt-7 pb-3"
              style={{ zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
            >
              <Link
                href={`/profile/${ownerId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <div
                  className="flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0"
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--terra)', border: '1.5px solid rgba(255,255,255,0.6)' }}
                >
                  {ownerProfile?.avatar_url
                    ? <img src={ownerProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                    : ownerProfile?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate" style={{ color: '#fff' }}>
                    {ownerProfile?.name || 'Ukjent'}
                  </span>
                  <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {currentStory.title}
                  </span>
                </div>
              </Link>

              <div className="flex-shrink-0 flex justify-center">
                <div style={{ width: 36, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.45)' }} />
              </div>

              <button
                onClick={close}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>

            {/* Image */}
            {slideImage
              ? <img src={slideImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} draggable={false} />
              : <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0, background: 'var(--terra-dark)' }}>
                  <span className="text-6xl">📦</span>
                </div>
            }

            {/* Bottom: caption + item link */}
            {(currentSlide?.caption || currentSlide?.item) && (
              <div
                className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-12 flex flex-col gap-2"
                style={{ zIndex: 2, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
              >
                {currentSlide.caption && (
                  <p className="text-sm" style={{ color: '#fff' }}>{currentSlide.caption}</p>
                )}
                {currentSlide.item && (
                  <Link
                    href={`/items/${currentSlide.item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 self-start rounded-xl px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                  >
                    <span className="text-sm">🏷️</span>
                    <span className="text-sm font-medium">{currentSlide.item.name}</span>
                    <span className="text-xs opacity-70">→</span>
                  </Link>
                )}
              </div>
            )}

            {/* Tap zones */}
            <div className="absolute inset-0 flex" style={{ zIndex: 1 }}>
              <div className="flex-1 h-full" onClick={prev} style={{ cursor: 'pointer' }} />
              <div className="flex-1 h-full" onClick={next} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
