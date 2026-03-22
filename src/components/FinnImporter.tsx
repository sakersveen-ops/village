'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { track, Events, startTimer } from '@/lib/track'

interface FinnItem {
  name: string
  category: string
  description: string
  image_url: string | null
  finn_url: string
  is_rental_candidate: boolean
  price: number | null
}

interface Props {
  /** Called after items are successfully imported */
  onImported?: (count: number) => void
  /** Optional: pre-set community_id for all imported items */
  communityId?: string
}

type Step = 'input' | 'loading' | 'review' | 'importing' | 'done'

export default function FinnImporter({ onImported, communityId }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [userId, setUserId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [items, setItems] = useState<FinnItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)

  async function fetchFromFinn() {
    setError('')
    // Accept full URL or just the ID
    const rawInput = userId.trim()
    const match = rawInput.match(/userId=(\d+)/) ?? rawInput.match(/^(\d+)$/)
    const id = match?.[1] ?? ''

    if (!id) {
      setError('Skriv inn en gyldig finn.no bruker-ID eller URL')
      return
    }

    setStep('loading')
    track('finn_import_started', { user_id_length: id.length })

    try {
      const res = await fetch('/api/finn-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Noe gikk galt')
        setStep('input')
        return
      }

      const fetchedItems: FinnItem[] = data.items ?? []
      setItems(fetchedItems)
      setProfileName(data.profile_name ?? '')

      // Pre-select rental candidates
      const candidates = new Set(
        fetchedItems
          .map((item, i) => (item.is_rental_candidate ? i : -1))
          .filter((i) => i >= 0)
      )
      setSelected(candidates)
      setStep('review')
      track('finn_import_fetched', { total: fetchedItems.length, candidates: candidates.size })
    } catch {
      setError('Nettverksfeil. Prøv igjen.')
      setStep('input')
    }
  }

  function toggleItem(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(items.map((_, i) => i)))
  }

  function selectNone() {
    setSelected(new Set())
  }

  async function importSelected() {
    if (selected.size === 0) return
    setStep('importing')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Du må være innlogget')
      setStep('review')
      return
    }

    const t = startTimer()
    const toInsert = [...selected].map((i) => {
      const item = items[i]
      return {
        owner_id: user.id,
        name: item.name,
        category: item.category,
        description: item.description,
        image_url: item.image_url,
        price: item.price,
        available: true,
        community_id: communityId ?? null,
      }
    })

    const { error: insertError, data: inserted } = await supabase
      .from('items')
      .insert(toInsert)
      .select('id')

    if (insertError) {
      setError('Kunne ikke lagre gjenstander: ' + insertError.message)
      setStep('review')
      return
    }

    const count = inserted?.length ?? toInsert.length
    setImportedCount(count)
    setStep('done')

    track(Events.ITEM_PUBLISHED, {
      category: 'finn_import_batch',
      count,
      duration_ms: t(),
    })

    onImported?.(count)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="glass-heavy" style={{ borderRadius: 20, padding: '24px 20px', maxWidth: 560, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🏪</span>
        <div>
          <h2 className="font-display" style={{ fontSize: 20, color: 'var(--terra-dark)', margin: 0 }}>
            Importer fra finn.no
          </h2>
          <p style={{ fontSize: 13, color: 'var(--terra-mid)', margin: 0, marginTop: 2 }}>
            Koble til din finn.no-profil og hent gjenstander automatisk
          </p>
        </div>
      </div>

      {/* Step: input */}
      {step === 'input' && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--terra-dark)', marginBottom: 8 }}>
            finn.no bruker-ID eller profil-URL
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchFromFinn()}
            placeholder="f.eks. 1770173239 eller finn.no/profile/ads?userId=…"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1.5px solid rgba(196,103,58,0.25)',
              background: 'rgba(255,248,243,0.7)',
              fontSize: 15,
              color: 'var(--terra-dark)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 8 }}>
            Finn din ID på{' '}
            <a
              href="https://www.finn.no/profile/ads"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--terra)', textDecoration: 'underline' }}
            >
              finn.no/profile/ads
            </a>
            {' '}— URL-en inneholder bruker-ID-en din
          </p>
          {error && (
            <p style={{ fontSize: 13, color: '#c0392b', marginTop: 8 }}>{error}</p>
          )}
          <button
            className="btn-primary"
            onClick={fetchFromFinn}
            style={{ width: '100%', marginTop: 16 }}
            disabled={!userId.trim()}
          >
            Hent gjenstander
          </button>
        </div>
      )}

      {/* Step: loading */}
      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(196,103,58,0.2)',
            borderTopColor: 'var(--terra)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--terra-dark)', fontWeight: 600 }}>Henter annonser fra finn.no…</p>
          <p style={{ color: 'var(--terra-mid)', fontSize: 13, marginTop: 6 }}>AI analyserer profilen din</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step: review */}
      {step === 'review' && (
        <div>
          {profileName && (
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', marginBottom: 12 }}>
              Profil: <strong style={{ color: 'var(--terra-dark)' }}>{profileName}</strong>
            </p>
          )}

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: 'var(--terra-mid)' }}>Ingen annonser funnet på denne profilen.</p>
              <button className="btn-glass" onClick={() => setStep('input')} style={{ marginTop: 12 }}>
                Prøv igjen
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--terra-mid)', margin: 0 }}>
                  <strong style={{ color: 'var(--terra-dark)' }}>{selected.size}</strong> av {items.length} valgt
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={selectAll}
                    style={{ fontSize: 12, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Velg alle
                  </button>
                  <span style={{ color: 'var(--terra-mid)' }}>·</span>
                  <button
                    onClick={selectNone}
                    style={{ fontSize: 12, color: 'var(--terra-mid)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Fravelg
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                {items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleItem(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${selected.has(i) ? 'rgba(196,103,58,0.5)' : 'rgba(196,103,58,0.15)'}`,
                      background: selected.has(i) ? 'rgba(196,103,58,0.06)' : 'rgba(255,248,243,0.4)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${selected.has(i) ? 'var(--terra)' : 'rgba(156,123,101,0.4)'}`,
                      background: selected.has(i) ? 'var(--terra)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected.has(i) && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Thumbnail */}
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                        background: 'rgba(196,103,58,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        {categoryEmoji(item.category)}
                      </div>
                    )}

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--terra-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || categoryLabel(item.category)}
                      </p>
                    </div>

                    {/* Candidate badge */}
                    {item.is_rental_candidate && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(74,124,89,0.12)',
                        color: 'var(--terra-green)',
                        flexShrink: 0,
                      }}>
                        Utlån ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#c0392b', marginTop: 12 }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn-glass" onClick={() => setStep('input')} style={{ flex: 1 }}>
                  Tilbake
                </button>
                <button
                  className="btn-primary"
                  onClick={importSelected}
                  style={{ flex: 2 }}
                  disabled={selected.size === 0}
                >
                  Legg til {selected.size > 0 ? `${selected.size} ` : ''}gjenstand{selected.size !== 1 ? 'er' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step: importing */}
      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(196,103,58,0.2)',
            borderTopColor: 'var(--terra)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--terra-dark)', fontWeight: 600 }}>Lagrer gjenstander…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step: done */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h3 className="font-display" style={{ fontSize: 20, color: 'var(--terra-dark)', margin: '0 0 8px' }}>
            {importedCount} gjenstand{importedCount !== 1 ? 'er' : ''} lagt til!
          </h3>
          <p style={{ fontSize: 14, color: 'var(--terra-mid)', margin: '0 0 20px' }}>
            De er nå synlige i Village og kan lånes ut til naboer og venner.
          </p>
          <button
            className="btn-glass"
            onClick={() => {
              setStep('input')
              setUserId('')
              setItems([])
              setSelected(new Set())
              setError('')
            }}
          >
            Importer flere
          </button>
        </div>
      )}
    </div>
  )
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    verktøy: '🔧', sport: '⚽', fritid: '🎯', elektronikk: '💻',
    kjøkken: '🍳', hjem: '🏠', transport: '🚲', klær: '👕',
    barn: '🧸', annet: '📦',
  }
  return map[cat] ?? '📦'
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    verktøy: 'Verktøy', sport: 'Sport', fritid: 'Fritid', elektronikk: 'Elektronikk',
    kjøkken: 'Kjøkken', hjem: 'Hjem', transport: 'Transport', klær: 'Klær',
    barn: 'Barn', annet: 'Annet',
  }
  return map[cat] ?? 'Annet'
}
