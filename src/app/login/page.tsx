'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-[#2C1A0E] mb-1">Village</h1>
        <p className="text-[#9C7B65] mb-8">Lån og lån bort i kretsen din</p>

        {sent ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-[#2C1A0E] font-medium">Sjekk e-posten din</p>
            <p className="text-[#9C7B65] text-sm mt-1">Vi sendte en innloggingslenke til {email}</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <input
              type="email"
              placeholder="din@epost.no"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
            >
              {loading ? 'Sender…' : 'Send innloggingslenke'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}