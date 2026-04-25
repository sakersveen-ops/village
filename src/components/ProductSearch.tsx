'use client'

import { useState, useRef, useCallback } from 'react'
import type { ProductResult } from '@/app/api/product-search/route'

interface Props {
  onSelect: (product: ProductResult) => void
}

export default function ProductSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); setError(null); return }
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const res = await fetch(`/api/product-search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Søk feilet')
      const data = await res.json()
      const hits = data.results ?? []
      setResults(hits)
      if (hits.length === 0) {
        setError('Ingen treff. Prøv et mer spesifikt navn, f.eks. "Stokke Tripp Trapp" eller "BABYBJÖRN bæresele".')
      }
    } catch {
      setError('Søket feilet. Sjekk nettforbindelsen og prøv igjen.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (val: string) => {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    // Litt lengre debounce siden Claude-søk tar noe tid
    timerRef.current = setTimeout(() => search(val), 700)
  }

  // TODO: bytt ut simulering med ekte @zxing/browser kamera-decode
  // const barcode = await scanBarcodeWithCamera()
  // const res = await fetch(`/api/product-search?barcode=${barcode}`)
  const handleScan = async () => {
    setScanLoading(true)
    setError(null)
    setResults([])
    try {
      await new Promise(r => setTimeout(r, 1200))
      const res = await fetch(`/api/product-search?barcode=8712930089193`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.results?.length === 1) {
        onSelect(data.results[0])
        return
      }
      setResults(data.results ?? [])
    } catch {
      setError('Strekkode-scan feilet. Søk manuelt.')
    } finally {
      setScanLoading(false)
    }
  }

  return (
    <div>
      {/* To likeverdige innganger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>

        <label style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          background: 'rgba(255,248,243,0.92)', border: '1.5px solid rgba(196,103,58,0.2)',
          borderRadius: '14px', padding: '12px 14px', cursor: 'text',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Søk</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={e => handleInput(e.target.value)}
              placeholder="Produktnavn eller merke"
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: '14px', color: 'var(--terra-dark)', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </label>

        <button
          onClick={handleScan}
          disabled={scanLoading}
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: scanLoading ? 'rgba(196,103,58,0.08)' : 'rgba(255,248,243,0.92)',
            border: '1.5px solid rgba(196,103,58,0.2)',
            borderRadius: '14px', padding: '12px 14px',
            cursor: scanLoading ? 'default' : 'pointer',
            textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { if (!scanLoading) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,103,58,0.5)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,103,58,0.2)' }}
        >
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scan</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            {scanLoading ? <Spinner /> : <CameraIcon />}
            <span style={{ fontSize: '14px', color: 'var(--terra-dark)' }}>
              {scanLoading ? 'Leser...' : 'Strekkode'}
            </span>
          </div>
        </button>
      </div>

      {/* Loading — viser hint om at dette tar litt lenger */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
          <Spinner />
          <span style={{ fontSize: '13px', color: 'var(--terra-mid)' }}>
            Søker etter {query}…
          </span>
        </div>
      )}

      {/* Feilmelding */}
      {error && !loading && (
        <p style={{
          fontSize: '13px', color: '#A83200',
          background: 'rgba(196,103,58,0.08)', borderRadius: '10px',
          padding: '10px 12px', marginBottom: '10px',
        }}>
          {error}
        </p>
      )}

      {/* Resultater */}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            {results.length} treff
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'rgba(255,248,243,0.92)', border: '1px solid rgba(196,103,58,0.18)',
                  borderRadius: '14px', padding: '12px', cursor: 'pointer',
                  textAlign: 'left', transition: 'border-color 0.15s, transform 0.1s',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(196,103,58,0.5)'
                  e.currentTarget.style.transform = 'scale(0.99)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(196,103,58,0.18)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(196,103,58,0.08)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {p.imageUrl
                    ? <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    : <ProductIcon />
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px', fontWeight: 500, color: 'var(--terra-dark)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px',
                  }}>{p.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--terra-mid)' }}>{p.brand}</p>
                </div>

                <ChevronIcon />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="4.5" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="#9C7B65" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="2.5" stroke="#9C7B65" strokeWidth="1.5" />
      <path d="M5.5 4L6.5 2h3l1 2" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProductIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M20 7L12 3L4 7V17L12 21L20 17V7Z" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3V21M4 7L12 11L20 7" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5 3L9 7L5 11" stroke="#9C7B65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Spinner() {
  return (
    <div style={{
      width: '16px', height: '16px', borderRadius: '50%',
      border: '2px solid rgba(196,103,58,0.2)',
      borderTopColor: 'var(--terra)',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}
