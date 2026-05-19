'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const scenarios = [
  { emoji: '👗', name: 'Mia', text: 'Lånte kjole til bryllupet – sparte 3000 kr!' },
  { emoji: '🏕️', name: 'Jonas', text: 'Lånte telt og soveposer av fetteren min. Sommerferien er i boks!' },
  { emoji: '⛵', name: 'Erik', text: 'Båten brukes av tre familier. Village styrer hvem som har tilgang og når.' },
  { emoji: '🔧', name: 'Sara', text: 'Naboene deler verktøy. Ingen trenger å eie alt selv lenger.' },
]

const MockScreen = ({ emoji, label }: { emoji: string; label: string }) => (
  <div
    className="rounded-2xl overflow-hidden flex-shrink-0 w-32"
    style={{
      background: 'rgba(252,254,255,0.12)',
      border: '1px solid rgba(252,254,255,0.20)',
      backdropFilter: 'blur(12px)',
    }}
  >
    <div className="h-20 flex items-center justify-center text-4xl" style={{ background: 'rgba(46,98,113,0.25)' }}>
      {emoji}
    </div>
    <div className="px-2 py-2">
      <div className="h-2 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.45)', width: '80%' }} />
      <div className="h-2 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.25)', width: '60%' }} />
      <div className="mt-2 rounded-lg py-1 px-2 text-center" style={{ background: 'rgba(46,98,113,0.65)' }}>
        <span className="text-white text-xs font-medium">{label}</span>
      </div>
    </div>
  </div>
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Feil e-post eller passord')
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user!.id)
      .single()
    const redirect = sessionStorage.getItem('redirectAfterLogin')
    if (redirect) {
      sessionStorage.removeItem('redirectAfterLogin')
      window.location.href = redirect
    } else if (!profile?.name) {
      router.push('/onboarding')
    } else {
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)' }}
    >
      <div className="flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:px-12 lg:py-12">

        {/* ── Left / Top: Branding + social proof ── */}
        <div className="flex flex-col items-center lg:items-start px-6 pt-14 pb-6 lg:pt-0 lg:pb-0 lg:max-w-lg lg:flex-1">
          {/* Logo */}
          <div className="mb-5 lg:mb-6">
            <div className="text-5xl mb-3 lg:text-6xl">🏘️</div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-1 font-display">
              Village
            </h1>
            <p className="text-white/80 text-lg font-medium">Tenk om tingene dine kunne gledet venner og familie?</p>
          </div>

          {/* Origin story */}
          <p
            className="text-white/50 text-sm leading-relaxed mb-6 max-w-sm lg:max-w-none"
            style={{ fontStyle: 'italic' }}
          >
            For oss småbarnsforeldre og mange andre er det helt nødvendig å kunne låne utstyr av venner og bekjente. Det er derfor vi har laget Village – og nå bruker vi det også til å dele verktøy med naboer, legge hyttekabal med familien og få oversikt over hvem vi har lånt hva av.
          </p>

          {/* Speech bubbles */}
          <div className="flex flex-col gap-3 w-full max-w-sm mb-8">
            {scenarios.map((s, i) => (
              <div
                key={s.name}
                className="flex items-start gap-3"
                style={{ opacity: 0.95 - i * 0.06 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                  style={{ background: 'rgba(46,98,113,0.55)', border: '1.5px solid rgba(255,255,255,0.20)' }}
                >
                  {s.emoji}
                </div>
                <div
                  className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/90 max-w-xs"
                  style={{
                    background: 'rgba(252,254,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span className="font-semibold text-white/60 text-xs block mb-0.5">{s.name}</span>
                  {s.text}
                </div>
              </div>
            ))}
          </div>
        </div>{/* ── End Left column ── */}

        {/* ── Right / Bottom: Login card ── */}
        <div
          className="rounded-t-3xl lg:rounded-3xl px-6 pt-8 pb-10 lg:w-[400px] lg:flex-shrink-0 lg:self-center glass-heavy"
        >
          <h2
            className="text-2xl font-bold mb-1 font-display"
            style={{ color: 'var(--terra-dark)' }}
          >
            Logg inn
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--terra-mid)' }}>
            Ny her?{' '}
            <a href="/register" className="font-medium underline underline-offset-2" style={{ color: 'var(--terra)' }}>
              Opprett konto
            </a>
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="E-postadresse"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-white rounded-xl px-4 py-3.5 outline-none transition-colors"
              style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-dark)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--terra)')}
              onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
            />
            <input
              type="password"
              placeholder="Passord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-white rounded-xl px-4 py-3.5 outline-none transition-colors"
              style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-dark)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--terra)')}
              onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary mt-1"
            >
              {loading ? '…' : 'Logg inn'}
            </button>
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--glass-border)' }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ background: 'var(--glass-bg-heavy)', color: 'var(--terra-mid)' }}>
                eller
              </span>
            </div>
          </div>

          <a
            href="/register"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold btn-glass"
          >
            Opprett konto gratis
          </a>

          <p className="text-xs text-center mt-5" style={{ color: 'var(--terra-mid)' }}>
            Ved å logge inn godtar du våre{' '}
            <a href="/terms" className="underline">vilkår</a> og{' '}
            <a href="/privacy" className="underline">personvernpolicy</a>.
          </p>
        </div>{/* ── End Right column ── */}

      </div>
    </div>
  )
}
