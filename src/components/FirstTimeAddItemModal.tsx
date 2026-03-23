'use client'
import { useState } from 'react'

// Top suggestions per category shown in onboarding — intentionally short.
// Full list available when browsing add/page.tsx.
const TOP_SUGGESTIONS: Record<string, string[]> = {
  Barn:      ['Babynest', 'Babybilstol', 'Babygym', 'Balansesykkel', 'Sykkel med pedaler', 'Skiutstyr'],
  Verktøy:   ['Drill', 'Høytrykkspyler', 'Gressklipper', 'Stige', 'Sirkelsag', 'Sliper'],
  Sport:     ['Ski (voksen)', 'Sykkel', 'Telt', 'Kajakk', 'Sovepose', 'Ryggsekk'],
  Bøker:     ['Brettspill', 'Puslespill', 'Fagbøker', 'Barnebøker', 'Kokebøker', 'Romaner'],
  Matlaging: ['Kjøkkenmaskin', 'Vaffelsjern', 'Is-maskin', 'Espressomaskin', 'Sous vide', 'Iskremmaskin'],
  Musikk:    ['Gitar', 'Piano/keyboard', 'Mikrofon', 'Høyttaler', 'Ukulele', 'Forsterker'],
  Hage:      ['Hagesett', 'Paraply/paviljong', 'Hengekøye', 'Gressklipper', 'Kompostbeholder', 'Trillebår'],
}

interface Props {
  // Items from onboarding the user said they own
  ownedItems: string[]
  // Items already listed (to exclude from suggestions)
  listedItems?: string[]
  onDismiss: () => void
  onSelectItem: (name: string) => void
  // If true, shows "legg ut flere" framing instead of first-time framing
  isFollowUp?: boolean
}

export default function FirstTimeAddItemModal({
  ownedItems,
  listedItems = [],
  onDismiss,
  onSelectItem,
  isFollowUp = false,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  // Build suggestion list: onboarding items first, then top suggestions,
  // deduped and excluding already-listed items
  const remaining = ownedItems.filter(i => !listedItems.includes(i))
  const allSuggestions = Object.values(TOP_SUGGESTIONS).flat()
  const extraSuggestions = allSuggestions
    .filter(i => !remaining.includes(i) && !listedItems.includes(i))
  const combined = [...remaining, ...extraSuggestions]
  // Show max 8 items
  const suggestions = combined.slice(0, 8)

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" onClick={onDismiss} />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-5 p-6"
        style={{ borderRadius: 24, zIndex: 61, maxHeight: '85vh', overflowY: 'auto' }}>

        <div className="text-center">
          <span className="text-4xl">{isFollowUp ? '➕' : '🏷️'}</span>
          <h2 className="font-display text-xl font-bold mt-3"
            style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            {isFollowUp ? 'Vil du legge ut noe mer?' : 'Legg ut din første gjenstand'}
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            {isFollowUp
              ? 'Her er noen av tingene du merket i onboarding.'
              : 'Velg en av tingene du merket, eller legg til noe nytt.'}
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--terra-mid)' }}>
              Eksempler — du kan legge til mer etterhvert
            </p>
            {suggestions.map(item => (
              <button
                key={item}
                onClick={() => setSelected(selected === item ? null : item)}
                className="glass flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                style={{
                  borderRadius: 12,
                  borderColor: selected === item ? 'rgba(196,103,58,0.5)' : undefined,
                  background: selected === item ? 'rgba(196,103,58,0.08)' : undefined,
                }}
              >
                <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                  style={{
                    background: selected === item ? 'var(--terra)' : 'transparent',
                    border: selected === item ? 'none' : '2px solid rgba(196,103,58,0.3)',
                  }}>
                  {selected === item && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {selected ? (
            <button
              onClick={() => onSelectItem(selected)}
              className="btn-primary w-full"
              style={{ borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600 }}
            >
              Legg ut «{selected}» →
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="btn-primary w-full"
              style={{ borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600 }}
            >
              Legg til noe nytt →
            </button>
          )}
          <button onClick={onDismiss} className="text-sm py-2 text-center"
            style={{ color: 'var(--terra-mid)' }}>
            {isFollowUp ? 'Nei takk, jeg er ferdig' : 'Avbryt'}
          </button>
        </div>
      </div>
    </div>
  )
}
