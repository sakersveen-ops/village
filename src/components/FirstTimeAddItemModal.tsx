'use client'
import { useState } from 'react'

// Legg til i src/components/FirstTimeAddItemModal.tsx
// Bruk slik i add/page.tsx (AddPageContent):
//
//   import FirstTimeAddItemModal from '@/components/FirstTimeAddItemModal'
//
//   const [showAddIntro, setShowAddIntro] = useState(false)
//
//   useEffect(() => {
//     (async () => {
//       const supabase = createClient()
//       const { data: { user } } = await supabase.auth.getUser()
//       if (!user) return
//       const key = `village_add_intro_${user.id}`
//       if (!localStorage.getItem(key)) setShowAddIntro(true)
//     })()
//   }, [])
//
//   // I JSX:
//   {showAddIntro && (
//     <FirstTimeAddItemModal
//       suggestedItems={onboardingOwnedItems}
//       onDismiss={() => {
//         localStorage.setItem(`village_add_intro_${userId}`, '1')
//         setShowAddIntro(false)
//       }}
//       onSelectItem={(itemName) => {
//         setName(itemName)
//         localStorage.setItem(`village_add_intro_${userId}`, '1')
//         setShowAddIntro(false)
//       }}
//     />
//   )}

interface Props {
  suggestedItems: string[]   // fra onboarding (ownedItems lagret i localStorage)
  onDismiss: () => void
  onSelectItem: (name: string) => void
}

export default function FirstTimeAddItemModal({ suggestedItems, onDismiss, onSelectItem }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" onClick={onDismiss} />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-5 p-6" style={{ borderRadius: 24, zIndex: 61 }}>
        <div className="text-center">
          <span className="text-4xl">🏷️</span>
          <h2 className="font-display text-xl font-bold mt-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Legg ut en gjenstand
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            Velg en av tingene du merket i onboarding, eller legg til noe nytt.
          </p>
        </div>

        {suggestedItems.length > 0 && (
          <div className="flex flex-col gap-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
              Dine merkede ting
            </p>
            {suggestedItems.map(item => (
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
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
          <button onClick={onDismiss} className="text-sm py-2 text-center" style={{ color: 'var(--terra-mid)' }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}
