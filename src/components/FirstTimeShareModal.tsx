'use client'

// Legg til i src/components/FirstTimeShareModal.tsx
// Bruk slik i profile/page.tsx:
//   import FirstTimeShareModal from '@/components/FirstTimeShareModal'
//   — vis når myItems.length === 0 og !localStorage.getItem(`village_share_intro_${user.id}`)

interface Props {
  userId: string
  ownedItems: string[]   // fra onboarding — lagret i localStorage eller profiles-tabell
  onDismiss: () => void
  onAddItem: () => void  // navigerer til /add
}

export default function FirstTimeShareModal({ userId, ownedItems, onDismiss, onAddItem }: Props) {
  const handleDismiss = () => {
    localStorage.setItem(`village_share_intro_${userId}`, '1')
    onDismiss()
  }

  const handleAdd = () => {
    localStorage.setItem(`village_share_intro_${userId}`, '1')
    onAddItem()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" onClick={handleDismiss} />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-5 p-6" style={{ borderRadius: 24, zIndex: 61 }}>
        <div className="text-center">
          <span className="text-4xl">📦</span>
          <h2 className="font-display text-xl font-bold mt-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Del ting med vennene dine
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            Legg ut gjenstander du er åpen for å låne ut. Du bestemmer hvem som ser dem, og godkjenner hvert utlån selv.
          </p>
        </div>

        {ownedItems.length > 0 && (
          <div className="glass px-4 py-3 flex flex-col gap-2" style={{ borderRadius: 14 }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
              Fra onboarding — klar til å legge ut
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ownedItems.slice(0, 6).map(item => (
                <span key={item} className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(196,103,58,0.1)', color: 'var(--terra-dark)', border: '1px solid rgba(196,103,58,0.2)' }}>
                  {item}
                </span>
              ))}
              {ownedItems.length > 6 && (
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ color: 'var(--terra-mid)' }}>
                  +{ownedItems.length - 6} til
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {[
            { emoji: '🔒', text: 'Ingenting deles uten at du legger det ut i en krets' },
            { emoji: '✅', text: 'Du godkjenner hvert utlån manuelt' },
            { emoji: '👁️', text: 'Du bestemmer hvem som ser hva' },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex gap-3 items-center">
              <span className="text-base shrink-0">{emoji}</span>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={handleAdd} className="btn-primary w-full"
            style={{ borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600 }}>
            + Legg ut din første gjenstand
          </button>
          <button onClick={handleDismiss} className="text-sm py-2 text-center" style={{ color: 'var(--terra-mid)' }}>
            Gjør det senere
          </button>
        </div>
      </div>
    </div>
  )
}
