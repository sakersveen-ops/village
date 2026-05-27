// Path of this file: src/components/AppTour.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

// ─── Tour steps ────────────────────────────────────────────────────────────────
// 'top' = element is in the top bar → tooltip appears BELOW
// 'bottom' = element is in the bottom nav → tooltip appears ABOVE

const STEPS = [
  {
    target: 'feed',
    icon: '🏠',
    title: 'Feed',
    desc: 'Se hva venner og kretser deler – og ting fra andre på Village.',
    bar: 'bottom' as const,
  },
  {
    target: 'communities',
    icon: '🏘️',
    title: 'Kretser',
    desc: 'Nabolag, barnehage, idrettslag – del og lån innen grupper du stoler på.',
    bar: 'bottom' as const,
  },
  {
    target: 'add',
    icon: '➕',
    title: 'Legg ut',
    desc: 'Del en gjenstand med vennene eller kretsene dine. Du bestemmer hvem som ser den og godkjenner hvert utlån.',
    bar: 'bottom' as const,
  },
  {
    target: 'schedule',
    icon: '📅',
    title: 'Avtaler',
    desc: 'Oversikt over alle aktive og kommende utlån – både som eier og låner.',
    bar: 'bottom' as const,
  },
  {
    target: 'profile',
    icon: '👤',
    title: 'Profil',
    desc: 'Dine gjenstander, ønskeliste og venner samlet på ett sted.',
    bar: 'bottom' as const,
  },
  {
    target: 'notifications',
    icon: '🔔',
    title: 'Varsler',
    desc: 'Låneforespørsler, venneforespørsler og oppdateringer fra kretsene dine.',
    bar: 'top' as const,
  },
  {
    target: 'messages',
    icon: '💬',
    title: 'Meldinger',
    desc: 'Snakk direkte med den du låner av eller til.',
    bar: 'top' as const,
  },
]

const TOOLTIP_WIDTH = 280
const TOOLTIP_HEIGHT = 150 // approximate, used for positioning
const ARROW_SIZE = 8

interface Rect { top: number; left: number; width: number; height: number }

export default function AppTour() {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Rect | null>(null)
  const [tooltip, setTooltip] = useState<{
    top: number; left: number; arrowLeft: number; arrowOnTop: boolean
  } | null>(null)

  // ── Trigger ────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tourDone = localStorage.getItem(`village_tour_done_${user.id}`)
      if (tourDone) return

      const snoozed = localStorage.getItem(`village_tour_snoozed_${user.id}`)
      if (snoozed) {
        if (Date.now() - Number(snoozed) < 3 * 24 * 60 * 60 * 1000) return
        localStorage.removeItem(`village_tour_snoozed_${user.id}`)
      }

      setTimeout(() => setActive(true), 1200)
    })()
  }, [])

  // ── Position spotlight + tooltip ───────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const step = STEPS[stepIndex]
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (!el) return

    const rect = el.getBoundingClientRect()
    const pad = 6
    const W = window.innerWidth

    const spot: Rect = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }
    setSpotlight(spot)

    // Center tooltip horizontally on the element, clamped to screen edges
    const centerX = rect.left + rect.width / 2
    const tw = Math.min(TOOLTIP_WIDTH, W - 32)
    let tooltipLeft = centerX - tw / 2
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, W - tw - 16))
    const arrowLeft = Math.max(12, Math.min(centerX - tooltipLeft, tw - 12))

    if (step.bar === 'top') {
      // Element is in top bar → tooltip BELOW the spotlight
      setTooltip({
        top: spot.top + spot.height + ARROW_SIZE + 4,
        left: tooltipLeft,
        arrowLeft,
        arrowOnTop: true, // arrow points UP toward the element
      })
    } else {
      // Element is in bottom nav → tooltip ABOVE the spotlight
      setTooltip({
        top: spot.top - TOOLTIP_HEIGHT - ARROW_SIZE - 8,
        left: tooltipLeft,
        arrowLeft,
        arrowOnTop: false, // arrow points DOWN toward the element
      })
    }
  }, [active, stepIndex])

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const dismiss = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) localStorage.setItem(`village_tour_done_${user.id}`, '1')
    track('app_tour_dismissed', { step: stepIndex })
    setActive(false)
  }

  const snooze = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) localStorage.setItem(`village_tour_snoozed_${user.id}`, String(Date.now()))
    track('app_tour_snoozed', { step: stepIndex })
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

  if (!active || !spotlight || !tooltip) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const tw = Math.min(TOOLTIP_WIDTH, window.innerWidth - 32)

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">

      {/* ── Dark overlay with cutout ── */}
      <svg className="absolute inset-0 pointer-events-auto" style={{ width: '100%', height: '100%' }} onClick={next}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={spotlight.left} y={spotlight.top} width={spotlight.width} height={spotlight.height} rx={12} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(44, 26, 14, 0.72)" mask="url(#tour-mask)" />
      </svg>

      {/* ── Spotlight glow ring ── */}
      <div className="absolute pointer-events-none" style={{
        top: spotlight.top, left: spotlight.left,
        width: spotlight.width, height: spotlight.height,
        borderRadius: 12,
        border: '2px solid rgba(196,103,58,0.85)',
        boxShadow: '0 0 0 4px rgba(196,103,58,0.22)',
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
      }} />

      {/* ── Tooltip ── */}
      <div className="absolute pointer-events-auto" style={{
        top: Math.max(8, tooltip.top),
        left: tooltip.left,
        width: tw,
        zIndex: 91,
        transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Arrow pointing UP (toward top bar element) */}
        {tooltip.arrowOnTop && (
          <div style={{
            position: 'absolute',
            top: -ARROW_SIZE,
            left: tooltip.arrowLeft - ARROW_SIZE,
            width: 0, height: 0,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
            borderBottom: `${ARROW_SIZE}px solid rgba(255,248,243,0.97)`,
          }} />
        )}

        {/* Tooltip card */}
        <div style={{
          background: 'rgba(255,248,243,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '16px 18px',
          boxShadow: '0 8px 32px rgba(44,26,14,0.18), 0 2px 8px rgba(44,26,14,0.1)',
          border: '1px solid rgba(196,103,58,0.2)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{step.icon}</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--terra-dark)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {step.title}
            </p>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--terra-mid)', lineHeight: 1.55 }}>
            {step.desc}
          </p>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  width: i === stepIndex ? 16 : 6,
                  height: 6,
                  background: i === stepIndex ? 'var(--terra)' : 'rgba(196,103,58,0.25)',
                  transition: 'all 250ms',
                }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {!isLast && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); snooze() }}
                    style={{ fontSize: 12, color: 'var(--terra-mid)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                    Senere
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); dismiss() }}
                    style={{ fontSize: 12, color: 'var(--terra-mid)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                    Hopp over
                  </button>
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); next() }}
                style={{
                  fontSize: 13, fontWeight: 600, color: 'white',
                  background: 'var(--terra)', border: 'none', cursor: 'pointer',
                  padding: '7px 16px', borderRadius: 20,
                }}>
                {isLast ? 'Kom i gang! 🏡' : 'Forstått →'}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointing DOWN (toward bottom nav element) */}
        {!tooltip.arrowOnTop && (
          <div style={{
            position: 'absolute',
            bottom: -ARROW_SIZE,
            left: tooltip.arrowLeft - ARROW_SIZE,
            width: 0, height: 0,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
            borderTop: `${ARROW_SIZE}px solid rgba(255,248,243,0.97)`,
          }} />
        )}
      </div>
    </div>
  )
}
