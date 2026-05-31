// Path of this file: src/components/StoryRing.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import StoryViewer, { Story } from './StoryViewer'
import StoryCreator, { ExistingStory } from './StoryCreator'

interface Props {
  ownerId: string
  isOwner: boolean
  onCreateStory?: () => void
  canView?: boolean
}

export default function StoryRing({ ownerId, isOwner, onCreateStory, canView = true }: Props) {
  const [stories, setStories] = useState<Story[]>([])
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [editingStory, setEditingStory] = useState<ExistingStory | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createClient()
    const { data: storiesData } = await supabase
      .from('item_stories')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { ascending: true })

    if (!storiesData || storiesData.length === 0) {
      setStories([])
      setLoading(false)
      return
    }

    const storyIds = storiesData.map((s: any) => s.id)
    const { data: slidesData } = await supabase
      .from('item_story_slides')
      .select('*, items(id, name, image_url, category, available, price)')
      .in('story_id', storyIds)
      .order('sort_order', { ascending: true })

    const slidesByStory: Record<string, any[]> = {}
    for (const slide of (slidesData || [])) {
      if (!slidesByStory[slide.story_id]) slidesByStory[slide.story_id] = []
      slidesByStory[slide.story_id].push(slide)
    }

    setStories(storiesData.map((s: any) => ({ ...s, slides: slidesByStory[s.id] || [] })))
    setLoading(false)
  }

  useEffect(() => { load() }, [ownerId])

  const getCoverImage = (story: Story): string | null =>
    story.cover_url ?? (story.slides[0]?.items?.image_url ?? null)

  const handleEdit = (story: Story) => {
    setOpenIdx(null)
    setEditingStory({
      id: story.id,
      title: story.title,
      cover_url: story.cover_url,
      cover_text: story.cover_text,
      slides: story.slides.map(sl => ({
        item_id: sl.item_id,
        sort_order: sl.sort_order,
        caption: sl.caption,
      })),
    })
  }

  const currentStory = openIdx !== null ? stories[openIdx] : null

  if (loading) return null

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

        {canView && stories.map((story, i) => {
          const cover = getCoverImage(story)
          return (
            <button
              key={story.id}
              onClick={() => setOpenIdx(i)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              aria-label={story.title}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%', padding: 2,
                background: 'linear-gradient(135deg, var(--terra), var(--terra-green))',
              }}>
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ border: '2px solid var(--glass-bg-heavy)', background: 'var(--glass-border)' }}
                >
                  {cover
                    ? <img src={cover} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xl">📦</span>
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

      {/* Viewer */}
      {currentStory && openIdx !== null && (
        <StoryViewer
          story={currentStory}
          ownerId={ownerId}
          isOwner={isOwner}
          onClose={() => setOpenIdx(null)}
          onNext={() => openIdx < stories.length - 1 ? setOpenIdx(openIdx + 1) : setOpenIdx(null)}
          onPrev={() => openIdx > 0 ? setOpenIdx(openIdx - 1) : undefined}
          onEdit={handleEdit}
          onDeleted={() => { setOpenIdx(null); load() }}
        />
      )}

      {/* Editor (rediger eksisterende story) */}
      {editingStory && (
        <StoryCreator
          existingStory={editingStory}
          onClose={() => setEditingStory(null)}
          onCreated={() => { setEditingStory(null); load() }}
        />
      )}
    </>
  )
}
