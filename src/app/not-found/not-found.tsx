// Path of this file: src/app/not-found/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
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
        🔍
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
        <h1 className="font-display" style={{
          fontSize: '22px',
          color: 'var(--terra-dark)',
          letterSpacing: '-0.025em',
        }}>
          Siden finnes ikke
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--terra-mid)', lineHeight: 1.5 }}>
          Lenken kan være feil, eller siden har blitt fjernet.
        </p>
      </div>

      <Link
        href="/"
        style={{
          padding: '10px 20px',
          borderRadius: '12px',
          background: 'var(--terra)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        Tilbake til forsiden
      </Link>
    </div>
  )
}
