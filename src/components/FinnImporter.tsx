'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { track, Events, startTimer } from '@/lib/track'

interface FinnItem {
  name: string
  category: string
  description: string
  image_url: string | null
  is_rental_candidate: boolean
  is_rental_listing: boolean   // true if title contains "til leie"/"utleie" etc.
  price: number | null
}

type FilterMode = 'rental_only' | 'all'

interface Props {
  onImported?: (count: number) => void
  communityId?: string
}

type Step = 'input' | 'loading' | 'review' | 'importing' | 'done'

export default function FinnImporter({ onImported, communityId }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [filterMode, setFilterMode] = useState<FilterMode>('rental_only')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [items, setItems] = useState<FinnItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImages(files)
    setError('')
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, j) => j !== i))
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i])
      return prev.filter((_, j) => j !== i)
    })
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function analyseScreenshots() {
    if (!images.length) return
    setError('')
    setStep('loading')
    track('finn_import_started', { screenshot_count: images.length, filter_mode: filterMode })

    try {
      const base64Images = await Promise.all(images.map(fileToBase64))

      const content: object[] = base64Images.map((data, i) => ({
        type: 'image',
        source: { type: 'base64', media_type: images[i].type || 'image/jpeg', data },
      }))

      content.push({
        type: 'text',
        text: `Dette er skjermbilder fra en finn.no-profil. Ekstraher alle annonser/gjenstander du kan se.

For hver annonse:
- name: tittel på annonsen
- category: verktøy/sport/fritid/elektronikk/kjøkken/hjem/transport/klær/barn/annet
- description: maks 80 tegn
- image_url: null
- is_rental_candidate: true hvis gjenstanden egner seg for utlån (verktøy, utstyr, fritidsutstyr, kjøretøy osv.)
- is_rental_listing: true hvis tittelen inneholder ord som "til leie", "utleie", "leies ut", "leiepris" eller lignende — altså annonser som eksplisitt er ment for utleie
- price: leiepris som tall (kun NOK/dag eller NOK/uke) eller null

Svar KUN med JSON: {"items":[...]}
Ingen forklaring, ingen markdown.`,
      })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content }],
        }),
      })

      if (!res.ok) { setError('AI-analyse feilet. Prøv igjen.'); setStep('input'); return }

      const aiData = await res.json()
      const raw = aiData.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''

      let parsed: { items: FinnItem[] } = { items: [] }
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      } catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) { try { parsed = JSON.parse(match[0]) } catch { /* leave empty */ } }
      }

      const allItems = parsed.items ?? []
      // Apply filter mode
      const filtered = filterMode === 'rental_only'
        ? allItems.filter((it: FinnItem) => it.is_rental_listing)
        : allItems

      setItems(filtered)

      // Pre-select all when rental_only (they've already been filtered), else rental candidates
      const toPreselect = filterMode === 'rental_only'
        ? new Set<number>(filtered.map((_: FinnItem, i: number) => i))
        : new Set<number>(
            filtered.reduce((acc: number[], it: FinnItem, i: number) => {
              if (it.is_rental_candidate) acc.push(i)
              return acc
            }, [])
          )

      setSelected(toPreselect)
      setStep('review')
      track('finn_import_fetched', {
        total_found: allItems.length,
        after_filter: filtered.length,
        filter_mode: filterMode,
        pre_selected: toPreselect.size,
      })
    } catch (err) {
      console.error(err)
      setError('Noe gikk galt. Prøv igjen.')
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

  async function importSelected() {
    if (!selected.size) return
    setStep('importing')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Du må være innlogget'); setStep('review'); return }

    const t = startTimer()
    const toInsert = [...selected].map((i) => ({
      owner_id: user.id,
      name: items[i].name,
      category: items[i].category,
      description: items[i].description,
      image_url: null,
      price: items[i].price,
      available: true,
      community_id: communityId ?? null,
    }))

    const { error: insertError, data: inserted } = await supabase
      .from('items')
      .insert(toInsert)
      .select('id')

    if (insertError) { setError('Kunne ikke lagre: ' + insertError.message); setStep('review'); return }

    const count = inserted?.length ?? toInsert.length
    setImportedCount(count)
    setStep('done')
    track(Events.ITEM_PUBLISHED, { category: 'finn_import_batch', count, duration_ms: t() })
    onImported?.(count)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  const modeOptions: { value: FilterMode; label: string; sub: string }[] = [
    {
      value: 'rental_only',
      label: 'Kun utleieannonser',
      sub: 'Bare annonser med «til leie» / «utleie» i tittelen',
    },
    {
      value: 'all',
      label: 'Alle annonser',
      sub: 'Importer fra hele profilen, inkl. salgsannonser',
    },
  ]

  return (
    <div className="glass-heavy" style={{ borderRadius: 20, overflow: 'hidden', maxWidth: 560, margin: '0 auto' }}>

      {/* Hook */}
      <div style={{
        background: 'rgba(196,103,58,0.07)',
        borderBottom: '1px solid rgba(196,103,58,0.15)',
        padding: '16px 20px',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🏪</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)', margin: 0, lineHeight: 1.4 }}>
            Leier du allerede ut ting på Finn som du ønsker å låne ut til venner?
          </p>
          <p style={{ fontSize: 13, color: 'var(--terra-mid)', margin: '3px 0 0', lineHeight: 1.5 }}>
            Last opp skjermbilder fra Finn — AI henter gjenstandene automatisk inn i Village.
          </p>
        </div>
      </div>

      <div style={{ padding: '20px' }}>

        {/* ── INPUT ── */}
        {step === 'input' && (
          <div>
            {/* Filter mode selector */}
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Hvilke annonser vil du importere?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterMode(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    border: `1.5px solid ${filterMode === opt.value ? 'var(--terra)' : 'rgba(196,103,58,0.18)'}`,
                    background: filterMode === opt.value ? 'rgba(196,103,58,0.07)' : 'rgba(255,248,243,0.4)',
                    transition: 'all 150ms',
                  }}
                >
                  {/* Radio dot */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${filterMode === opt.value ? 'var(--terra)' : 'rgba(156,123,101,0.4)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {filterMode === opt.value && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terra)' }} />
                    )}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--terra-dark)' }}>{opt.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--terra-mid)' }}>{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Steps */}
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Slik gjør du det
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[
                'Gå til finn.no → Mine annonser og ta skjermbilde av annonseoversikten',
                'Last opp ett eller flere bilder nedenfor',
                'Velg hvilke gjenstander du vil legge inn i Village',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: 'rgba(196,103,58,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--terra)',
                  }}>{i + 1}</div>
                  <p style={{ fontSize: 13, color: 'var(--terra-dark)', margin: 0, lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div style={{
              background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.2)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 16,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
              <p style={{ fontSize: 12, color: 'var(--terra-dark)', margin: 0, lineHeight: 1.5 }}>
                <strong>Tips:</strong> Skjermbilde av <strong>annonseoversikten</strong> gir best resultat — da ser AI alle annonsene dine på én gang. Enkeltannonser fungerer også, men krever ett bilde per annonse.
              </p>
            </div>

            {/* Drop zone */}
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '18px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `1.5px dashed ${images.length ? 'rgba(74,124,89,0.6)' : 'rgba(196,103,58,0.3)'}`,
                background: images.length ? 'rgba(74,124,89,0.06)' : 'rgba(196,103,58,0.02)',
                transition: 'all 150ms',
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                if (files.length) { setImages(files); setPreviews(files.map(f => URL.createObjectURL(f))) }
              }}
            >
              <span style={{ fontSize: 22, display: 'block', marginBottom: 4 }}>📸</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--terra-dark)', margin: 0 }}>
                {images.length ? `${images.length} bilde${images.length > 1 ? 'r' : ''} valgt` : 'Trykk for å velge skjermbilder'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--terra-mid)', margin: '2px 0 0' }}>
                PNG, JPG, HEIC — ett eller flere bilder
              </p>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFileChange} />

            {previews.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(196,103,58,0.2)', display: 'block' }} />
                    <button onClick={() => removeImage(i)} style={{
                      position: 'absolute', top: -5, right: -5, width: 17, height: 17,
                      borderRadius: '50%', background: 'var(--terra)', border: 'none', cursor: 'pointer',
                      color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: '#c0392b', marginTop: 8, background: 'rgba(192,57,43,0.07)', padding: '8px 10px', borderRadius: 8 }}>
                {error}
              </p>
            )}

            <button className="btn-primary" onClick={analyseScreenshots} disabled={!images.length} style={{ width: '100%', marginTop: 12 }}>
              {images.length ? `Analyser ${images.length} skjermbilde${images.length > 1 ? 'r' : ''}` : 'Velg skjermbilder først'}
            </button>
          </div>
        )}

        {/* ── LOADING / IMPORTING ── */}
        {(step === 'loading' || step === 'importing') && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '2.5px solid rgba(196,103,58,0.2)', borderTopColor: 'var(--terra)',
              animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
            }} />
            <p style={{ color: 'var(--terra-dark)', fontWeight: 600, margin: 0 }}>
              {step === 'loading' ? 'Analyserer skjermbilder…' : 'Lagrer gjenstander…'}
            </p>
            {step === 'loading' && <p style={{ color: 'var(--terra-mid)', fontSize: 12, marginTop: 4 }}>AI gjenkjenner annonser</p>}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ color: 'var(--terra-dark)', fontWeight: 600, marginBottom: 6 }}>
                  {filterMode === 'rental_only'
                    ? 'Ingen utleieannonser funnet på disse skjermbildene.'
                    : 'Ingen annonser gjenkjent.'}
                </p>
                <p style={{ color: 'var(--terra-mid)', fontSize: 13, marginBottom: 16 }}>
                  {filterMode === 'rental_only'
                    ? 'Prøv å bytte til «Alle annonser», eller last opp klarere skjermbilder.'
                    : 'Prøv klarere skjermbilder av annonseoversikten.'}
                </p>
                <button className="btn-glass" onClick={() => setStep('input')}>Tilbake</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, color: 'var(--terra-mid)', margin: 0 }}>
                    <strong style={{ color: 'var(--terra-dark)' }}>{selected.size}</strong> av {items.length} valgt
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelected(new Set(items.map((_, i) => i)))}
                      style={{ fontSize: 12, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Velg alle
                    </button>
                    <span style={{ color: 'var(--terra-mid)' }}>·</span>
                    <button onClick={() => setSelected(new Set())}
                      style={{ fontSize: 12, color: 'var(--terra-mid)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Fravelg
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {items.map((item, i) => (
                    <button key={i} onClick={() => toggleItem(i)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 120ms ease',
                      border: `1px solid ${selected.has(i) ? 'rgba(196,103,58,0.4)' : 'rgba(196,103,58,0.12)'}`,
                      background: selected.has(i) ? 'rgba(196,103,58,0.05)' : 'rgba(255,248,243,0.4)',
                    }}>
                      <div style={{
                        width: 17, height: 17, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${selected.has(i) ? 'var(--terra)' : 'rgba(156,123,101,0.4)'}`,
                        background: selected.has(i) ? 'var(--terra)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected.has(i) && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div style={{
                        width: 36, height: 36, borderRadius: 7, flexShrink: 0,
                        background: 'rgba(196,103,58,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {categoryEmoji(item.category)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--terra-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--terra-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description || categoryLabel(item.category)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                        {item.is_rental_listing && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'rgba(196,103,58,0.1)', color: 'var(--terra)' }}>
                            Utleie
                          </span>
                        )}
                        {item.is_rental_candidate && !item.is_rental_listing && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>
                            Utlån ✓
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {error && <p style={{ fontSize: 12, color: '#c0392b', marginTop: 10 }}>{error}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn-glass" onClick={() => setStep('input')} style={{ flex: 1 }}>Tilbake</button>
                  <button className="btn-primary" onClick={importSelected} disabled={!selected.size} style={{ flex: 2 }}>
                    Legg til {selected.size > 0 ? `${selected.size} ` : ''}gjenstand{selected.size !== 1 ? 'er' : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <h3 className="font-display" style={{ fontSize: 18, color: 'var(--terra-dark)', margin: '0 0 6px' }}>
              {importedCount} gjenstand{importedCount !== 1 ? 'er' : ''} lagt til!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--terra-mid)', margin: '0 0 18px' }}>
              De er nå synlige i Village og kan lånes ut til naboer og venner.
            </p>
            <button className="btn-glass" onClick={() => {
              setStep('input'); setImages([]); setPreviews([]); setItems([]); setSelected(new Set()); setError('')
            }}>
              Importer flere
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    verktøy: '🔧', sport: '⚽', fritid: '🎯', elektronikk: '💻',
    kjøkken: '🍳', hjem: '🏠', transport: '🚲', klær: '👕', barn: '🧸', annet: '📦',
  }
  return map[cat] ?? '📦'
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    verktøy: 'Verktøy', sport: 'Sport', fritid: 'Fritid', elektronikk: 'Elektronikk',
    kjøkken: 'Kjøkken', hjem: 'Hjem', transport: 'Transport', klær: 'Klær', barn: 'Barn', annet: 'Annet',
  }
  return map[cat] ?? 'Annet'
}
