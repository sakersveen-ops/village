'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      gap: '20px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}>
        ⚠️
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
        <h1 className="font-display" style={{
          fontSize: '22px',
          color: 'var(--terra-dark)',
          letterSpacing: '-0.025em',
        }}>
          Noe gikk galt
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--terra-mid)', lineHeight: 1.5 }}>
          Det oppsto en uventet feil. Prøv igjen, eller gå tilbake til forsiden.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            background: 'var(--terra)',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Prøv igjen
        </button>
        <a
          href="/"
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--terra-dark)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Hjem
        </a>
      </div>
    </div>
  )
}
