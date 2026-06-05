'use client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreatedPage() {
  const { id } = useParams()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--glass-bg-heavy)' }}
    >
      <div
        className="glass-heavy rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-5"
        style={{ boxShadow: '0 4px 32px rgba(26,37,48,0.10)' }}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(94,154,120,0.12)', border: '1px solid rgba(94,154,120,0.2)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--terra-green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <div>
          <h1
            className="font-display text-2xl font-bold"
            style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}
          >
            Krets opprettet!
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
            Hva vil du gjøre nå?
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Link href={`/community/${id}`} className="w-full">
            <button className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Gå til kretsen
            </button>
          </Link>

          <Link href={`/add`} className="w-full">
            <button className="btn-glass w-full py-3 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              Legg til gjenstander
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
