'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError('')
  const supabase = createClient()

  if (mode === 'login') {
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
  } else {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        email,
        name: '',
      })
    }
    router.push('/onboarding')
  }

  setLoading(false)
}

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #6B4226 60%, #C4673A 100%)' }}>

      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🏘️</div>
          <h1 className="text-4xl font-bold text-white mb-2">Village</h1>
          <p className="text-white/60 text-lg">Lån og lån bort i kretsen din</p>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-3 w-full max-w-xs mb-10">
          {[
            { emoji: '👗', text: 'Lån kjoler til bryllup' },
            { emoji: '🍼', text: 'Del babyutstyr med andre foreldre' },
            { emoji: '🔧', text: 'Del en god bok med bedre venner' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="text-xl">{f.emoji}</span>
              <span className="text-white/80 text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom card */}
      <div className="bg-[#FAF7F2] rounded-t-3xl px-6 pt-8 pb-10">
        {/* Mode toggle */}
        <div className="flex bg-[#E8DDD0] rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-[#2C1A0E] shadow-sm' : 'text-[#9C7B65]'}`}
          >
            Logg inn
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'register' ? 'bg-white text-[#2C1A0E] shadow-sm' : 'text-[#9C7B65]'}`}
          >
            Registrer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            className="bg-[#C4673A] text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 mt-1 transition-opacity"
          >
            {loading ? '…' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="text-xs text-center text-[#9C7B65] mt-4">
            Ved å registrere deg godtar du våre vilkår og personvernpolicy.
          </p>
        )}
      </div>
    </div>
  )
}