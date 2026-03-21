xq'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import StoryViewer from './StoryViewer'
import StoryCreator, { type ExistingStory } from './StoryCreator'

interface Story {
  id: string
  title: string
  type: 'category' | 'custom'
  category: string | nullxqdqd
  cover_url: string | null
  cover_text: string | null
  slides: {
    item_id: string
    sort_order: number
    caption: string | null
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
  isOwner: boolean
  canView?: boolean
  onCreateStory?: () => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function StoryRing({ ownerId, isOwner, canView = false, onCreateStory }: StoryRingProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [editingStory, setEditingStory] = useState<ExistingStory | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadStories = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('item_stories')
      .select(`
        id, title, type, category, cover_url, cover_text, sort_order,
        item_story_slides(item_id, sort_order, caption,
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
    })).filter((s: Story) => s.slides.length > 0)

    setStories(normalized)
    setLoading(false)
  }

  useEffect(() => { loadStories() }, [ownerId])

  if (loading) return null
  if (!isOwner && !canView) return null
  if (!isOwner && stories.length === 0) return null

  // Owner with no stories: just the + bubble
  if (isOwner && stories.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: 'none' }}>
        <button onClick={onCreateStory} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: '#FAF7F2', border: '2px dashed #E8DDD0' }}>
            <span style={{ fontSize: 24, color: 'var(--terra)' }}>+</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--terra-mid)', maxWidth: 64, textAlign: 'center', lineHeight: 1.2 }}>
            Ny story
          </span>
        </button>

        {/* Edit modal if triggered from end screen with no stories left */}
        {editingStory && (
          <StoryCreator
            existingStory={editingStory}
            onClose={() => setEditingStory(null)}
            onCreated={() => { setEditingStory(null); loadStories() }}
          />
        )}
      </div>
    )
  }

  const openStory = (idx: number) => setActiveIndex(idx)
  const closeStory = () => setActiveIndex(null)
  const nextStory = () => {
    if (activeIndex !== null && activeIndex < stories.length - 1) setActiveIndex(activeIndex + 1)
    else closeStory()
  }
  const prevStory = () => {
    if (activeIndex !== null && activeIndex > 0) setActiveIndex(activeIndex - 1)
  }

  const handleEdit = (story: Story) => {
    // Map Story → ExistingStory for StoryCreator
    const existing: ExistingStory = {
      id: story.id,
      title: story.title,
      cover_url: story.cover_url,
      cover_text: story.cover_text,
      slides: story.slides.map(sl => ({
        item_id: sl.item_id,
        sort_order: sl.sort_order,
        caption: sl.caption,
      })),
    }
    setActiveIndex(null)
    setEditingStory(existing)
  }

  const handleDeleted = () => {
    setActiveIndex(null)
    loadStories()
  }

  return (
    <>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>

        {/* Owner: + bubble */}
        {isOwner && (
          <button onClick={onCreateStory} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: '#FAF7F2', border: '2px dashed #E8DDD0' }}>
              <span style={{ fontSize: 24, color: 'var(--terra)' }}>+</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--terra-mid)', maxWidth: 64, textAlign: 'center', lineHeight: 1.2 }}>
              Ny story
            </span>
          </button>
        )}

        {stories.map((story, idx) => {
          const coverImg = story.cover_url ?? story.slides[0]?.items?.image_url
          const emoji = story.type === 'category' && story.category
            ? (CATEGORY_EMOJI[story.category] ?? '📦') : null

          return (
            <button key={story.id} onClick={() => openStory(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div style={{
                width: 68, height: 68, borderRadius: '50%', padding: 3,
                background: 'linear-gradient(135deg, var(--terra) 0%, #E8956D 100%)',
                boxShadow: '0 2px 8px rgba(196,103,58,0.3)',
              }}>
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ background: '#E8DDD0', border: '2px solid #FAF7F2' }}>
                  {coverImg
                    ? <img src={coverImg} className="w-full h-full object-cover" alt={story.title} />
                    : <span style={{ fontSize: 24 }}>{emoji ?? '📦'}</span>
                  }
                </div>
              </div>
              <span className="text-xs font-medium" style={{
                color: 'var(--terra-dark)', maxWidth: 64, textAlign: 'center', lineHeight: 1.2,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {story.title}
              </span>
            </button>
          )
        })}
      </div>

      {/* Story viewer */}
      {activeIndex !== null && (
        <StoryViewer
          story={stories[activeIndex]}
          ownerId={ownerId}
          isOwner={isOwner}
          onClose={closeStory}
          onNext={nextStory}
          onPrev={activeIndex > 0 ? prevStory : undefined}
          onEdit={isOwner ? handleEdit : undefined}
          onDeleted={isOwner ? handleDeleted : undefined}
        />
      )}

      {/* Story editor */}
      {editingStory && (
        <StoryCreator
          existingStory={editingStory}
          onClose={() => setEditingStory(null)}
          onCreated={() => { setEditingStory(null); loadStories() }}
        />
      )}
    </>
  )
}
