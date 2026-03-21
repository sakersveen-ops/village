'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import StoryViewer from './StoryViewer'

interface Story {
  id: string
  title: string
  type: 'category' | 'custom'
  category: string | null
  cover_url: string | null
  slides: {
    item_id: string
    sort_order: number
    items: {
      id: string
      name: string
      image_url: string | null
      category: string
      available: boolean
      price: number | null
    }
  }[]
}

interface StoryRingProps {
  ownerId: string
  isOwner: boolean    // true only when viewer === owner
  canView?: boolean   // non-owners: only friends may view; ignored when isOwner=true
  onCreateStory?: () => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function StoryRing({ ownerId, isOwner, canView = false, onCreateStory }: StoryRingProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('item_stories')
        .select(`
          id, title, type, category, cover_url, sort_order,
          item_story_slides(item_id, sort_order,
            items(id, name, image_url, category, available, price)
          )
        `)
        .eq('owner_id', ownerId)
        .order('sort_order', { ascending: true })

      const normalized = (data || []).map((s: any) => ({
        ...s,
        slides: (s.item_story_slides || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .filter((sl: any) => sl.items),
      })).filter(s => s.slides.length > 0)

      setStories(normalized)
      setLoading(false)
    }
    load()
  }, [ownerId])

  if (loading) return null

  // Non-owner who is not a friend: hide entirely
  if (!isOwner && !canView) return null

  // Friend but owner has no stories yet: hide (nothing to show)
  if (!isOwner && stories.length === 0) return null

  // Own profile, no stories yet: show only the "+" bubble
  if (isOwner && stories.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: 'none' }}>
        <button onClick={onCreateStory} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: '#FAF7F2', border: '2px dashed #E8DDD0' }}
          >
            <span style={{ fontSize: 24, color: 'var(--terra)' }}>+</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--terra-mid)', maxWidth: 64, textAlign: 'center', lineHeight: 1.2 }}>
            Ny story
          </span>
        </button>
      </div>
    )
  }

  const openStory = (idx: number) => setActiveIndex(idx)
  const closeStory = () => setActiveIndex(null)
  const nextStory = () => {
    if (activeIndex !== null && activeIndex < stories.length - 1) {
      setActiveIndex(activeIndex + 1)
    } else {
      closeStory()
    }
  }
  const prevStory = () => {
    if (activeIndex !== null && activeIndex > 0) {
      setActiveIndex(activeIndex - 1)
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Owner: "+ Ny story" bubble always first */}
        {isOwner && (
          <button onClick={onCreateStory} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: '#FAF7F2', border: '2px dashed #E8DDD0' }}
            >
              <span style={{ fontSize: 24, color: 'var(--terra)' }}>+</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--terra-mid)', maxWidth: 64, textAlign: 'center', lineHeight: 1.2 }}>
              Ny story
            </span>
          </button>
        )}

        {stories.map((story, idx) => {
          const coverItem = story.slides[0]?.items
          const coverImg = story.cover_url || coverItem?.image_url
          const emoji = story.type === 'category' && story.category
            ? (CATEGORY_EMOJI[story.category] ?? '📦')
            : null

          return (
            <button
              key={story.id}
              onClick={() => openStory(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div
                style={{
                  width: 68, height: 68,
                  borderRadius: '50%',
                  padding: 3,
                  background: 'linear-gradient(135deg, var(--terra) 0%, #E8956D 100%)',
                  boxShadow: '0 2px 8px rgba(196,103,58,0.3)',
                }}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ background: '#E8DDD0', border: '2px solid #FAF7F2' }}
                >
                  {coverImg
                    ? <img src={coverImg} className="w-full h-full object-cover" alt={story.title} />
                    : <span style={{ fontSize: 24 }}>{emoji ?? '📦'}</span>
                  }
                </div>
              </div>
              <span
                className="text-xs font-medium"
                style={{
                  color: 'var(--terra-dark)',
                  maxWidth: 64,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {story.title}
              </span>
            </button>
          )
        })}
      </div>

      {activeIndex !== null && (
        <StoryViewer
          story={stories[activeIndex]}
          ownerId={ownerId}
          isOwner={isOwner}
          onClose={closeStory}
          onNext={nextStory}
          onPrev={activeIndex > 0 ? prevStory : undefined}
        />
      )}
    </>
  )
}
