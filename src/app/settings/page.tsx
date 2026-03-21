'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { track, Events } from '@/lib/track'

const INTERESTS = ['Barn', 'Bøker', 'Kjoler', 'Verktøy', 'Sport', 'Musikk', 'Matlaging', 'Hage', 'Kunst', 'Reise']
const LANGUAGES = [{ id: 'no', label: 'Norsk' }, { id: 'en', label: 'English' }]

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

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Connected profile
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
    // Active
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
      const { data: partner } = await supabase
        .from('profiles').select('id, name, email, avatar_url').eq('id', partnerId).single()
      setConnectedProfile(partner)
      return
    }

    // Pending outgoing
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
      const { data: partner } = await supabase
        .from('profiles').select('id, name, email, avatar_url').eq('id', partnerId).single()
      setConnectedProfile(partner)
    }
  }

  const searchConnProfiles = useCallback(async (q: string) => {
    setConnSearchQuery(q)
    if (q.trim().length < 2) { setConnSearchResults([]); return }
    setConnSearchLoading(true)
    const supabase = createClient()

    // 1. My friends only
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
      .eq('user_a', user.id)

    const friends = (friendships || []).map((f: any) => f.profiles).filter(Boolean)

    // 2. Find all users already in an active/pending connection (to exclude them)
    const { data: existingConns } = await supabase
      .from('profile_connections')
      .select('user_a, user_b')
      .in('status', ['active', 'pending'])

    const alreadyConnected = new Set<string>()
    ;(existingConns || []).forEach((c: any) => {
      alreadyConnected.add(c.user_a)
      alreadyConnected.add(c.user_b)
    })

    // 3. Filter friends by query and exclude already-connected
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
      .insert({ user_a: userA, user_b: userB, initiated_by: user.id, status: 'pending' })
      .select()
      .single()
    if (error || !newConn) { setConnActionLoading(false); return }

    await supabase.from('notifications').insert({
      user_id: targetId,
      type: 'connection_request',
      title: '🔗 Tilkoblingsforespørsel',
      body: `${profile?.name || user.email?.split('@')[0]} vil koble profiler med deg`,
      action_url: '/settings',
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
    // Clear connected_profile_id on all items (trigger handles this, but belt-and-suspenders)
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
      language: profile.language,
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

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    const supabase = createClient()
    await supabase.auth.updateUser({ password: newPassword })
    setNewPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2000)
  }

  const deleteAccount = async () => {
    const supabase = createClient()
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-8 text-center text-[#9C7B65]">Laster…</div>

  const hasActiveConnection = !!connection
  const hasPendingOutgoing = !!pendingOutgoing && !connection

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <h1 className="text-xl font-bold text-[#2C1A0E]">Innstillinger</h1>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* ── Profil ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Profil</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65]">Visningsnavn</label>
              <input
                value={profile?.name || ''}
                onChange={e => update('name', e.target.value)}
                placeholder="Ditt navn"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65]">Telefon</label>
              <input
                value={profile?.phone || ''}
                onChange={e => update('phone', e.target.value)}
                placeholder="+47 000 00 000"
                type="tel"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65]">Adresse</label>
              <input
                value={profile?.address || ''}
                onChange={e => update('address', e.target.value)}
                placeholder="Gate, postnummer, by"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
            </div>
          </div>
        </section>

        {/* ── Tilkoblet profil ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-1">Tilkoblet profil</p>
          <p className="text-xs text-[#9C7B65] mb-3">
            Koble til én annen bruker (f.eks. partner) slik at gjenstander deles automatisk mellom profilene.
          </p>

          {/* ACTIVE CONNECTION */}
          {hasActiveConnection && connectedProfile && (
            <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                <Avatar profile={connectedProfile} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#2C1A0E] flex items-center gap-1.5">
                    🔗 {connectedProfile.name || connectedProfile.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-[#9C7B65] mt-0.5">Tilkoblet – gjenstander deles automatisk</p>
                </div>
              </div>
              <div className="border-t border-[#E8DDD0] px-4 py-3">
                {!showDisconnectConfirm ? (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="text-sm text-red-400 font-medium"
                  >
                    Koble fra…
                  </button>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-[#2C1A0E] mb-1">Er du sikker?</p>
                    <p className="text-xs text-[#9C7B65] mb-3">
                      Gjenstander vil ikke lenger vises på hverandres profiler.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={disconnect}
                        disabled={connActionLoading}
                        className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
                      >
                        {connActionLoading ? 'Kobler fra…' : 'Ja, koble fra'}
                      </button>
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2.5 text-sm"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PENDING OUTGOING */}
          {hasPendingOutgoing && connectedProfile && (
            <div className="bg-white rounded-2xl border border-[#E8DDD0] px-4 py-3 flex items-center gap-3">
              <Avatar profile={connectedProfile} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#2C1A0E]">
                  {connectedProfile.name || connectedProfile.email?.split('@')[0]}
                </p>
                <p className="text-xs text-[#9C7B65] mt-0.5">Venter på svar…</p>
              </div>
              <button
                onClick={cancelInvite}
                disabled={cancelLoading}
                className="text-xs px-3 py-1.5 rounded-full border border-[#E8DDD0] text-[#9C7B65] disabled:opacity-50"
              >
                {cancelLoading ? '…' : 'Trekk tilbake'}
              </button>
            </div>
          )}

          {/* NO CONNECTION — search + invite */}
          {!hasActiveConnection && !hasPendingOutgoing && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#9C7B65]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  value={connSearchQuery}
                  onChange={e => searchConnProfiles(e.target.value)}
                  placeholder="Søk etter navn eller e-post…"
                  className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
                />
              </div>

              {connSearchLoading && (
                <p className="text-xs text-[#9C7B65] px-1">Søker…</p>
              )}

              {connSearchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {connSearchResults.map(result => (
                    <div
                      key={result.id}
                      className="bg-white rounded-2xl border border-[#E8DDD0] px-4 py-3 flex items-center gap-3"
                    >
                      <Avatar profile={result} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#2C1A0E] truncate">
                          {result.name || result.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-[#9C7B65] truncate">{result.email}</p>
                      </div>
                      {connInviteSentTo === result.id ? (
                        <span className="text-xs px-3 py-1.5 rounded-full bg-[#FAF7F2] text-[#9C7B65]">
                          Sendt ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => sendConnectionInvite(result.id, result.name)}
                          disabled={connActionLoading}
                          className="text-xs px-3 py-1.5 rounded-full font-medium disabled:opacity-50"
                          style={{ background: 'var(--terra)', color: '#fff' }}
                        >
                          🔗 Koble til
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {connSearchQuery.length >= 2 && !connSearchLoading && connSearchResults.length === 0 && (
                <p className="text-xs text-[#9C7B65] px-1">Ingen brukere funnet.</p>
              )}
            </div>
          )}
        </section>

        {/* ── Interesser ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Interesser</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => {
              const selected = (profile?.interests || []).includes(interest)
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selected ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                  }`}
                >
                  {interest}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Språk ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Språk</p>
          <div className="flex gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => update('language', lang.id)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  profile?.language === lang.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Personvern ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Personvern</p>
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
              <p className="text-sm font-medium text-[#2C1A0E] mb-2">Hvem kan se profilen din?</p>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'public', label: '🌍 Alle' },
                  { id: 'friends', label: '👥 Kun venner' },
                  { id: 'private', label: '🔒 Ingen (skjult)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => update('privacy_profile', opt.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                      profile?.privacy_profile === opt.id ? 'bg-[#FFF0E6] text-[#C4673A] font-medium' : 'text-[#6B4226]'
                    }`}
                  >
                    {profile?.privacy_profile === opt.id && <span>✓</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-[#2C1A0E]">Synlig i søk</p>
                <p className="text-xs text-[#9C7B65] mt-0.5">Andre kan finne deg via navn eller e-post</p>
              </div>
              <button
                onClick={() => update('privacy_search', !profile?.privacy_search)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${profile?.privacy_search ? 'bg-[#C4673A]' : 'bg-[#E8DDD0]'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${profile?.privacy_search ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Varsler ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Varsler</p>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-[#E8DDD0]">
            {[
              { key: 'notif_loan_request', label: 'Nye låneforespørsler' },
              { key: 'notif_loan_accepted', label: 'Forespørsel godtatt/avslått' },
              { key: 'notif_friend_request', label: 'Venneforespørsler' },
              { key: 'notif_join_request', label: 'Forespørsler om å bli med i krets' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-[#2C1A0E]">{label}</p>
                <button
                  onClick={() => update(key, !profile?.[key])}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${profile?.[key] ? 'bg-[#C4673A]' : 'bg-[#E8DDD0]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${profile?.[key] ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Endre passord ── */}
        <section>
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Endre passord</p>
          <div className="flex gap-2">
            <input
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              type="password"
              placeholder="Nytt passord (min. 6 tegn)"
              className="flex-1 bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
            />
            <button
              onClick={changePassword}
              disabled={newPassword.length < 6}
              className="bg-[#2C1A0E] text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-30"
            >
              {passwordSaved ? '✓' : 'Lagre'}
            </button>
          </div>
        </section>

        {/* ── Lagre ── */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {saved ? '✓ Lagret!' : saving ? 'Lagrer…' : 'Lagre endringer'}
        </button>

        {/* ── Slett konto ── */}
        <section className="pb-4">
          <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Faresone</p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-white border border-red-200 text-red-400 rounded-xl py-3 text-sm font-medium"
            >
              Slett konto
            </button>
          ) : (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
              <p className="text-sm text-red-600 font-medium mb-1">Er du sikker?</p>
              <p className="text-xs text-red-400 mb-4">Dette kan ikke angres. All data slettes permanent.</p>
              <div className="flex gap-2">
                <button onClick={deleteAccount} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium">Ja, slett kontoen</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2.5 text-sm">Avbryt</button>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
