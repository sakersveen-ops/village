'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track, Events } from '@/lib/track'

type FeedbackType = 'bug' | 'feature' | 'other'

const TYPES: { value: FeedbackType; label: string; emoji: string; desc: string }[] = [
  { value: 'bug',     label: 'Feil',          emoji: '🐛', desc: 'Noe fungerer ikke som forventet' },
  { value: 'feature', label: 'Forslag',        emoji: '💡', desc: 'Ide til forbedring eller ny funksjon' },
  { value: 'other',   label: 'Annet',          emoji: '💬', desc: 'Generell tilbakemelding' },
]

// Map paths to human-readable titles (same map as NavBar)
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/': 'Hjem',
    '/community/search': 'Kretser',
    '/add': 'Legg ut',
    '/notifications': 'Varsler',
    '/profile': 'Min profil',
    '/login': 'Innlogging',
    '/register': 'Registrering',
    '/onboarding': 'Onboarding',
  }
  if (map[pathname]) return map[pathname]
  if (pathname.startsWith('/items/')) return 'Gjenstand'
  if (pathname.startsWith('/profile/')) return 'Profil'
  if (pathname.startsWith('/community/')) return 'Krets'
  if (pathname.startsWith('/loans/')) return 'Lån'
  return pathname
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    }
    getUser()
  }, [])

  const handleOpen = () => {
    setOpen(true)
    setDone(false)
    setMessage('')
    setType('bug')
  }

  const handleClose = () => {
    setOpen(false)
    setDone(false)
  }

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase.from('beta_feedback').insert({
      user_id: userId,
      type,
      message: message.trim(),
      page_path: pathname,
      page_title: getPageTitle(pathname),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })

    if (!error) {
      track(Events.FEEDBACK_SUBMITTED, {
        type,
        page_path: pathname,
      })
      setDone(true)
    }

    setSubmitting(false)
  }

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={handleOpen}
        aria-label="Gi tilbakemelding"
        style={{
          position: 'fixed',
          bottom: 88,           // above bottom nav (nav is ~72px + 12px margin)
          right: 16,
          zIndex: 45,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--terra, #296b49)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(34, 119, 77, 0.4), 0 1px 4px rgba(44,26,14,0.15)',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {/* Bug/chat icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {/* Beta label */}
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#0e2c29',
            color: 'white',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '1px 4px',
            borderRadius: 6,
            lineHeight: 1.4,
          }}
        >
          BETA
        </span>
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="modal-backdrop"
          onClick={handleClose}
          style={{ zIndex: 58 }}
        />
      )}

      {/* ── Drawer sheet ── */}
      <div
        className="glass-heavy"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 59,
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px 40px',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(58, 196, 185, 0.25)',
          margin: '0 auto 20px',
        }} />

        {!done ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2
                  className="font-display"
                  style={{ fontSize: 22, fontWeight: 700, color: 'var(--terra-dark, #0e2c23)', letterSpacing: '-0.025em', margin: 0 }}
                >
                  Gi tilbakemelding
                </h2>
                <p style={{ fontSize: 12, color: 'var(--terra-mid, rgba(46,98,113,0.40))', marginTop: 3 }}>
                  📍 {getPageTitle(pathname)}
                </p>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(196,103,58,0.10)',
                  border: 'none',
                  borderRadius: 10,
                  width: 32, height: 32,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--terra-mid, #5c918c)',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    padding: '10px 4px',
                    border: type === t.value
                      ? '1.5px solid rgba(46,98,113,0.40)'
                      : '1.5px solid rgba(58, 191, 196, 0.15)',
                    background: type === t.value
                      ? 'rgba(196,103,58,0.10)'
                      : 'rgba(243, 255, 253, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{t.emoji}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: type === t.value ? 700 : 500,
                    color: type === t.value ? 'var(--terra, rgba(46,98,113,0.40))' : 'var(--terra-dark, #2C1A0E)',
                  }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Type description */}
            <p style={{ fontSize: 12, color: 'var(--terra-mid, rgba(46,98,113,0.40))', marginBottom: 12 }}>
              {TYPES.find(t => t.value === type)?.desc}
            </p>

            {/* Message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'Beskriv hva som skjedde og hva du forventet...'
                  : type === 'feature'
                  ? 'Beskriv ideen din...'
                  : 'Hva tenker du?'
              }
              rows={4}
              style={{
                width: '100%',
                borderRadius: 14,
                border: '1.5px solid rgba(196,103,58,0.20)',
                background: 'rgba(243, 255, 254, 0.7)',
                padding: '12px 14px',
                fontSize: 15,
                color: 'var(--terra-dark, #0e2c23)',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(58, 196, 191, 0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(58, 196, 171, 0.2)')}
            />

            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="btn-primary"
              style={{
                width: '100%',
                marginTop: 12,
                borderRadius: 14,
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 600,
                opacity: submitting || !message.trim() ? 0.5 : 1,
                cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '…' : 'Send tilbakemelding'}
            </button>
          </>
        ) : (
          /* ── Success state ── */
          <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
            <h2
              className="font-display"
              style={{ fontSize: 22, fontWeight: 700, color: 'var(--terra-dark, #0e2c26)', letterSpacing: '-0.025em', marginBottom: 8 }}
            >
              Takk for hjelpen!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--terra-mid, rgba(46,98,113,0.40))', lineHeight: 1.5, marginBottom: 24 }}>
              Tilbakemeldingen din er registrert og hjelper oss å gjøre Village bedre.
            </p>
            <button
              onClick={handleClose}
              className="btn-glass"
              style={{ borderRadius: 14, padding: '12px 32px', fontSize: 15 }}
            >
              Lukk
            </button>
          </div>
        )}
      </div>
    </>
  )
}
