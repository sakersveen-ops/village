'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCategoryLabel } from '@/lib/categories'
import { sortProfilesWithConnectionFirst } from '@/lib/sortProfiles'
import { track, Events } from '@/lib/track'

type DateRange = { from: string; to: string }

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'gjenstander' | 'kretser' | 'personer'>('gjenstander')
  const [query, setQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const [items, setItems] = useState<any[]>([])
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set())
  const [communities, setCommunities] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connectedProfileId, setConnectedProfileId] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  const getUnavailableInRange = useCallback(async (from: string, to: string): Promise<Set<string>> => {
    const supabase = createClient()
    const [{ data: loans }, { data: blocked }] = await Promise.all([
      supabase
        .from('loans')
        .select('item_id')
        .in('status', ['pending', 'active', 'change_proposed'])
        .lte('start_date', to)
        .gte('due_date', from),
      supabase
        .from('item_blocked_dates')
        .select('item_id')
        .gte('date', from)
        .lte('date', to),
    ])
    const ids = new Set<string>()
    loans?.forEach((l) => ids.add(l.item_id))
    blocked?.forEach((b) => ids.add(b.item_id))
    return ids
  }, [])

  const searchItems = useCallback(async (q: string, range: DateRange) => {
    const supabase = createClient()
    let dbQuery = supabase
      .from('items')
      .select('*, profiles!items_owner_id_fkey(id, name, avatar_url)')
      .limit(60)

    if (q.length >= 2) {
      dbQuery = dbQuery.ilike('name', `%${q}%`)
    }

    const { data } = await dbQuery.order('created_at', { ascending: false })
    let results = data ?? []

    // Deduplicate connected_profile items — show once under owner_id
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

    if (range.from && range.to) {
      const ids = await getUnavailableInRange(range.from, range.to)
      setUnavailableIds(ids)
      track(Events.SEARCH_DATE_FILTER_APPLIED, { from: range.from, to: range.to })
    } else {
      setUnavailableIds(new Set())
    }
  }, [getUnavailableInRange])

  const searchCommunities = useCallback(async (q: string) => {
    const supabase = createClient()
    let dbQuery = supabase
      .from('communities')
      .select('*')
      .eq('is_public', true)
      .limit(40)
    if (q.length >= 2) dbQuery = dbQuery.ilike('name', `%${q}%`)
    const { data } = await dbQuery
    setCommunities(data ?? [])
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
        if (tab === 'gjenstander') await searchItems(query, dateRange)
        else if (tab === 'kretser') await searchCommunities(query)
        else await searchPeople(query)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [query, tab, dateRange])

  useEffect(() => {
    searchItems('', { from: '', to: '' })
    searchCommunities('')
  }, [])

  const handleDateChange = (field: 'from' | 'to', val: string) => {
    setDateRange(prev => {
      const next = { ...prev, [field]: val }
      if (field === 'from' && val && !prev.to) next.to = val
      if (field === 'to' && val && !prev.from) next.from = val
      return next
    })
  }

  const clearDates = () => setDateRange({ from: '', to: '' })

  const hasDateFilter = !!(dateRange.from && dateRange.to)
  const today = new Date().toISOString().split('T')[0]
  const fd = (d: string) => new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  // Available items first, then greyed-out unavailable
  const sortedItems = hasDateFilter
    ? [
        ...items.filter(i => !unavailableIds.has(i.id)),
        ...items.filter(i => unavailableIds.has(i.id)),
      ]
    : items

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="page-header glass">
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(196,103,58,0.10)', border: '1px solid rgba(196,103,58,0.15)', flexShrink: 0, cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1, margin: '0 10px', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              tab === 'gjenstander' ? 'Søk etter gjenstander…' :
              tab === 'kretser' ? 'Søk etter kretser…' : 'Søk etter personer…'
            }
            style={{
              width: '100%',
              height: 36,
              borderRadius: 12,
              border: '1px solid rgba(196,103,58,0.18)',
              background: 'rgba(255,248,243,0.7)',
              padding: '0 28px 0 32px',
              fontSize: 14,
              color: 'var(--terra-dark)',
              outline: 'none',
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

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px 0' }}>
        {/* Tabs */}
        <div className="glass" style={{ display: 'flex', borderRadius: 16, padding: 4, gap: 4, marginBottom: 14 }}>
          {(['gjenstander', 'kretser', 'personer'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 12,
                border: 'none',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? 'var(--terra-dark)' : 'var(--terra-mid)',
                boxShadow: tab === t ? '0 1px 8px rgba(44,26,14,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Date filter */}
        {tab === 'gjenstander' && (
          <div className="glass" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Fra</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={e => handleDateChange('from', e.target.value)}
                  min={today}
                  className="glass text-sm outline-none"
                  style={{ borderRadius: 12, padding: '10px 12px', color: dateRange.from ? 'var(--terra-dark)' : 'var(--terra-mid)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Til</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={e => handleDateChange('to', e.target.value)}
                  min={dateRange.from || today}
                  className="glass text-sm outline-none"
                  style={{ borderRadius: 12, padding: '10px 12px', color: dateRange.to ? 'var(--terra-dark)' : 'var(--terra-mid)' }}
                />
              </div>
            </div>
            {hasDateFilter && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span className="status-pill active" style={{ fontSize: 12 }}>
                  ● {fd(dateRange.from)}{dateRange.from !== dateRange.to ? ` → ${fd(dateRange.to)}` : ''}
                </span>
                <button onClick={clearDates} className="btn-glass btn-sm">Nullstill</button>
              </div>
            )}
          </div>
        )}

        {loading && (
          <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Søker…</p>
        )}

        {/* ── GJENSTANDER ── */}
        {!loading && tab === 'gjenstander' && (
          <>
            {sortedItems.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                Ingen gjenstander funnet
              </p>
            ) : (
              <>
                <p style={{ color: 'var(--terra-mid)', fontSize: 12, marginBottom: 8 }}>
                  {sortedItems.length} gjenstander
                  {hasDateFilter && ` · ${sortedItems.filter(i => !unavailableIds.has(i.id)).length} ledige i perioden`}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sortedItems.map(item => {
                    const isUnavailable = hasDateFilter && unavailableIds.has(item.id)
                    const isOwn = item.owner_id === currentUserId
                    const isConnected = !isOwn && (
                      item.owner_id === connectedProfileId ||
                      item.connected_profile_id === currentUserId
                    )

                    return (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/items/${item.id}`)}
                        style={{
                          borderRadius: 16,
                          border: '1px solid rgba(196,103,58,0.18)',
                          background: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          opacity: isUnavailable ? 0.45 : 1,
                          transition: 'opacity 150ms ease, box-shadow 150ms ease',
                        }}
                        onMouseEnter={e => { if (!isUnavailable) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)' }}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {item.image_url ? (
                            <img src={item.image_url} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', display: 'block' }} alt={item.name} />
                          ) : (
                            <div style={{ width: 52, height: 52, borderRadius: 10, background: '#E8DDD0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
                          )}
                          {!hasDateFilter && (
                            <span style={{ position: 'absolute', bottom: 2, right: 2, width: 9, height: 9, borderRadius: '50%', border: '2px solid white', background: item.available ? '#4A7C59' : '#C4673A' }} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {item.name}
                            </p>
                            {isOwn && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--terra)', background: 'rgba(196,103,58,0.10)', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>Din</span>
                            )}
                            {isConnected && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--terra-mid)', background: 'rgba(196,103,58,0.08)', borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>🔗 Delt</span>
                            )}
                          </div>
                          <p style={{ color: 'var(--terra-mid)', fontSize: 11, margin: '2px 0 0' }}>
                            {item.profiles?.name ?? 'Ukjent'}
                            {item.category ? ` · ${getCategoryLabel(item.category)}` : ''}
                          </p>
                          {isUnavailable && (
                            <p style={{ fontSize: 11, color: 'var(--terra)', marginTop: 3, fontWeight: 500 }}>
                              Opptatt i denne perioden
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

        {/* ── KRETSER ── */}
        {!loading && tab === 'kretser' && (
          <>
            {communities.length === 0 ? (
              <p style={{ color: 'var(--terra-mid)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
                {query.length >= 2 ? 'Ingen kretser funnet' : 'Søk etter offentlige kretser'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {communities.map(c => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/communities/${c.id}`)}
                    style={{ borderRadius: 16, border: '1px solid rgba(196,103,58,0.18)', background: 'white', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow 150ms ease' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(44,26,14,0.10)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(196,103,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {c.avatar_emoji ?? '🏘️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-display" style={{ color: 'var(--terra-dark)', fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ color: 'var(--terra-mid)', fontSize: 11, margin: '2px 0 0' }}>{c.is_public ? 'Offentlig krets' : 'Privat krets'}</p>
                    </div>
                    <span style={{ color: 'var(--terra-mid)', fontSize: 16, flexShrink: 0 }}>›</span>
                  </div>
                ))}
              </div>
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
                    style={{ borderRadius: 16, border: '1px solid rgba(196,103,58,0.18)', background: 'white', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow 150ms ease' }}
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
                        {p.id === connectedProfileId ? '🔗 ' : ''}{p.name}
                      </p>
                      {p.username && <p style={{ color: 'var(--terra-mid)', fontSize: 11, margin: '2px 0 0' }}>@{p.username}</p>}
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
