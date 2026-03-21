'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DeleteAccountPage() {
  const [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleting(false); return }
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-40 page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <button onClick={() => router.back()} className="text-sm mb-2 block" style={{ color: 'var(--terra)' }}>← Tilbake</button>
        <h1 className="page-header-title font-display">Slett konto</h1>
      </div>

      <div className="px-4 pt-6 flex flex-col gap-5">
        <div className="glass rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-base" style={{ color: 'var(--terra-dark)' }}>Dette kan ikke angres</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            Når kontoen slettes, fjernes alle dine gjenstander, lånehistorikk, meldinger og tilkoblinger permanent. Det er ikke mulig å gjenopprette data i etterkant.
          </p>
          <ul className="text-sm flex flex-col gap-1.5 mt-1" style={{ color: 'var(--terra-mid)' }}>
            {['Alle gjenstander du har lagt ut slettes', 'Aktive og tidligere lån fjernes', 'Meldinger og varslinger slettes', 'Vennskap og kretser-tilhørighet fjernes'].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">✕</span> {item}
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-red-500 flex-shrink-0"
          />
          <span className="text-sm" style={{ color: 'var(--terra-dark)' }}>
            Jeg forstår at kontoen og all data slettes permanent og ikke kan gjenopprettes.
          </span>
        </label>

        <button
          onClick={handleDelete}
          disabled={!confirmed || deleting}
          className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ background: '#ef4444' }}
        >
          {deleting ? 'Sletter…' : 'Slett konto permanent'}
        </button>

        <button onClick={() => router.back()} className="btn-glass w-full py-3 rounded-xl text-sm">
          Avbryt
        </button>
      </div>
      <div className="nav-spacer" />
    </div>
  )
}