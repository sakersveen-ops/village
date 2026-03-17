'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track } from '@/lib/track'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const passwordsMatch = password === passwordConfirm
  const passwordLongEnough = password.length >= 8
  const canSubmit = email && passwordLongEnough && passwordsMatch && !loading

  const handleRegister = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
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

    track('user_registered', { method: 'email' })
    router.push('/onboarding')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(160deg, #FFF5EE 0%, #F5E6D8 50%, #EDD5C0 100%)' }}
    >
      {/* Logo / brand */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🏡</div>
        <h1
          className="font-display text-4xl font-bold"
          style={{ color: 'var(--terra-dark)', letterSpacing: '-0.03em' }}
        >
          Village
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Del og lån med folk du stoler på
        </p>
      </div>

      {/* Card */}
      <div
        className="glass-heavy w-full max-w-sm px-6 py-8 flex flex-col gap-5"
        style={{ borderRadius: 24 }}
      >
        <div>
          <h2
            className="font-display text-2xl font-bold"
            style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}
          >
            Lag konto
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
            Det tar bare ett minutt
          </p>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--terra-mid)' }}
          >
            E-post
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="deg@eksempel.no"
            autoComplete="email"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--terra-mid)' }}
          >
            Passord
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minst 8 tegn"
              autoComplete="new-password"
              className="glass px-4 py-3 pr-12 outline-none w-full"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }}
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

          {/* Strength hint */}
          {password.length > 0 && (
            <div className="flex gap-1.5 mt-1">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{
                    background:
                      password.length >= n * 4
                        ? n === 1
                          ? '#e88c5a'
                          : n === 2
                          ? '#c4673a'
                          : 'var(--terra-green)'
                        : 'rgba(196,103,58,0.15)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Password confirm */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--terra-mid)' }}
          >
            Bekreft passord
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="Skriv passordet igjen"
            autoComplete="new-password"
            className="glass px-4 py-3 outline-none w-full"
            style={{
              borderRadius: 14,
              color: 'var(--terra-dark)',
              fontSize: 15,
              borderColor:
                passwordConfirm.length > 0 && !passwordsMatch
                  ? 'rgba(220,38,38,0.45)'
                  : undefined,
            }}
          />
          {passwordConfirm.length > 0 && !passwordsMatch && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              Passordene er ikke like
            </p>
          )}
          {passwordConfirm.length > 0 && passwordsMatch && passwordLongEnough && (
            <p className="text-xs" style={{ color: 'var(--terra-green)' }}>
              ✓ Passordene stemmer
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 text-sm"
            style={{
              borderRadius: 12,
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.25)',
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleRegister}
          disabled={!canSubmit}
          className="btn-primary w-full"
          style={{
            borderRadius: 14,
            padding: '14px 0',
            fontSize: 15,
            fontWeight: 600,
            opacity: canSubmit ? 1 : 0.45,
          }}
        >
          {loading ? 'Oppretter konto…' : 'Opprett konto'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(196,103,58,0.18)' }} />
          <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>
            eller
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(196,103,58,0.18)' }} />
        </div>

        {/* Login link */}
        <p className="text-center text-sm" style={{ color: 'var(--terra-mid)' }}>
          Har du allerede en konto?{' '}
          <Link
            href="/login"
            className="font-semibold"
            style={{ color: 'var(--terra)' }}
          >
            Logg inn
          </Link>
        </p>
      </div>

      {/* Fine print */}
      <p className="text-xs text-center mt-6 max-w-xs" style={{ color: 'var(--terra-mid)' }}>
        Ved å opprette konto godtar du at Village lagrer profilen din for å gi deg tjenesten.
        Ingen data deles med tredjeparter.
      </p>
    </div>
  )
}
