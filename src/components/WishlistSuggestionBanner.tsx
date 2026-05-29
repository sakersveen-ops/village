// Path: src/components/WishlistSuggestionBanner.tsx
//
// Shows a contextual "legg til ønskeliste" prompt inside the wishlist modal
// on the profile page.
//
// Dismissal logic:
//   "Minn meg på dette senere" → hides for this session (sessionStorage)
//   "Vis ikke igjen"           → sets profiles.onboarding_wishlist_dismissed = true (permanent)
//
// Items the user has already wishlisted are filtered out automatically.
// If all suggestions are already on the wishlist, the banner hides itself.
//
// Usage in the wishlist modal:
//   <WishlistSuggestionBanner
//     interests={profile.interests}
//     existingWishlistNames={wishlist.map(w => w.item_name)}
//     onAdd={(itemName) => handleAddToWishlist(itemName)}
//   />

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

// ─── Item catalogue (mirrors onboarding) ─────────────────────────────────────
const ITEM_CATALOGUE: Record<string, string[]> = {
  Barn: ['Bedside crib', 'Babynest', 'Reiseseng', 'Babybilstol (gruppe 0/1)', 'Bilstol gruppe 2/3', 'Sykkelvogn', 'Trille', 'Bæresjal/sele', 'Babygym', 'Badebalje med nyfødtstøtte', 'Stellebord'],
  Verktøy: ['Drill', 'Sirkelsag', 'Sliper', 'Høytrykkspyler', 'Gressklipper', 'Stige', 'Trillebår'],
  Sport: ['Ski (voksen)', 'Skistøvler', 'Sykkel', 'Telt', 'Sovepose', 'Ryggsekk', 'Kajakk'],
  Bøker: ['Brettspill', 'Puslespill', 'Fagbøker', 'Romaner', 'Kokebøker', 'Barnebøker'],
  Matlaging: ['Kjøkkenmaskin', 'Sous vide', 'Vaffelsjern', 'Iskremmaskin', 'Espressomaskin'],
  Musikk: ['Gitar', 'Piano/keyboard', 'Mikrofon', 'Høyttaler', 'Forsterker'],
  Hage: ['Hagesett', 'Paraply/paviljong', 'Bord og stoler (uteplass)', 'Hengekøye', 'Gressklipper'],
}

const SESSION_KEY = 'village_wishlist_banner_snoozed'

interface WishlistSuggestionBannerProps {
  /** User's profile interests (for relevance ordering) */
  interests?: string[]
  /** Names already on the wishlist so we don't suggest them again */
  existingWishlistNames?: string[]
  /** Called when user taps a suggestion chip — caller handles the insert */
  onAdd: (itemName: string) => void
}

export default function WishlistSuggestionBanner({ interests = [], existingWishlistNames = [], onAdd }: WishlistSuggestionBannerProps) {
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (sessionStorage.getItem(SESSION_KEY)) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_wishlist_dismissed, interests')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_wishlist_dismissed) return

      setUserId(user.id)

      const userInterests: string[] = profile?.interests ?? interests
      const orderedCats = [
        ...userInterests.filter(i => ITEM_CATALOGUE[i]),
        ...Object.keys(ITEM_CATALOGUE).filter(c => !userInterests.includes(c)),
      ]
      const existingLower = existingWishlistNames.map(n => n.toLowerCase())
      const picks = orderedCats
        .flatMap(cat => ITEM_CATALOGUE[cat] ?? [])
        .filter(item => !existingLower.includes(item.toLowerCase()))
        .slice(0, 8)

      if (picks.length === 0) return

      setSuggestions(picks)
      setVisible(true)
    })()
    // Re-run when parent updates the wishlist (user adds an item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingWishlistNames.length])

  const handleAdd = (item: string) => {
    if (added.has(item)) return
    setAdded(prev => new Set(prev).add(item))
    track('wishlist_banner_suggestion_added', { item_name: item })
    onAdd(item)
  }

  const snooze = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    track('wishlist_banner_snoozed')
    setVisible(false)
  }

  const dismissPermanently = async () => {
    if (!userId || dismissing) return
    setDismissing(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_wishlist_dismissed: true }).eq('id', userId)
    track('wishlist_banner_dismissed_permanent')
    setVisible(false)
  }

  if (!visible) return null

  // Hide if all remaining suggestions have been added in this session
  const remaining = suggestions.filter(s => !added.has(s))
  if (remaining.length === 0) return null

  return (
    <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(46,98,113,0.12)' }}>
      {/* Header */}
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--terra-dark)' }}>
          💡 Forslag basert på interessene dine
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
          Trykk for å legge til ønskelisten din – du får varsel hvis noen legger det ut.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {remaining.map(item => (
          <button
            key={item}
            onClick={() => handleAdd(item)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
            style={{ borderColor: 'rgba(74,124,89,0.4)', color: 'var(--terra-green)', background: 'transparent' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {item}
          </button>
        ))}
      </div>

      {/* Added confirmation chips */}
      {added.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...added].map(item => (
            <span
              key={item}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(74,124,89,0.1)', color: 'var(--terra-green)' }}
            >
              ✓ {item}
            </span>
          ))}
        </div>
      )}

      {/* Dismissal row */}
      <div className="flex justify-between items-center mt-1">
        <button onClick={snooze} className="text-xs" style={{ color: 'var(--terra-mid)' }}>
          Minn meg på dette senere
        </button>
        <button onClick={dismissPermanently} disabled={dismissing} className="text-xs" style={{ color: 'var(--terra-mid)', opacity: 0.7 }}>
          Vis ikke igjen
        </button>
      </div>
    </div>
  )
}
