'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface Story {
  id: string
  image_url: string
  caption?: string
  item_id?: string
  item?: { id: string; name: string }
  created_at: string
  owner?: { id: string; name: string; avatar_url?: string }
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
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  // Drag-to-dismiss state
  const dragStartY = useRef<number | null>(null)
  const dragCurrentY = useRef<number>(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('stories')
        .select('*, item:items(id, name), owner:profiles!stories_owner_id_fkey(id, name, avatar_url)')
        .eq('owner_id', ownerId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
      setStories(data || [])
      if (data && data.length > 0) setOwnerProfile(data[0].owner)
      setLoading(false)
    }
    load()
  }, [ownerId])

  const openStory = (i: number) => {
    setIndex(i)
    setDragOffset(0)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setDragOffset(0)
    setIsDragging(false)
  }

  const next = () => {
    if (index < stories.length - 1) setIndex(i => i + 1)
    else close()
  }
  const prev = () => {
    if (index > 0) setIndex(i => i - 1)
  }

  // Touch handlers for drag-to-dismiss
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragCurrentY.current = 0
    setIsDragging(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy < 0) return // only allow downward drag
    dragCurrentY.current = dy
    setIsDragging(true)
    setDragOffset(dy)
  }

  const onTouchEnd = () => {
    if (dragCurrentY.current > 120) {
      close()
    } else {
      setDragOffset(0)
      setIsDragging(false)
    }
    dragStartY.current = null
  }

  // Mouse handlers for drag-to-dismiss (desktop)
  const onMouseDown = (e: React.MouseEvent) => {
    dragStartY.current = e.clientY
    dragCurrentY.current = 0
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStartY.current === null) return
    const dy = e.clientY - dragStartY.current
    if (dy < 0) return
    dragCurrentY.current = dy
    setIsDragging(true)
    setDragOffset(dy)
  }

  const onMouseUp = () => {
    if (dragCurrentY.current > 120) {
      close()
    } else {
      setDragOffset(0)
      setIsDragging(false)
    }
    dragStartY.current = null
  }

  const opacity = dragOffset > 0 ? Math.max(0.3, 1 - dragOffset / 300) : 1
  const scale = dragOffset > 0 ? Math.max(0.88, 1 - dragOffset / 1200) : 1

  const story = stories[index]

  if (loading) return null

  const hasStories = stories.length > 0

  return (
    <>
      {/* Ring row */}
      <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Add story button (owner only) */}
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
                background: '#F5F0EB',
                border: '2px dashed #C4673A',
              }}
            >
              +
            </div>
            <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Ny story</span>
          </button>
        )}

        {/* Story rings */}
        {hasStories && canView && stories.map((s, i) => (
          <button
            key={s.id}
            onClick={() => openStory(i)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
            aria-label="Se story"
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%', padding: 2,
                background: 'linear-gradient(135deg, #C4673A, #E8A87C)',
              }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden"
                style={{ border: '2px solid #FAF7F2' }}
              >
                <img src={s.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Fullscreen story viewer */}
      {open && story && (
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
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 flex gap-1 p-2" style={{ zIndex: 2 }}>
              {stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.35)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: '#fff',
                      width: i < index ? '100%' : i === index ? '50%' : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header: owner avatar + name + close */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center gap-3 px-3 pt-7 pb-3"
              style={{ zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
            >
              <Link
                href={`/profile/${ownerProfile?.id || ownerId}`}
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
                <span className="text-sm font-semibold truncate" style={{ color: '#fff' }}>
                  {ownerProfile?.name || 'Ukjent'}
                </span>
              </Link>

              {/* Drag hint pill */}
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
            <img
              src={story.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: 0 }}
              draggable={false}
            />

            {/* Bottom: caption + item link */}
            {(story.caption || story.item) && (
              <div
                className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-12 flex flex-col gap-2"
                style={{
                  zIndex: 2,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
                }}
              >
                {story.caption && (
                  <p className="text-sm" style={{ color: '#fff' }}>{story.caption}</p>
                )}
                {story.item && (
                  <Link
                    href={`/items/${story.item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 self-start rounded-xl px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                  >
                    <span className="text-sm">🏷️</span>
                    <span className="text-sm font-medium">{story.item.name}</span>
                    <span className="text-xs opacity-70">→</span>
                  </Link>
                )}
              </div>
            )}

            {/* Tap zones: prev / next */}
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
