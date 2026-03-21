'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { track, Events } from '@/lib/track'

const INTERESTS = ['Barn', 'Bøker', 'Kjoler', 'Verktøy', 'Sport', 'Musikk', 'Matlaging', 'Hage', 'Kunst', 'Reise']

function Avatar({ profile, size = 40 }: { profile: any; size?: number }) {
  const name = profile?.name || profile?.email?.split('@')[0] || '?'
  return (
    <div
      className="flex items-center justify-center font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: 'var(--terra)', color: '#fff', fontSize: size * 0.35 }}
    >
      {profile?.avatar_url
        ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={name} />
        : name[0]?.toUpperCase()}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={value}
      className="flex-shrink-0"
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: value ? 'var(--terra)' : 'rgba(196,103,58,0.15)',
        border: `1.5px solid ${value ? 'var(--terra)' : 'rgba(196,103,58,0.25)'}`,
        position: 'relative', transition: 'background 200ms, border-color 200ms', cursor: 'pointer',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 19 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(44,26,14,0.2)',
        transition: 'left 200ms',
      }} />
    </button>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [connection, setConnection] = useState<any>(null)
  const [connectedProfile, setConnectedProfile] = useState<any>(null)
  const [pendingOutgoing, setPendingOutgoing] = useState<any>(null)
  const [connSearchQuery, setConnSearchQuery] = useState('')
  const [connSearchResults, setConnSearchResults] = useState<any[]>([])
  const [connSearchLoading, setConnSearchLoading] = useState(false)
  const [connInviteSentTo, setConnInviteSentTo] = useState<string | null>(null)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [connActionLoading, setConnActionLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data || {})
      await loadConnection(supabase, user.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadConnection = async (supabase: any, userId: string) => {
    const { data: active } = await supabase
      .from('profile_connections')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (active) {
      setConnection(active)
      const partnerId = active.user_a === userId ? active.user_b : active.user_a
      const { data: partner } = await supabase.from('profiles').select('id, name, email, avatar_url').eq('id', partnerId).single()
      setConnectedProfile(partner)
      return
    }

    const { data: outgoing } = await supabase
      .from('profile_connections')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('status', 'pending')
      .eq('initiated_by', userId)
      .limit(1)
      .maybeSingle()

    if (outgoing) {
      setPendingOutgoing(outgoing)
      const partnerId = outgoing.user_a === userId ? outgoing.user_b : outgoing.user_a
      const { data: partner } = await supabase.from('profiles').select('id, name, email, avatar_url').eq('id', partnerId).single()
      setConnectedProfile(partner)
    }
  }

  const searchConnProfiles = useCallback(async (q: string) => {
    setConnSearchQuery(q)
    if (q.trim().length < 2) { setConnSearchResults([]); return }
    setConnSearchLoading(true)
    const supabase = createClient()

    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
      .eq('user_a', user.id)

    const friends = (friendships || []).map((f: any) => f.profiles).filter(Boolean)

    const { data: existingConns } = await supabase
      .from('profile_connections')
      .select('user_a, user_b')
      .in('status', ['active', 'pending'])

    const alreadyConnected = new Set<string>()
    ;(existingConns || []).forEach((c: any) => {
      alreadyConnected.add(c.user_a)
      alreadyConnected.add(c.user_b)
    })

    const lq = q.toLowerCase()
    const results = friends.filter((p: any) =>
      !alreadyConnected.has(p.id) &&
      (p.name?.toLowerCase().includes(lq) || p.email?.toLowerCase().includes(lq))
    )

    setConnSearchResults(results.slice(0, 8))
    setConnSearchLoading(false)
  }, [user])

  const sendConnectionInvite = async (targetId: string, targetName: string) => {
    setConnActionLoading(true)
    const supabase = createClient()
    const userA = user.id < targetId ? user.id : targetId
    const userB = user.id < targetId ? targetId : user.id
    const { data: newConn, error } = await supabase
      .from('profile_connections')
      .upsert(
        { user_a: userA, user_b: userB, initiated_by: user.id, status: 'pending' },
        { onConflict: 'user_a,user_b' }
      )
      .select()
      .single()
    if (error || !newConn) { setConnActionLoading(false); return }

    await supabase.from('notifications').insert({
      user_id: targetId,
      type: 'connection_request',
      title: '🔗 Tilkoblingsforespørsel',
      body: `${profile?.name || user.email?.split('@')[0]} vil koble profiler med deg`,
      action_url: '/notifications',
      metadata: { connection_id: newConn.id },
    })

    setPendingOutgoing(newConn)
    setConnectedProfile(await supabase.from('profiles').select('id, name, email, avatar_url').eq('id', targetId).single().then((r: any) => r.data))
    setConnInviteSentTo(targetId)
    setConnSearchQuery('')
    setConnSearchResults([])
    track(Events.CONNECTION_INVITE_SENT, { target_id: targetId })
    setConnActionLoading(false)
  }

  const cancelInvite = async () => {
    if (!pendingOutgoing) return
    setCancelLoading(true)
    const supabase = createClient()
    await supabase.from('profile_connections').update({ status: 'disconnected' }).eq('id', pendingOutgoing.id)
    setPendingOutgoing(null)
    setConnectedProfile(null)
    setConnInviteSentTo(null)
    setCancelLoading(false)
  }

  const disconnect = async () => {
    if (!connection) return
    setConnActionLoading(true)
    const supabase = createClient()
    await supabase.from('profile_connections').update({ status: 'disconnected' }).eq('id', connection.id)
    await supabase.from('items').update({ connected_profile_id: null })
      .or(`owner_id.eq.${user.id},owner_id.eq.${connectedProfile?.id}`)

    const partnerId = connectedProfile?.id
    if (partnerId) {
      await supabase.from('notifications').insert({
        user_id: partnerId,
        type: 'connection_disconnected',
        title: '🔗 Tilkobling fjernet',
        body: `${profile?.name || user.email?.split('@')[0]} koblet fra profilen`,
      })
    }

    track(Events.CONNECTION_DISCONNECTED)
    setConnection(null)
    setConnectedProfile(null)
    setShowDisconnectConfirm(false)
    setConnActionLoading(false)
  }

  const update = (key: string, value: any) => setProfile((p: any) => ({ ...p, [key]: value }))

  const toggleInterest = (interest: string) => {
    const current = profile?.interests || []
    const updated = current.includes(interest)
      ? current.filter((i: string) => i !== interest)
      : [...current, interest]
    update('interests', updated)
  }

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
      interests: profile.interests,
      privacy_profile: profile.privacy_profile,
      privacy_search: profile.privacy_search,
      notif_loan_request: profile.notif_loan_request,
      notif_loan_accepted: profile.notif_loan_accepted,
      notif_friend_request: profile.notif_friend_request,
      notif_join_request: profile.notif_join_request,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  const hasActiveConnection = !!connection
  const hasPendingOutgoing = !!pendingOutgoing && !connection

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-40 page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <button onClick={() => router.back()} className="text-sm mb-2 block" style={{ color: 'var(--terra)' }}>← Tilbake</button>
        <h1 className="page-header-title font-display">Innstillinger</h1>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* ── Profil ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Profil</p>
          <div className="flex flex-col gap-3">
            {/* Email — read-only, first */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--terra-mid)' }}>E-post</label>
              <div className="glass rounded-xl px-4 py-3 text-sm" style={{ color: 'var(--terra-mid)', opacity: 0.8 }}>
                {user?.email}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--terra-mid)' }}>Visningsnavn</label>
              <input
                value={profile?.name || ''}
                onChange={e => update('name', e.target.value)}
                placeholder="Ditt navn"
                className="glass rounded-xl px-4 py-3 text-sm outline-none"
                style={{ color: 'var(--terra-dark)' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--terra-mid)' }}>Telefon</label>
              <input
                value={profile?.phone || ''}
                onChange={e => update('phone', e.target.value)}
                placeholder="+47 000 00 000"
                type="tel"
                className="glass rounded-xl px-4 py-3 text-sm outline-none"
                style={{ color: 'var(--terra-dark)' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--terra-mid)' }}>Adresse</label>
              <input
                value={profile?.address || ''}
                onChange={e => update('address', e.target.value)}
                placeholder="Gate, postnummer, by"
                className="glass rounded-xl px-4 py-3 text-sm outline-none"
                style={{ color: 'var(--terra-dark)' }}
              />
            </div>
          </div>
        </section>

        {/* ── Tilkoblet profil ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--terra-mid)' }}>Tilkoblet profil</p>
          <p className="text-xs mb-3" style={{ color: 'var(--terra-mid)' }}>
            Koble til én annen bruker (f.eks. partner) slik at gjenstander deles automatisk mellom profilene.
          </p>

          {hasActiveConnection && connectedProfile && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                <Avatar profile={connectedProfile} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--terra-dark)' }}>
                    🔗 {connectedProfile.name || connectedProfile.email?.split('@')[0]}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Tilkoblet – gjenstander deles automatisk</p>
                </div>
              </div>
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(196,103,58,0.12)' }}>
                {!showDisconnectConfirm ? (
                  <button onClick={() => setShowDisconnectConfirm(true)} className="text-sm font-medium text-red-400">
                    Koble fra…
                  </button>
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--terra-dark)' }}>Er du sikker?</p>
                    <p className="text-xs mb-3" style={{ color: 'var(--terra-mid)' }}>Gjenstander vil ikke lenger vises på hverandres profiler.</p>
                    <div className="flex gap-2">
                      <button onClick={disconnect} disabled={connActionLoading} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                        {connActionLoading ? 'Kobler fra…' : 'Ja, koble fra'}
                      </button>
                      <button onClick={() => setShowDisconnectConfirm(false)} className="btn-glass flex-1 py-2.5 text-sm rounded-xl">
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasPendingOutgoing && connectedProfile && (
            <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <Avatar profile={connectedProfile} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{connectedProfile.name || connectedProfile.email?.split('@')[0]}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Venter på svar…</p>
              </div>
              <button onClick={cancelInvite} disabled={cancelLoading} className="btn-glass text-xs px-3 py-1.5 rounded-full disabled:opacity-50">
                {cancelLoading ? '…' : 'Trekk tilbake'}
              </button>
            </div>
          )}

          {!hasActiveConnection && !hasPendingOutgoing && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--terra-mid)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  value={connSearchQuery}
                  onChange={e => searchConnProfiles(e.target.value)}
                  placeholder="Søk etter navn eller e-post…"
                  className="glass w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none"
                  style={{ color: 'var(--terra-dark)' }}
                />
              </div>

              {connSearchLoading && <p className="text-xs px-1" style={{ color: 'var(--terra-mid)' }}>Søker…</p>}

              {connSearchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {connSearchResults.map(result => (
                    <div key={result.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                      <Avatar profile={result} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>{result.name || result.email?.split('@')[0]}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--terra-mid)' }}>{result.email}</p>
                      </div>
                      {connInviteSentTo === result.id ? (
                        <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(196,103,58,0.08)', color: 'var(--terra-mid)' }}>Sendt ✓</span>
                      ) : (
                        <button onClick={() => sendConnectionInvite(result.id, result.name)} disabled={connActionLoading} className="btn-primary text-xs px-3 py-1.5 rounded-full disabled:opacity-50">
                          🔗 Koble til
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {connSearchQuery.length >= 2 && !connSearchLoading && connSearchResults.length === 0 && (
                <p className="text-xs px-1" style={{ color: 'var(--terra-mid)' }}>Ingen brukere funnet.</p>
              )}
            </div>
          )}
        </section>

        {/* ── Interesser ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Interesser</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => {
              const selected = (profile?.interests || []).includes(interest)
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`pill ${selected ? 'active' : ''} text-sm`}
                >
                  {interest}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Personvern ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Personvern</p>
          <div className="flex flex-col gap-3">
            <div className="glass rounded-2xl px-4 py-3">
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--terra-dark)' }}>Hvem kan se profilen din?</p>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'public', label: '🌍 Alle' },
                  { id: 'friends', label: '👥 Kun venner' },
                  { id: 'private', label: '🔒 Ingen (skjult)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => update('privacy_profile', opt.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors text-left"
                    style={{
                      background: profile?.privacy_profile === opt.id ? 'rgba(196,103,58,0.10)' : 'transparent',
                      color: profile?.privacy_profile === opt.id ? 'var(--terra)' : 'var(--terra-dark)',
                      fontWeight: profile?.privacy_profile === opt.id ? 600 : 400,
                    }}
                  >
                    {profile?.privacy_profile === opt.id && <span style={{ color: 'var(--terra)' }}>✓</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Synlig i søk</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Andre kan finne deg via navn eller e-post</p>
              </div>
              <Toggle value={!!profile?.privacy_search} onChange={() => update('privacy_search', !profile?.privacy_search)} />
            </div>
          </div>
        </section>

        {/* ── Varsler ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Varsler</p>
          <div className="glass rounded-2xl divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
            {[
              { key: 'notif_loan_request', label: 'Nye låneforespørsler' },
              { key: 'notif_loan_accepted', label: 'Forespørsel godtatt/avslått' },
              { key: 'notif_friend_request', label: 'Venneforespørsler' },
              { key: 'notif_join_request', label: 'Forespørsler om å bli med i krets' },
            ].map(({ key, label }, i, arr) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3"
                style={i < arr.length - 1 ? { borderBottom: '1px solid rgba(196,103,58,0.10)' } : undefined}
              >
                <p className="text-sm" style={{ color: 'var(--terra-dark)' }}>{label}</p>
                <Toggle value={!!profile?.[key]} onChange={() => update(key, !profile?.[key])} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Lagre ── */}
        <button onClick={save} disabled={saving} className="btn-primary w-full py-3 rounded-xl font-medium disabled:opacity-50">
          {saved ? '✓ Lagret!' : saving ? 'Lagrer…' : 'Lagre endringer'}
        </button>

        {/* ── Konto ── */}
        <section className="flex flex-col gap-3 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Konto</p>
          <button
            onClick={() => router.push('/settings/change-password')}
            className="glass w-full rounded-xl py-3 text-sm font-medium text-left px-4 flex items-center justify-between"
            style={{ color: 'var(--terra-dark)' }}
          >
            <span>Endre passord</span>
            <span style={{ color: 'var(--terra-mid)' }}>→</span>
          </button>
          <button
            onClick={() => router.push('/settings/delete-account')}
            className="glass w-full rounded-xl py-3 text-sm font-medium text-left px-4"
            style={{ color: '#ef4444' }}
          >
            Slett konto
          </button>
        </section>

      </div>
      <div className="nav-spacer" />
    </div>
  )
}