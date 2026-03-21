'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SearchTab = 'gjenstander' | 'kretser' | 'personer'

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function SearchPage() {
  const [user, setUser]       = useState<any>(null)
  const [tab, setTab]         = useState<SearchTab>('gjenstander')
  const [query, setQuery]     = useState('')
  const [items, setItems]     = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [people, setPeople]   = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      setReady(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    init()
  }, [])

  const search = useCallback(async (q: string, t: SearchTab) => {
    if (!user) return
    const supabase = createClient()
    const trimmed = q.trim()
    setLoading(true)

    if (t === 'gjenstander') {
      let query = supabase
        .from('items')
        .select('id, name, category, image_url, available, owner_id, profiles!items_owner_id_fkey(id, name, avatar_url)')
        .eq('available', true)
        .order('created_at', { ascending: false })
        .limit(40)

      if (trimmed.length >= 2) {
        query = query.ilike('name', `%${trimmed}%`)
      }

      const { data } = await query
      setItems(data || [])
    }

    if (t === 'kretser') {
      let query = supabase
        .from('communities')
        .select('id, name, avatar_emoji, is_public')
        .eq('is_public', true)
        .order('name')
        .limit(40)

      if (trimmed.length >= 2) {
        query = query.ilike('name', `%${trimmed}%`)
      }

      const { data } = await query
      setCommunities(data || [])
    }

    if (t === 'personer') {
      if (trimmed.length < 2) {
        setPeople([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .or(`name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
        .neq('id', user.id)
        .limit(30)

      setPeople(data || [])
    }

    setLoading(false)
  }, [user])

  // Debounce search
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => search(query, tab), 280)
    return () => clearTimeout(timer)
  }, [query, tab, ready, search])

  // Pre-load items on mount
  useEffect(() => {
    if (ready) search('', 'gjenstander')
  }, [ready])

  const tabs: { id: SearchTab; label: string }[] = [
    { id: 'gjenstander', label: 'Gjenstander' },
    { id: 'kretser',     label: 'Kretser' },
    { id: 'personer',    label: 'Personer' },
  ]

  const switchTab = (t: SearchTab) => {
    setTab(t)
    search(query, t)
    inputRef.current?.focus()
  }

  if (!ready) return null

  return (
    <>
      {/* ── Header ── */}
      <header className="page-header glass">
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(196,103,58,0.10)', border: '1px solid rgba(196,103,58,0.15)', flexShrink: 0, cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Search input inside header */}
        <div style={{ flex: 1, margin: '0 10px', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              tab === 'gjenstander' ? 'Søk etter gjenstander…' :
              tab === 'kretser'     ? 'Søk etter kretser…' :
                                     'Søk etter personer…'
            }
            style={{
              width: '100%',
              height: 36,
              borderRadius: 12,
              border: '1px solid rgba(196,103,58,0.18)',
              background: 'rgba(255,248,243,0.7)',
              padding: '0 12px 0 32px',
              fontSize: 14,
              color: 'var(--terra-dark, #2C1A0E)',
              outline: 'none',
              letterSpacing: '-0.01em',
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--terra-mid)', fontSize: 16, lineHeight: 1, padding: 2 }}
            >×</button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px 120px' }}>

        {/* ── Tab switcher ── */}
        <div className="glass" style={{ display: 'flex', borderRadius: 16, padding: 4, gap: 4, marginBottom: 16 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 12,
                border: 'none',
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? 'var(--terra-dark, #2C1A0E)' : 'var(--terra-mid, #9C7B65)',
                boxShadow: tab === t.id ? '0 1px 8px rgba(44,26,14,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--terra-mid)', fontSize: 14 }}>
            Søker…
          </div>
        )}

        {/* ── GJENSTANDER ── */}
        {!loading && tab === 'gjenstander' && (
          <>
            {query.length > 0 && query.length < 2 && (
              <p style={{ color: 'var(--terra-mid)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Skriv minst 2 tegn for å søke</p>
            )}
            {items.length === 0 && query.length >= 2 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
                <p style={{ color: 'var(--terra-dark)', fontWeight: 600, fontSize: 15 }}>Ingen treff på «{query}»</p>
                <p style={{ color: 'var(--terra-mid)', fontSize: 13, marginTop: 4 }}>Prøv et annet søkeord</p>
              </div>
            )}
            {items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {query.length < 2 && (
                  <p style={{ color: 'var(--terra-mid)', fontSize: 12, marginBottom: 4, letterSpacing: '-0.01em' }}>
                    Nylig lagt ut · {items.length} tilgjengelige
                  </p>
                )}
                {items.map(item => (
                  <Link key={item.id} href={`/items/${item.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      borderRadius: 16,
                      border: '1px solid rgba(196,103,58,0.18)',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      transition: 'box-shadow 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {item.image_url ? (
                          <img src={item.image_url} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', display: 'block' }} alt={item.name} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 10, background: '#E8DDD0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                            {CATEGORY_EMOJI[item.category] ?? '📦'}
                          </div>
                        )}
                        <span style={{ position: 'absolute', bottom: 2, right: 2, width: 9, height: 9, borderRadius: '50%', border: '2px solid white', background: item.available ? '#4A7C59' : '#C4673A' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                          {item.name}
                        </p>
                        <p style={{ color: 'var(--terra-mid)', fontSize: 11, marginTop: 2, margin: 0 }}>
                          {item.profiles?.name ?? 'Ukjent'}
                        </p>
                      </div>
                      <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── KRETSER ── */}
        {!loading && tab === 'kretser' && (
          <>
            {communities.length === 0 && query.length >= 2 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🏘️</p>
                <p style={{ color: 'var(--terra-dark)', fontWeight: 600, fontSize: 15 }}>Ingen kretser funnet</p>
                <p style={{ color: 'var(--terra-mid)', fontSize: 13, marginTop: 4 }}>Prøv et annet søkeord, eller opprett en ny krets</p>
              </div>
            )}
            {communities.length === 0 && query.length < 2 && (
              <p style={{ color: 'var(--terra-mid)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                Søk etter offentlige kretser
              </p>
            )}
            {communities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {communities.map(c => (
                  <Link key={c.id} href={`/community/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      borderRadius: 16,
                      border: '1px solid rgba(196,103,58,0.18)',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      transition: 'box-shadow 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(196,103,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {c.avatar_emoji ?? '🏘️'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </p>
                        <p style={{ color: 'var(--terra-mid)', fontSize: 11, marginTop: 2, margin: '2px 0 0' }}>
                          {c.is_public ? 'Offentlig krets' : 'Privat krets'}
                        </p>
                      </div>
                      <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PERSONER ── */}
        {!loading && tab === 'personer' && (
          <>
            {query.length < 2 && (
              <p style={{ color: 'var(--terra-mid)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                Søk på navn eller brukernavn
              </p>
            )}
            {query.length >= 2 && people.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>👤</p>
                <p style={{ color: 'var(--terra-dark)', fontWeight: 600, fontSize: 15 }}>Ingen personer funnet</p>
                <p style={{ color: 'var(--terra-mid)', fontSize: 13, marginTop: 4 }}>Sjekk stavemåten og prøv igjen</p>
              </div>
            )}
            {people.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {people.map(p => (
                  <Link key={p.id} href={`/profile/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      borderRadius: 16,
                      border: '1px solid rgba(196,103,58,0.18)',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      transition: 'box-shadow 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={p.name} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(196,103,58,0.12)', border: '1px solid rgba(196,103,58,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--terra)', flexShrink: 0 }}>
                          {(p.name ?? '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </p>
                        {p.username && (
                          <p style={{ color: 'var(--terra-mid)', fontSize: 11, margin: '2px 0 0' }}>
                            @{p.username}
                          </p>
                        )}
                      </div>
                      <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
