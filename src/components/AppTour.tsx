'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

// ─── Tour steps ────────────────────────────────────────────────────────────────
// Each step targets a navbar element by its data-tour attribute.
// In your NavBar, add data-tour="feed", data-tour="explore", etc. to each nav button.

const STEPS = [
  {
    target: 'feed',
    icon: '🏠',
    title: 'Feed',
    desc: 'Se hva venner og kretser deler – og ting fra andre på Village.',
    position: 'bottom' as const,
  },
  {
    target: 'explore',
    icon: '🔍',
    title: 'Utforsk',
    desc: 'Søk etter spesifikke ting og bla i kategorier.',
    position: 'bottom' as const,
  },
  {
    target: 'add',
    icon: '➕',
    title: 'Legg ut',
    desc: 'Del en gjenstand med vennene eller kretsene dine. Du bestemmer hvem som ser den og godkjenner hvert utlån.',
    position: 'bottom' as const,
  },
  {
    target: 'communities',
    icon: '🏘️',
    title: 'Kretser',
    desc: 'Nabolag, barnehage, idrettslag – del og lån innen grupper du stoler på.',
    position: 'bottom' as const,
  },
  {
    target: 'profile',
    icon: '👤',
    title: 'Profil',
    desc: 'Dine gjenstander, ønskeliste og venner samlet på ett sted.',
    position: 'bottom' as const,
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface TooltipPos {
  top: number
  left: number
  arrowLeft: number
}

export default function AppTour() {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Check if tour should show
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const tourKey = `village_tour_done_${user.id}`
      const onboardingKey = `village_onboarding_done_${user.id}`
      // Only show tour if onboarding was just completed and tour hasn't run yet
      if (localStorage.getItem(onboardingKey) && !localStorage.getItem(tourKey)) {
        // Small delay so feed has time to render
        setTimeout(() => setActive(true), 600)
      }
    })()
  }, [])

  // Position spotlight and tooltip when step changes
  useEffect(() => {
    if (!active) return
    const step = STEPS[stepIndex]
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (!el) return

    const rect = el.getBoundingClientRect()
    const pad = 6

    const spot: SpotlightRect = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }
    setSpotlight(spot)

    // Tooltip: above the spotlight by default (nav is at bottom)
    const tooltipWidth = Math.min(280, window.innerWidth - 32)
    const centerX = rect.left + rect.width / 2
    let tooltipLeft = centerX - tooltipWidth / 2
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16))
    const arrowLeft = centerX - tooltipLeft

    setTooltipPos({
      top: spot.top - 140, // above spotlight
      left: tooltipLeft,
      arrowLeft,
    })
  }, [active, stepIndex])

  const dismiss = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) localStorage.setItem(`village_tour_done_${user.id}`, '1')
    track('app_tour_dismissed', { step: stepIndex })
    setActive(false)
  }

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      track('app_tour_step', { step: stepIndex })
      setStepIndex(i => i + 1)
    } else {
      dismiss()
    }
  }

  if (!active || !spotlight || !tooltipPos) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[90] pointer-events-none">
      {/* Dark overlay with cutout using SVG */}
      <svg
        className="absolute inset-0 pointer-events-auto"
        style={{ width: '100%', height: '100%' }}
        onClick={next}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx={12}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(44, 26, 14, 0.72)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: 12,
          border: '2px solid rgba(196,103,58,0.8)',
          boxShadow: '0 0 0 4px rgba(196,103,58,0.2)',
          transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute pointer-events-auto"
        style={{
          top: Math.max(8, tooltipPos.top),
          left: tooltipPos.left,
          width: Math.min(280, window.innerWidth - 32),
          transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)',
          zIndex: 91,
        }}
      >
        {/* Arrow pointing down toward spotlight */}
        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: tooltipPos.arrowLeft - 8,
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(255,248,243,0.97)',
            filter: 'drop-shadow(0 2px 4px rgba(44,26,14,0.15))',
          }}
        />

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,248,243,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 8px 32px rgba(44,26,14,0.18), 0 2px 8px rgba(44,26,14,0.1)',
            border: '1px solid rgba(196,103,58,0.2)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{step.icon}</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--terra-dark)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {step.title}
            </p>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--terra-mid)', lineHeight: 1.5 }}>
            {step.desc}
          </p>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: '50%',
                    width: i === stepIndex ? 16 : 6,
                    height: 6,
                    background: i === stepIndex ? 'var(--terra)' : 'rgba(196,103,58,0.25)',
                    transition: 'all 250ms',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {!isLast && (
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss() }}
                  style={{ fontSize: 12, color: 'var(--terra-mid)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  Hopp over
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); next() }}
                style={{
                  fontSize: 13, fontWeight: 600, color: 'white',
                  background: 'var(--terra)', border: 'none', cursor: 'pointer',
                  padding: '7px 16px', borderRadius: 20,
                }}
              >
                {isLast ? 'Kom i gang! 🏡' : 'Forstått →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
