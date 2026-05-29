// Path: src/components/ShareSuggestionBanner.tsx
//
// Shows a contextual "legg ut ting du kan dele" prompt after onboarding.
// Placed on: profile page (under empty items list), items/manage page (top if 0 items).
//
// Dismissal logic:
//   "Minn meg på dette senere" → hides for this session (sessionStorage)
//   "Vis ikke igjen"           → sets profiles.onboarding_share_dismissed = true (permanent)
//
// The hurtigliste is filtered so items the user already owns don't appear.
// If the user has items covering all suggestions, the banner hides itself automatically.

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const SESSION_KEY = 'village_share_banner_snoozed'

interface ShareSuggestionBannerProps {
  /** Pass the user's profile interests so we show relevant categories first */
  interests?: string[]
  /** Pass existing item names so we filter them out of suggestions */
  existingItemNames?: string[]
}

export default function ShareSuggestionBanner({ interests = [], existingItemNames = [] }: ShareSuggestionBannerProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    ;(async () => {
      // Already snoozed this session
      if (sessionStorage.getItem(SESSION_KEY)) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check permanent dismissal
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_share_dismissed, interests')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_share_dismissed) return

      setUserId(user.id)

      // Build suggestion list: interests-first, then the rest
      const userInterests: string[] = profile?.interests ?? interests
      const orderedCats = [
        ...userInterests.filter(i => ITEM_CATALOGUE[i]),
        ...Object.keys(ITEM_CATALOGUE).filter(c => !userInterests.includes(c)),
      ]
      const existingLower = existingItemNames.map(n => n.toLowerCase())
      const picks = orderedCats
        .flatMap(cat => ITEM_CATALOGUE[cat] ?? [])
        .filter(item => !existingLower.includes(item.toLowerCase()))
        .slice(0, 6)

      if (picks.length === 0) return // All suggestions already covered — hide banner

      setSuggestions(picks)
      setVisible(true)
    })()
  }, [interests, existingItemNames])

  const snooze = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    track('share_banner_snoozed')
    setVisible(false)
  }

  const dismissPermanently = async () => {
    if (!userId || dismissing) return
    setDismissing(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_share_dismissed: true }).eq('id', userId)
    track('share_banner_dismissed_permanent')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="glass flex flex-col gap-4 p-5 mb-4" style={{ borderRadius: 20 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.02em' }}>
            Hva kan du dele? 📦
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
            Legg ut gjenstander du ikke bruker – venner og naboer vil låne dem.
          </p>
        </div>
      </div>

      {/* Quick suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map(item => (
          <button
            key={item}
            onClick={() => {
              track('share_banner_suggestion_tapped', { item_name: item })
              // Navigate to /add with the item name pre-filled as a query param
              router.push(`/add?suggested=${encodeURIComponent(item)}`)
            }}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors"
            style={{ borderColor: 'rgba(46,98,113,0.3)', color: 'var(--terra)', background: 'transparent' }}
          >
            + {item}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => {
          track('share_banner_cta_tapped')
          router.push('/add')
        }}
        className="btn-primary w-full"
        style={{ borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 600 }}
      >
        Legg ut en gjenstand →
      </button>

      {/* Dismissal row */}
      <div className="flex justify-between items-center">
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
