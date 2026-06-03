'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCategoryLabel } from '@/lib/categories'
import { sortProfilesWithConnectionFirst } from '@/lib/sortProfiles'
import { track, Events } from '@/lib/track'

const CATEGORY_TABS = [
  { id: 'all',     label: 'Alle' },
  { id: 'baby-og-barn',   label: 'Baby & barn' },
  { id: 'klar-og-mote',   label: 'Antrekk' },
  { id: 'boker',          label: 'Bøker' },
  { id: 'annet',          label: 'Annet' },
] as const
type CatId = typeof CATEGORY_TABS[number]['id']

const SUBCATEGORIES: Record<string, string[]> = {
  'baby-og-barn':  ['Spise','Leke','Stelle','Sove','Bade','Ha-på','Reise','Gravid','Annet'],
  'klar-og-mote':  ['Bryllup','Fest & ball','Konfirmasjon','Begravelse & seremoni','Hverdag & casual','Annet'],
  'boker':         ['Skjønnlitteratur','Sakprosa','Barn & ungdom','Kokebok','Biografi','Fagbok','Annet'],
  'annet':         ['Sport & fritid','Elektronikk','Verktøy','Kjøkken & hjem','Hage','Annet'],
}

const AGE_GROUPS = ['0–3 mnd','3–6 mnd','6–12 mnd','1–2 år','2–3 år','3–5 år','5–8 år','8–12 år']
const SIZES_DAME  = ['XS','S','M','L','XL','XXL']
const SIZES_HERRE = ['XS','S','M','L','XL','XXL']
const SIZES_BARN  = ['86–92','98–104','110–116','122–128','134–140','146–152','158–164']
const COLORS = ['Hvit','Grå','Svart','Blå','Grønn','Rød','Rosa','Gul','Beige','Flerfarget']

const COLOR_MAP: Record<string, string> = {
  Hvit: '#F5F5F5', Grå: '#9E9E9E', Svart: '#212121', Blå: '#1565C0',
  Grønn: '#2E7D32', Rød: '#C62828', Rosa: '#E91E8C', Gul: '#F9A825',
  Beige: '#C8A97C', Flerfarget: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 22%, #2ecc71 44%, #3498db 66%, #9b59b6 88%, #e74c3c 100%)',
}

