'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    console.log('signIn error:', signInError)

    if (signInError) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        console.log('signUp result:', data, signUpError)
        if (signUpError) { setError(signUpError.message); setLoading(false); return }
    }

    const { data: { user } } = await supabase.auth.getUser()
    console.log('user etter login:', user)

    window.location.href = '/'
    }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-[#2C1A0E] mb-1">Village</h1>
        <p className="text-[#9C7B65] mb-8">Lån og lån bort i kretsen din</p>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <input
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
          />
          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loading ? 'Logger inn…' : 'Logg inn / Registrer'}
          </button>
          <p className="text-xs text-center text-[#9C7B65]">Ny bruker? Bare skriv inn e-post og passord så opprettes kontoen automatisk.</p>
        </form>
      </div>
    </div>
  )
}