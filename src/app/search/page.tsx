'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCategoryLabel } from '@/lib/categories'
import { sortProfilesWithConnectionFirst } from '@/lib/sortProfiles'
import { track, Events } from '@/lib/track'

export default function SearchPage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'gjenstander' | 'kretser' | 'personer'>('gjenstander')
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('') // YYYY-MM-DD
  const [items, setItems] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [connectedProfileId, setConnectedProfileId] = useState<string | null>(null)

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load connected profile for sortProfilesWithConnectionFirst
  useEffect(() => {
    const loadConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
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
    loadConnection()
  }, [])

  // Get item IDs that are unavailable on a given date (active loans + blocked dates)
  const getUnavailableItemIds = useCallback(async (date: string): Promise<Set<string>> => {
    const [{ data: loans }, { data: blocked }] = await Promise.all([
      supabase
        .from('loans')
        .select('item_id')
        .in('status', ['pending', 'active', 'change_proposed'])
        .lte('start_date', date)
        .gte('due_date', date),
      supabase
        .from('item_blocked_dates')
        .select('item_id')
        .eq('date', date),
    ])
    const ids = new Set<string>()
    loans?.forEach((l) => ids.add(l.item_id))
    blocked?.forEach((b) => ids.add(b.item_id))
    return ids
  }, [])

  const searchItems = useCallback(async (q: string, date: string) => {
    let query = supabase
      .from('items')
      .select('*, profiles(id, name, avatar_url)')
      .eq('available', true)
      .limit(40)

    if (q.length >= 2) {
      query = query.ilike('name', `%${q}%`)
    }

    const { data } = await query.order('created_at', { ascending: false })
    let results = data ?? []

    // Deduplicate: connected_profile items shown once under owner_id
    const seen = new Set<string>()
    results = results.filter((item) => {
      const key = item.connected_profile_id
        ? [item.owner_id, item.connected_profile_id].sort().join('-')
        : item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Date filter: remove items unavailable on that date
    if (date) {
      const unavailable = await getUnavailableItemIds(date)
      results = results.filter((item) => !unavailable.has(item.id))
    }

    setItems(results)
  }, [getUnavailableItemIds])

  const searchCommunities = useCallback(async (q: string) => {
    let query = supabase
      .from('communities')
      .select('*')
      .eq('is_public', true)
      .limit(40)
    if (q.length >= 2) {
      query = query.ilike('name', `%${q}%`)
    }
    const { data } = await query
    setCommunities(data ?? [])
  }, [])

  const searchPeople = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPeople([])
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(30)
    setPeople(sortProfilesWithConnectionFirst(data ?? [], connectedProfileId))
  }, [connectedProfileId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        if (tab === 'gjenstander') await searchItems(query, dateFilter)
        else if (tab === 'kretser') await searchCommunities(query)
        else await searchPeople(query)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [query, tab, dateFilter])

  // Pre-load on mount
  useEffect(() => {
    searchItems('', '')
    searchCommunities('')
  }, [])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDateFilter(val)
    if (val) {
      track(Events.SEARCH_DATE_FILTER_APPLIED, { date: val })
    }
  }

  const clearDate = () => setDateFilter('')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="page-header glass">
        <button
          onClick={() => router.back()}
          style={{ color: 'var(--terra)', fontSize: '15px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Tilbake
        </button>
        <div style={{ flex: 1, margin: '0 10px' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i Village..."
            style={{
              width: '100%',
              background: 'rgba(196,103,58,0.08)',
              border: '1px solid rgba(196,103,58,0.18)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '15px',
              color: 'var(--terra-dark)',
              outline: 'none',
            }}
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="pill-row" style={{ padding: '12px 16px 0' }}>
        {(['gjenstander', 'kretser', 'personer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pill ${tab === t ? 'active' : ''}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Date filter — only on gjenstander tab */}
      {tab === 'gjenstander' && (
        <div style={{ padding: '10px 16px 2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
              Tilgjengelig dato
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={handleDateChange}
              min={new Date().toISOString().split('T')[0]}
              className="glass text-sm outline-none"
              style={{ borderRadius: 12, padding: '10px 12px', color: dateFilter ? 'var(--terra-dark)' : 'var(--terra-mid)' }}
            />
          </div>
          {dateFilter && (
            <button
              onClick={clearDate}
              className="btn-glass btn-sm"
              style={{ marginTop: 18, whiteSpace: 'nowrap' }}
            >
              Nullstill
            </button>
          )}
        </div>
      )}

      {/* Active date filter chip */}
      {tab === 'gjenstander' && dateFilter && (
        <div style={{ padding: '6px 16px 0' }}>
          <span
            className="status-pill active"
            style={{ fontSize: '12px' }}
          >
            ● Tilgjengelig {new Date(dateFilter).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
          </span>
        </div>
      )}

      {/* Results */}
      <div style={{ padding: '12px 16px' }}>
        {loading && (
          <p style={{ color: 'var(--terra-mid)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
            Søker…
          </p>
        )}

        {!loading && tab === 'gjenstander' && (
          <>
            {items.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                {dateFilter ? 'Ingen gjenstander tilgjengelig på denne datoen' : 'Ingen gjenstander funnet'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="item-card glass-hover"
                    style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(196,103,58,0.18)', cursor: 'pointer' }}
                    onClick={() => router.push(`/items/${item.id}`)}
                  >
                    <div
                      className="card-image-area"
                      style={{ aspectRatio: '4/3', background: 'rgba(196,103,58,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '32px' }}>📦</span>
                      )}
                    </div>
                    <div className="item-card-body glass-card" style={{ padding: '10px' }}>
                      <p className="item-name font-display" style={{ fontSize: '14px', marginBottom: '2px' }}>{item.name}</p>
                      {item.profiles?.name && (
                        <p style={{ fontSize: '11px', color: 'var(--terra-mid)', marginBottom: '4px' }}>
                          {item.connected_profile_id ? '🔗 ' : ''}{item.profiles.name}
                        </p>
                      )}
                      {item.category && (
                        <p style={{ fontSize: '11px', color: 'var(--terra-mid)' }}>{getCategoryLabel(item.category)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab === 'kretser' && (
          <>
            {communities.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>Ingen kretser funnet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {communities.map((c) => (
                  <div
                    key={c.id}
                    className="glass-card"
                    style={{ padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onClick={() => router.push(`/communities/${c.id}`)}
                  >
                    <span style={{ fontSize: '24px' }}>{c.avatar_emoji ?? '🏘️'}</span>
                    <p className="font-display" style={{ fontSize: '15px', color: 'var(--terra-dark)' }}>{c.name}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab === 'personer' && (
          <>
            {query.length < 2 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>Skriv minst 2 tegn for å søke</p>
            ) : people.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>Ingen personer funnet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {people.map((p) => (
                  <div
                    key={p.id}
                    className="glass-card"
                    style={{ padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                    onClick={() => router.push(`/profile/${p.id}`)}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(196,103,58,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
                    )}
                    <div>
                      <p style={{ fontSize: '14px', color: 'var(--terra-dark)', fontWeight: 500 }}>
                        {p.id === connectedProfileId ? '🔗 ' : ''}{p.name}
                      </p>
                      {p.username && <p style={{ fontSize: '12px', color: 'var(--terra-mid)' }}>@{p.username}</p>}
                    </div>
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
