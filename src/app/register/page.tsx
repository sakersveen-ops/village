'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { track } from '@/lib/track'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [registered, setRegistered] = useState(false)

  const passwordsMatch = password === passwordConfirm
  const passwordLongEnough = password.length >= 8
  const canSubmit = email && passwordLongEnough && passwordsMatch && !loading

  const handleRegister = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'Denne e-postadressen er allerede registrert. Prøv å logge inn.'
          : 'Noe gikk galt. Sjekk e-posten og prøv igjen.'
      )
      setLoading(false)
      return
    }

    if (!data.user?.identities || data.user.identities.length === 0) {
      setError('Denne e-postadressen er allerede registrert. Prøv å logge inn.')
      setLoading(false)
      return
    }

    track('user_registered', { method: 'email' })
    setLoading(false)
    setRegistered(true)
  }

  const bg = { background: 'linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)' }

  if (registered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={bg}>
        <div className="glass-heavy w-full px-6 py-10 flex flex-col items-center gap-5 text-center" style={{ borderRadius: 24, maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(94,154,120,0.15)',
            border: '2px solid var(--terra-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            ✉️
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
              Sjekk mailen din
            </h2>
            <p style={{ color: 'var(--terra-mid)', fontSize: 15, lineHeight: 1.6 }}>
              Vi har sendt en bekreftelseslenke til{' '}
              <strong style={{ color: 'var(--terra-dark)' }}>{email}</strong>.
              Klikk på lenken i e-posten for å aktivere kontoen din.
            </p>
          </div>
          <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
            Ikke fått noe? Sjekk søppelpost.
          </p>
          <Link href="/login" className="btn-glass w-full text-center" style={{ borderRadius: 14, padding: '14px 0', fontSize: 15 }}>
            Tilbake til innlogging
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={bg}>
      {/* Logo + tagline */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: 'var(--terra)', lineHeight: 1, letterSpacing: '-0.04em' }}>V</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 'clamp(36px, 10vw, 48px)', color: 'white', letterSpacing: '-0.025em', margin: 0, lineHeight: 1 }}>
            Village
          </h1>
        </div>
        <p className="text-white/60 text-sm">Del og lån med folk du stoler på</p>
      </div>

      {/* Card */}
      <div className="glass-heavy w-full px-6 py-8 flex flex-col gap-5" style={{ borderRadius: 24, maxWidth: 400 }}>
        <div>
          <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Lag konto
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Det tar bare ett minutt</p>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>E-post</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="deg@eksempel.no"
            autoComplete="email"
            className="bg-white rounded-xl px-4 py-3.5 outline-none transition-colors w-full"
            style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-dark)', fontSize: 15 }}
            onFocus={e => (e.target.style.borderColor = 'var(--terra)')}
            onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Passord</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minst 8 tegn"
              autoComplete="new-password"
              className="bg-white rounded-xl px-4 py-3.5 pr-12 outline-none transition-colors w-full"
              style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-dark)', fontSize: 15 }}
              onFocus={e => (e.target.style.borderColor = 'var(--terra)')}
              onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--terra-mid)' }}
              aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {password.length > 0 && (
            <div className="flex gap-1.5 mt-0.5">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-1 flex-1 rounded-full transition-all" style={{
                  background: password.length >= n * 4
                    ? n === 1 ? '#e88c5a' : n === 2 ? 'var(--terra)' : 'var(--terra-green)'
                    : 'rgba(46,98,113,0.15)',
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Password confirm */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Bekreft passord</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="Skriv passordet igjen"
            autoComplete="new-password"
            className="bg-white rounded-xl px-4 py-3.5 outline-none transition-colors w-full"
            style={{
              border: `1px solid ${passwordConfirm.length > 0 && !passwordsMatch ? 'rgba(220,38,38,0.45)' : 'var(--glass-border)'}`,
              color: 'var(--terra-dark)',
              fontSize: 15,
            }}
            onFocus={e => (e.target.style.borderColor = passwordConfirm.length > 0 && !passwordsMatch ? 'rgba(220,38,38,0.45)' : 'var(--terra)')}
            onBlur={e => (e.target.style.borderColor = passwordConfirm.length > 0 && !passwordsMatch ? 'rgba(220,38,38,0.45)' : 'var(--glass-border)')}
          />
          {passwordConfirm.length > 0 && !passwordsMatch && (
            <p className="text-xs" style={{ color: '#ef4444' }}>Passordene er ikke like</p>
          )}
          {passwordConfirm.length > 0 && passwordsMatch && passwordLongEnough && (
            <p className="text-xs" style={{ color: 'var(--terra-green)' }}>✓ Passordene stemmer</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 text-sm" style={{ borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleRegister} disabled={!canSubmit} className="btn-primary w-full" style={{ opacity: canSubmit ? 1 : 0.45 }}>
          {loading ? 'Oppretter konto…' : 'Opprett konto'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
          <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>eller</span>
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
        </div>

        <p className="text-center text-sm" style={{ color: 'var(--terra-mid)' }}>
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-semibold underline underline-offset-2" style={{ color: 'var(--terra)' }}>
            Logg inn
          </Link>
        </p>
      </div>

      <p className="text-xs text-center mt-6 max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Ved å opprette konto godtar du at Village lagrer profilen din for å gi deg tjenesten. Ingen data deles med tredjeparter.
      </p>
    </div>
  )
}