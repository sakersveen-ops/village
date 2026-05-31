// Path: src/app/reset-password/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // PKCE flow: exchange the `code` param for a session
    const exchangeCode = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          setValidSession(true)
          return
        }
      }
      // Fallback: implicit flow via hash (PASSWORD_RECOVERY event)
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setValidSession(true)
        }
      })
    }

    exchangeCode()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passordene er ikke like')
      return
    }
    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Noe gikk galt. Prøv å be om en ny lenke.')
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => router.push('/'), 2500)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: '#E1F5EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              color: 'var(--terra)',
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}>V</span>
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 36, color: 'white', letterSpacing: '-0.025em', margin: 0, lineHeight: 1 }}
          >
            Village
          </h1>
        </div>

        <div className="glass-heavy rounded-3xl px-6 pt-8 pb-10">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <h2 className="font-display text-2xl mb-2" style={{ color: 'var(--terra-dark)' }}>
                Passord oppdatert!
              </h2>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
                Du blir sendt til forsiden…
              </p>
            </div>
          ) : !validSession ? (
            <div className="text-center py-4">
              <h2 className="font-display text-2xl mb-2" style={{ color: 'var(--terra-dark)' }}>
                Laster…
              </h2>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
                Verifiserer lenken din.
              </p>
            </div>
          ) : (
            <>
              <h2
                className="text-2xl font-bold mb-1 font-display"
                style={{ color: 'var(--terra-dark)' }}
              >
                Nytt passord
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--terra-mid)' }}>
                Velg et nytt passord for kontoen din.
              </p>

              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Nytt passord (min. 8 tegn)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-white rounded-xl px-4 py-3.5 outline-none transition-colors"
                  style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-dark)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--terra)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
                />
                <input
                  type="password"
                  placeholder="Bekreft passord"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
                  disabled={loading || !password || !confirm}
                  className="btn-primary mt-1"
                >
                  {loading ? '…' : 'Oppdater passord'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
