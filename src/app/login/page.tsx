'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const scenarios = [
  { emoji: '👗', name: 'Mia', text: 'Lånte kjole til bryllupet – sparte 3000 kr!' },
  { emoji: '🍼', name: 'Jonas', text: 'Fikk låne bæresele av naboen. Perfekt!' },
  { emoji: '🔧', name: 'Lena', text: 'Bor bored? Noen lånte meg en Festool!' },
  { emoji: '📚', name: 'Erik', text: 'Delte bøker med hele kretsen vår.' },
  { emoji: '⛺', name: 'Sara', text: 'Lånte telt til Rondane i helga.' },
]

// Mock "screenshots" as illustrated UI cards
const MockScreen = ({ emoji, label }: { emoji: string; label: string }) => (
  <div
    className="rounded-2xl overflow-hidden flex-shrink-0 w-32"
    style={{
      background: 'rgba(255,248,243,0.18)',
      border: '1px solid rgba(255,248,243,0.25)',
      backdropFilter: 'blur(12px)',
    }}
  >
    <div className="h-20 flex items-center justify-center text-4xl" style={{ background: 'rgba(196,103,58,0.2)' }}>
      {emoji}
    </div>
    <div className="px-2 py-2">
      <div className="h-2 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.5)', width: '80%' }} />
      <div className="h-2 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.3)', width: '60%' }} />
      <div className="mt-2 rounded-lg py-1 px-2 text-center" style={{ background: 'rgba(196,103,58,0.7)' }}>
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
      style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #6B4226 55%, #C4673A 100%)' }}
    >
      {/* ── Desktop layout: two-column ── */}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:px-12 lg:py-12">

        {/* ── Left / Top: Branding + social proof ── */}
        <div className="flex flex-col items-center lg:items-start px-6 pt-14 pb-6 lg:pt-0 lg:pb-0 lg:max-w-md lg:flex-1">
          {/* Logo */}
          <div className="mb-6 lg:mb-8">
            <div className="text-5xl mb-3 lg:text-6xl">🏘️</div>
            <h1
              className="text-5xl lg:text-6xl font-bold text-white mb-1"
              style={{ fontFamily: 'var(--font-display, Georgia)', letterSpacing: '-0.03em' }}
            >
              Village
            </h1>
            <p className="text-white/60 text-lg">Lån og lån bort i kretsen din</p>
          </div>

          {/* Speech bubbles */}
          <div className="flex flex-col gap-3 w-full max-w-sm mb-8">
            {scenarios.map((s, i) => (
              <div
                key={s.name}
                className="flex items-start gap-3"
                style={{ opacity: 0.95 - i * 0.06 }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                  style={{ background: 'rgba(196,103,58,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                >
                  {s.emoji}
                </div>
                {/* Bubble */}
                <div
                  className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/90 max-w-xs"
                  style={{
                    background: 'rgba(255,248,243,0.12)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span className="font-semibold text-white/70 text-xs block mb-0.5">{s.name}</span>
                  {s.text}
                </div>
              </div>
            ))}
          </div>

          {/* Mock app screens – decorative */}
          <div className="flex gap-3 overflow-x-auto pb-2 w-full max-w-sm lg:max-w-none scrollbar-hide">
            <MockScreen emoji="👗" label="Lån nå" />
            <MockScreen emoji="🔧" label="Tilgjengelig" />
            <MockScreen emoji="⛺" label="Lån bort" />
            <MockScreen emoji="📚" label="Se kretsene" />
          </div>
        </div>

        {/* ── Right / Bottom: Login card ── */}
        <div
          className="rounded-t-3xl lg:rounded-3xl px-6 pt-8 pb-10 lg:w-[400px] lg:flex-shrink-0 lg:self-center"
          style={{ background: '#FAF7F2' }}
        >
          <h2
            className="text-2xl font-bold text-[#2C1A0E] mb-1"
            style={{ fontFamily: 'var(--font-display, Georgia)', letterSpacing: '-0.02em' }}
          >
            Logg inn
          </h2>
          <p className="text-sm text-[#9C7B65] mb-6">
            Ny her?{' '}
            <a href="/register" className="text-[#C4673A] font-medium underline underline-offset-2">
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
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] transition-colors"
            />
            <input
              type="password"
              placeholder="Passord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] transition-colors"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary rounded-xl py-3.5 font-semibold disabled:opacity-50 mt-1 transition-opacity"
            >
              {loading ? '…' : 'Logg inn'}
            </button>
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8DDD0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#FAF7F2] px-3 text-[#9C7B65]">eller</span>
            </div>
          </div>

          <a
            href="/register"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-[#2C1A0E] transition-colors border border-[#E8DDD0] hover:border-[#C4673A] hover:text-[#C4673A]"
          >
            Opprett konto gratis
          </a>

          <p className="text-xs text-center text-[#9C7B65] mt-5">
            Ved å logge inn godtar du våre{' '}
            <a href="/terms" className="underline">vilkår</a> og{' '}
            <a href="/privacy" className="underline">personvernpolicy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