function fd(d: string) {
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'gjenstander' | 'personer'>('gjenstander')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connectedProfileId, setConnectedProfileId] = useState<string | null>(null)

  // Filters
  const [activeCat, setActiveCat] = useState<CatId>('all')
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [activeAge, setActiveAge] = useState<string | null>(null)
  const [activeGender, setActiveGender] = useState<'dame' | 'herre' | 'barn' | null>(null)
  const [activeSize, setActiveSize] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)

  // Active loans map: item_id → due_date of earliest active/confirmed loan
  const [activeLoanMap, setActiveLoanMap] = useState<Record<string, string>>({})

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data } = await supabase
        .from('profile_connections')
        .select('user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'active')
        .limit(1)
        .single()
      if (data) {
        setConnectedProfileId(data.user_a === user.id ? data.user_b : data.user_a)
      }
    }
    init()
  }, [])

  const fetchActiveLoans = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('loans')
      .select('item_id, due_date')
      .in('status', ['pending', 'confirmed', 'active', 'change_proposed'])
      .order('due_date', { ascending: true })
    if (!data) return
    const map: Record<string, string> = {}
    for (const loan of data) {
      if (!map[loan.item_id]) map[loan.item_id] = loan.due_date
    }
    setActiveLoanMap(map)
  }, [])

  useEffect(() => { fetchActiveLoans() }, [])

  const searchItems = useCallback(async (q: string) => {
    const supabase = createClient()
    let dbQuery = supabase
      .from('items')
      .select('id, name, category, subcategories, available, image_url, owner_id, connected_profile_id, color, size, age_ranges, item_filters, profiles!items_owner_id_fkey(id, name, avatar_url), v_item_min_price!left(min_price, min_price_type)')
      .limit(80)

    if (q.length >= 2) {
      // search name, category label, and subcategories
      dbQuery = dbQuery.or(
        `name.ilike.%${q}%,category.ilike.%${q}%,subcategories.cs.{${q}}`
      )
    }

    const { data } = await dbQuery.order('created_at', { ascending: false })
    let results = data ?? []

    // Deduplicate connected_profile items
    const seen = new Set<string>()
    results = results.filter((item) => {
      const key = item.connected_profile_id
        ? [item.owner_id, item.connected_profile_id].sort().join('-')
        : item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setItems(results)
  }, [])

  const searchPeople = useCallback(async (q: string) => {
    if (q.length < 2) { setPeople([]); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(30)
    setPeople(sortProfilesWithConnectionFirst(data ?? [], connectedProfileId))
  }, [connectedProfileId])

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        if (tab === 'gjenstander') await searchItems(query)
        else await searchPeople(query)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [query, tab])

  useEffect(() => { searchItems('') }, [])

  // Reset sub-filters when category changes
  const handleCatChange = (cat: CatId) => {
    setActiveCat(cat)
    setActiveSub(null)
    setActiveAge(null)
    setActiveGender(null)
    setActiveSize(null)
    setActiveColor(null)
  }

  // Client-side filtering
  const filteredItems = items.filter(item => {
    if (activeCat !== 'all' && item.category !== activeCat) return false
    if (activeSub && !(item.subcategories ?? []).includes(activeSub) && item.subcategories !== activeSub) return false
    if (activeColor && item.color?.toLowerCase() !== activeColor.toLowerCase()) return false
    if (activeCat === 'baby-og-barn' && activeAge) {
      if (!(item.age_ranges ?? []).includes(activeAge)) return false
    }
    if (activeCat === 'klar-og-mote') {
      if (activeGender && item.item_filters?.gender !== activeGender) return false
      if (activeSize && item.size !== activeSize) return false
    }
    if (availableOnly && !item.available) return false
    return true
  })

  const showSubcats    = activeCat !== 'all' && SUBCATEGORIES[activeCat]
  const showAgeFilter  = activeCat === 'baby-og-barn'
  const showSizeFilter = activeCat === 'klar-og-mote'
  const showColorFilter = ['baby-og-barn', 'klar-og-mote'].includes(activeCat)

  const sizeOptions = activeGender === 'barn' ? SIZES_BARN : activeGender === 'herre' ? SIZES_HERRE : SIZES_DAME

  const pillBase: React.CSSProperties = {
    padding: '6px 13px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
    border: '1px solid rgba(46,98,113,0.18)', background: 'white',
    color: 'var(--terra-mid)', whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'all 150ms ease', display: 'inline-flex', alignItems: 'center', gap: 5,
  }
  const pillActive: React.CSSProperties = {
    background: 'var(--terra)', borderColor: 'var(--terra)', color: 'white',
  }
  const subPillBase: React.CSSProperties = {
    padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
    border: '1px solid rgba(46,98,113,0.15)', background: 'white',
    color: 'var(--terra-mid)', whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'all 150ms ease',
  }
  const subPillActive: React.CSSProperties = {
    background: 'rgba(46,98,113,0.10)', borderColor: 'var(--terra)', color: 'var(--terra)', fontWeight: 500,
  }

  const rowStyle: React.CSSProperties = {
    borderRadius: 16, border: '1px solid rgba(46,98,113,0.18)',
    background: 'white', display: 'flex', alignItems: 'center',
    gap: 12, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow 150ms ease',
  }

  const scrollRow: React.CSSProperties = {
    display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
    scrollbarWidth: 'none',
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="page-header glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(46,98,113,0.10)', border: '1px solid rgba(46,98,113,0.15)', flexShrink: 0, cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tab === 'gjenstander' ? 'Søk etter gjenstander…' : 'Søk etter personer…'}
              style={{
                width: '100%', height: 36, borderRadius: 12,
                border: '1px solid rgba(46,98,113,0.18)', background: 'rgba(252,254,255,0.7)',
                padding: '0 28px 0 32px', fontSize: 14, color: 'var(--terra-dark)', outline: 'none',
              }}
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--terra-mid)', fontSize: 16, lineHeight: 1, padding: 2 }}
              >×</button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div className="glass" style={{ display: 'flex', borderRadius: 14, padding: 3, gap: 3 }}>
            {(['gjenstander', 'personer'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 11, border: 'none', fontSize: 13,
                  fontWeight: tab === t ? 600 : 400, cursor: 'pointer', transition: 'all 200ms ease',
                  background: tab === t ? 'white' : 'transparent',
                  color: tab === t ? 'var(--terra-dark)' : 'var(--terra-mid)',
                  boxShadow: tab === t ? '0 1px 8px rgba(26,37,48,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px 0' }}>

        {/* ── FILTER PANEL — gjenstander only ── */}
        {tab === 'gjenstander' && (
          <div className="glass" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>

            {/* Kategori */}
            <div style={scrollRow}>
              {CATEGORY_TABS.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCatChange(cat.id)}
                  style={{ ...pillBase, ...(activeCat === cat.id ? pillActive : {}) }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Underkategori */}
            {showSubcats && (
              <div style={{ ...scrollRow, marginTop: 8 }}>
                {SUBCATEGORIES[activeCat].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setActiveSub(activeSub === sub ? null : sub)}
                    style={{ ...subPillBase, ...(activeSub === sub ? subPillActive : {}) }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            {/* Alder — baby */}
            {showAgeFilter && (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 6px' }}>Alder</p>
                <div style={scrollRow}>
                  {AGE_GROUPS.map(a => (
                    <button
                      key={a}
                      onClick={() => setActiveAge(activeAge === a ? null : a)}
                      style={{ ...subPillBase, ...(activeAge === a ? subPillActive : {}) }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Kjønn + størrelse — antrekk */}
            {showSizeFilter && (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 6px' }}>Størrelse</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['dame', 'herre', 'barn'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => { setActiveGender(activeGender === g ? null : g); setActiveSize(null) }}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid rgba(46,98,113,0.18)',
                        fontSize: 13, cursor: 'pointer', transition: 'all 150ms ease',
                        background: activeGender === g ? 'var(--terra)' : 'white',
                        color: activeGender === g ? 'white' : 'var(--terra-mid)',
                      }}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={scrollRow}>
                  {sizeOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSize(activeSize === s ? null : s)}
                      style={{ ...subPillBase, ...(activeSize === s ? subPillActive : {}) }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Farge */}
            {showColorFilter && (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 6px' }}>Farge</p>
                <div style={scrollRow}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveColor(activeColor === c ? null : c)}
                      title={activeColor === c ? `Fjern ${c}` : c}
                      aria-pressed={activeColor === c}
                      style={{
                        position: 'relative', width: 28, height: 28, borderRadius: '50%',
                        flexShrink: 0, cursor: 'pointer',
                        border: activeColor === c ? '2.5px solid var(--terra)' : '2px solid rgba(0,0,0,0.10)',
                        background: COLOR_MAP[c] ?? '#ccc',
                        outline: activeColor === c ? '2px solid rgba(46,98,113,0.25)' : 'none',
                        outlineOffset: 1,
                      }}
                    >
                      {activeColor === c && (
                        <span style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', borderRadius: '50%',
                          background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, lineHeight: 1,
                        }}>×</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Ledig nå toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(46,98,113,0.10)' }}>
              <span style={{ fontSize: 13, color: 'var(--terra-dark)' }}>Bare ledige gjenstander</span>
              <button
                onClick={() => setAvailableOnly(v => !v)}
                style={{
                  width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: availableOnly ? 'var(--terra)' : 'rgba(46,98,113,0.18)',
                  position: 'relative', transition: 'background 200ms ease', flexShrink: 0,
                }}
                aria-pressed={availableOnly}
                aria-label="Bare ledige gjenstander"
              >
                <span style={{
                  position: 'absolute', top: 3, left: availableOnly ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Søker…</p>
        )}

        {/* ── GJENSTANDER ── */}
        {!loading && tab === 'gjenstander' && (
          <>
            {filteredItems.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                Ingen gjenstander funnet
              </p>
            ) : (
              <>
                <p style={{ color: 'var(--terra-mid)', fontSize: 12, marginBottom: 8 }}>
                  {filteredItems.length} gjenstander
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredItems.map(item => {
                    const isOwn = item.owner_id === currentUserId
                    const isConnected = !isOwn && (
                      item.owner_id === connectedProfileId ||
                      item.connected_profile_id === currentUserId
                    )
                    const occupiedUntil = activeLoanMap[item.id]
                    const isCurrentlyUnavailable = !item.available && !!occupiedUntil

                    return (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/items/${item.id}`)}
                        style={rowStyle}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(26,37,48,0.10)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {item.image_url ? (
                            <img src={item.image_url} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', display: 'block' }} alt={item.name} />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(46,98,113,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
                          )}
                          <span style={{
                            position: 'absolute', bottom: 2, right: 2,
                            width: 9, height: 9, borderRadius: '50%',
                            border: '2px solid white',
                            background: item.available ? '#4A7C59' : 'var(--terra)',
                          }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {item.name}
                            </p>
                            {isOwn && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--terra)', background: 'rgba(46,98,113,0.10)', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>Din</span>
                            )}
                            {isConnected && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--terra-mid)', background: 'rgba(46,98,113,0.08)', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>🔗 Delt</span>
                            )}
                          </div>
                          <p style={{ color: 'var(--terra-mid)', fontSize: 12, margin: '3px 0 0' }}>
                            {item.profiles?.name ?? 'Ukjent'}
                            {item.category ? ` · ${getCategoryLabel(item.category)}` : ''}
                          </p>
                          {/* Availability status line */}
                          {item.available ? (
                            <p style={{ fontSize: 11, color: '#4A7C59', marginTop: 3, fontWeight: 500 }}>● Ledig nå</p>
                          ) : isCurrentlyUnavailable ? (
                            <p style={{ fontSize: 11, color: 'var(--terra)', marginTop: 3, fontWeight: 500 }}>
                              ● Opptatt til {fd(occupiedUntil)}
                            </p>
                          ) : (
                            <p style={{ fontSize: 11, color: 'var(--terra-mid)', marginTop: 3 }}>Ikke tilgjengelig</p>
                          )}
                          {item.v_item_min_price?.min_price > 0 && (
                            <p style={{ fontSize: 11, color: 'var(--terra)', marginTop: 2, fontWeight: 500 }}>
                              fra {item.v_item_min_price.min_price} kr{' '}
                              {item.v_item_min_price.min_price_type === 'per_week'  ? '/ uke'  :
                               item.v_item_min_price.min_price_type === 'per_month' ? '/ mnd'  :
                               item.v_item_min_price.min_price_type === 'flat'      ? '(fast)' :
                               '/ dag'}
                            </p>
                          )}
                        </div>

                        <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── PERSONER ── */}
        {!loading && tab === 'personer' && (
          <>
            {query.length < 2 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Søk på navn eller brukernavn</p>
            ) : people.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Ingen personer funnet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {people.map(p => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/profile/${p.id}`)}
                    style={rowStyle}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(26,37,48,0.10)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={p.name} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(46,98,113,0.12)', border: '1px solid rgba(46,98,113,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--terra)', flexShrink: 0 }}>
                        {(p.name ?? '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 15, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.id === connectedProfileId ? '🔗 ' : ''}{p.name}
                      </p>
                      {p.username && <p style={{ color: 'var(--terra-mid)', fontSize: 12, margin: '3px 0 0' }}>@{p.username}</p>}
                    </div>
                    <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
