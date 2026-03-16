'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '@/lib/track'

// ─── Item catalogue by category / age ────────────────────────────────────────
const ITEM_CATALOGUE: Record<string, { label: string; emoji: string; items: string[] }[]> = {
  Barn: [
    {
      label: '0–6 mnd',
      emoji: '🍼',
      items: [
        'Bedside crib', 'Babynest',
        'Babybilstol', 'Bæresjal/sele',
        'Babygym', 'Vippestol',
        'Badebalje med nyfødtstøtte',
        'Omslagsbodyer (str. 50–68)', 'Tynne ullsett (str. 50–68)',
        'Brystpumpe', 'Sterilisator', 'Flaskevarmer',
      ],
    },
    {
      label: '6–12 mnd',
      emoji: '🧒',
      items: [
        'Babysete til høystol', 'Matprosessor/blender',
        'Vognpose (vår/vinter)', 'Bæremeis',
        'Gåvogn', 'Aktivitetstablett/-bord',
        'Parkdress til krabbing', 'Første par med sko',
      ],
    },
    {
      label: '1–2 år',
      emoji: '🚶',
      items: [
        'Reiseseng', 'Junior-dyne',
        'Bilstol nr. 2', 'Sykkelvogn', 'Trille',
        'Trehjulsykkel', 'Balansesykkel', 'Sandkassesett',
        'Regntøy og skallbekledning', 'Vinterdress',
      ],
    },
    {
      label: '3–6 år',
      emoji: '🚲',
      items: [
        'Sykkel med pedaler', 'Skiutstyr', 'Skøyteutstyr', 'Sparkesykkel',
        'Barnehagesekk', 'Termos', 'Sitteunderlag',
        'Sengehest til juniorseng',
        'Store ytterklær', 'Pensko til spesielle anledninger',
      ],
    },
  ],
  Verktøy: [
    {
      label: 'Hage & bygg',
      emoji: '🔨',
      items: ['Drill', 'Sirkelsag', 'Sliper', 'Høytrykkspyler', 'Gressklipper', 'Hagesaks', 'Trillebår', 'Stige'],
    },
  ],
  Sport: [
    {
      label: 'Friluft & trening',
      emoji: '⛷️',
      items: ['Ski (voksen)', 'Skistøvler', 'Sykkel', 'Telt', 'Sovepose', 'Ryggsekk', 'Kajakk', 'Rulleskøyter'],
    },
  ],
  Bøker: [
    {
      label: 'Bøker & spill',
      emoji: '📚',
      items: ['Brettspill', 'Puslespill', 'Fagbøker', 'Romaner', 'Kokebøker', 'Barnebøker'],
    },
  ],
  Matlaging: [
    {
      label: 'Kjøkken',
      emoji: '🍳',
      items: ['Kjøkkenmaskin', 'Is-maskin', 'Sous vide', 'Vaffelsjern', 'Iskremmaskin', 'Espressmaskin'],
    },
  ],
  Musikk: [
    {
      label: 'Instrumenter & utstyr',
      emoji: '🎸',
      items: ['Gitar', 'Piano/keyboard', 'Ukulele', 'Trommer/pad', 'Mikrofon', 'Høyttaler', 'Forsterker'],
    },
  ],
  Hage: [
    {
      label: 'Hage & uteplass',
      emoji: '🌱',
      items: ['Hagesett', 'Paraply/paviljong', 'Bord og stoler (plast)', 'Hengekøye', 'Kompostbeholder', 'Vatningsanlegg'],
    },
  ],
}

const ALL_CATEGORIES = Object.keys(ITEM_CATALOGUE)
const TOTAL_STEPS = 8

// ─── Helper ──────────────────────────────────────────────────────────────────
function AgeGroupSection({
  group,
  have,
  want,
  onToggleHave,
  onToggleWant,
}: {
  group: { label: string; emoji: string; items: string[] }
  have: Set<string>
  want: Set<string>
  onToggleHave: (item: string) => void
  onToggleWant: (item: string) => void
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--terra-mid)' }}>
        {group.emoji} {group.label}
      </p>
      <div className="flex flex-col gap-2">
        {group.items.map(item => {
          const owned = have.has(item)
          const wished = want.has(item)
          return (
            <div
              key={item}
              className="glass flex items-center justify-between px-4 py-2.5"
              style={{ borderRadius: 12 }}
            >
              <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleHave(item)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    owned
                      ? 'border-[rgba(196,103,58,0.45)] text-white'
                      : 'border-[rgba(196,103,58,0.3)] text-[#C4673A]'
                  }`}
                  style={owned ? { background: 'var(--terra)', borderColor: 'transparent' } : {}}
                >
                  {owned ? '✓ Jeg har' : 'Jeg har'}
                </button>
                {!owned && (
                  <button
                    onClick={() => onToggleWant(item)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      wished
                        ? 'border-transparent text-white'
                        : 'border-[rgba(74,124,89,0.4)] text-[#4A7C59]'
                    }`}
                    style={wished ? { background: 'var(--terra-green)', borderColor: 'transparent' } : {}}
                  >
                    {wished ? '♥ Ønsket' : '♡ Ønsker'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function OnboardingContent() {
  const [step, setStep] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite') // e.g. userId of the inviter

  // Profile fields
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)

  // Friends
  const [inviter, setInviter] = useState<any>(null)
  const [friendSuggestions, setFriendSuggestions] = useState<any[]>([])
  const [sentFriendRequests, setSentFriendRequests] = useState<Set<string>>(new Set())

  // Communities
  const [communitySuggestions, setCommunitySuggestions] = useState<any[]>([])
  const [sentJoinRequests, setSentJoinRequests] = useState<Set<string>>(new Set())

  // Items
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set())
  const [wantedItems, setWantedItems] = useState<Set<string>>(new Set())

  // Load inviter + suggestions on mount
  useEffect(() => {
    if (!inviteCode) return
    ;(async () => {
      const supabase = createClient()
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('id', inviteCode)
        .single()
      if (inviterProfile) {
        setInviter(inviterProfile)
        // Load inviter's friends as suggestions
        const { data: theirFriendships } = await supabase
          .from('friendships')
          .select('user_b')
          .eq('user_a', inviteCode)
          .limit(6)
        if (theirFriendships?.length) {
          const ids = theirFriendships.map((f: any) => f.user_b)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', ids)
          setFriendSuggestions(profiles ?? [])
        }
        // Load inviter's communities as suggestions
        const { data: theirComs } = await supabase
          .from('community_members')
          .select('community_id, communities(id, name, avatar_emoji, is_public)')
          .eq('user_id', inviteCode)
          .limit(6)
        if (theirComs?.length) {
          const coms = theirComs
            .map((r: any) => r.communities)
            .filter(Boolean)
          setCommunitySuggestions(coms)
        }
      }
    })()
  }, [inviteCode])

  const next = () => {
    track('onboarding_step_completed', { step })
    setStep(s => s + 1)
  }
  const skip = () => {
    track('onboarding_step_skipped', { step })
    if (step >= TOTAL_STEPS) {
      router.push('/')
    } else {
      setStep(s => s + 1)
    }
  }

  const checkUsername = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(clean)
    if (clean.length < 3) { setUsernameError('Minst 3 tegn'); return }
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).single()
    setUsernameError(data ? 'Brukernavnet er tatt' : '')
  }

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const saveProfile = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let avatar_url = ''
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      await supabase.storage.from('item-images').upload(path, avatarFile, { upsert: true })
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      avatar_url = data.publicUrl
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      name,
      username: username || null,
      phone,
      address,
      avatar_url: avatar_url || null,
    })

    track('onboarding_profile_saved')
    setSaving(false)
    next()
  }

  const sendFriendRequest = async (toId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('friend_requests').insert({ from_id: user.id, to_id: toId })
    await supabase.from('notifications').insert({
      user_id: toId,
      type: 'friend_request',
      title: 'Ny venneforespørsel',
      body: `${name} vil være din venn på Village`,
    })
    track('friend_request_sent', { to_id: toId, from_onboarding: true })
    setSentFriendRequests(prev => new Set(prev).add(toId))
  }

  const sendJoinRequest = async (communityId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('community_members').insert({
      user_id: user.id,
      community_id: communityId,
      status: 'pending',
    })
    track('community_join_requested', { community_id: communityId, from_onboarding: true })
    setSentJoinRequests(prev => new Set(prev).add(communityId))
  }

  const saveWishes = async () => {
    // Persist wished items as wishlisted items (using a separate table if available,
    // or just navigate — implementation detail deferred to when wishlist table exists)
    track('onboarding_wishes_saved', {
      owned_count: ownedItems.size,
      wanted_count: wantedItems.size,
    })
    router.push('/')
  }

  const toggleCategory = (cat: string) =>
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )

  const toggleHave = (item: string) => {
    setOwnedItems(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
    // Remove from wanted if switched to owned
    setWantedItems(prev => {
      const next = new Set(prev)
      next.delete(item)
      return next
    })
  }

  const toggleWant = (item: string) => {
    setWantedItems(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  // ── Catalogue for selected categories ──────────────────────────────────────
  const activeCatalogue = selectedCategories.flatMap(cat => ITEM_CATALOGUE[cat] ?? [])

  // ── Progress bar ────────────────────────────────────────────────────────────
  const ProgressBar = () => (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all"
          style={{
            background: i < step ? 'var(--terra)' : 'rgba(196,103,58,0.15)',
          }}
        />
      ))}
    </div>
  )

  // ── Bottom navigation ───────────────────────────────────────────────────────
  const NavButtons = ({
    onNext,
    nextLabel = 'Videre →',
    nextDisabled = false,
    skipLabel = 'Gjør senere',
    hideSkip = false,
  }: {
    onNext: () => void
    nextLabel?: string
    nextDisabled?: boolean
    skipLabel?: string
    hideSkip?: boolean
  }) => (
    <div className="flex gap-3 mt-8">
      {!hideSkip && (
        <button onClick={skip} className="text-sm px-4 py-3" style={{ color: 'var(--terra-mid)' }}>
          {skipLabel}
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="btn-primary flex-1"
        style={{ borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 600, opacity: nextDisabled ? 0.45 : 1 }}
      >
        {nextLabel}
      </button>
    </div>
  )

  // ─── Step renderers ────────────────────────────────────────────────────────

  // STEP 1 — Welcome
  const StepWelcome = () => (
    <div className="flex flex-col gap-6 flex-1">
      <div className="text-center pt-4 pb-2">
        <div className="text-5xl mb-4">🏡</div>
        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Velkommen til Village!
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
          Takk for at du er med og hjelper omgangskretsene dine med å utnytte eiendelene sine bedre – sammen!
        </p>
      </div>

      <div className="glass flex flex-col gap-4 p-5" style={{ borderRadius: 20 }}>
        {[
          { emoji: '🔄', title: 'Del ting du ikke bruker', desc: 'Lån ut til venner og naboer – ingen deling skjer uten din godkjenning' },
          { emoji: '🤝', title: 'Lån fra folk du stoler på', desc: 'Finn det du trenger i dine kretser – uten å kjøpe nytt' },
          { emoji: '🔔', title: 'Full kontroll alltid', desc: 'Du bestemmer hva, hvem og når – og godkjenner hvert utlån' },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">{emoji}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{title}</p>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <NavButtons onNext={next} nextLabel="La oss sette opp profilen din →" hideSkip />
    </div>
  )

  // STEP 2 — Profile
  const StepProfile = () => (
    <div className="flex flex-col gap-6 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Hvem er du?
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Profilen din er kun synlig for venner og kretser</p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2">
        <label className="cursor-pointer">
          <div
            className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(196,103,58,0.1)', border: '2px dashed rgba(196,103,58,0.35)' }}
          >
            {avatarPreview
              ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
              : <span className="text-4xl">📷</span>}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </label>
        <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Trykk for å legge til profilbilde</p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">
        {[
          { label: 'Navn *', value: name, setter: setName, placeholder: 'Hva heter du?', type: 'text' },
          { label: 'Telefon', value: phone, setter: setPhone, placeholder: '+47 000 00 000', type: 'tel' },
          { label: 'Adresse', value: address, setter: setAddress, placeholder: 'Gate, postnummer, by', type: 'text' },
        ].map(({ label, value, setter, placeholder, type }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>{label}</label>
            <input
              value={value}
              onChange={e => setter(e.target.value)}
              placeholder={placeholder}
              type={type}
              className="glass px-4 py-3 outline-none"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }}
            />
          </div>
        ))}

        {/* Username */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Brukernavn</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--terra-mid)' }}>@</span>
            <input
              value={username}
              onChange={e => checkUsername(e.target.value)}
              placeholder="ditt_brukernavn"
              className="glass w-full pl-8 pr-4 py-3 outline-none"
              style={{
                borderRadius: 14,
                color: 'var(--terra-dark)',
                fontSize: 15,
                borderColor: usernameError ? 'rgba(220,38,38,0.4)' : undefined,
              }}
            />
          </div>
          {usernameError && <p className="text-xs" style={{ color: '#ef4444' }}>{usernameError}</p>}
          {username && !usernameError && username.length >= 3 && (
            <p className="text-xs" style={{ color: 'var(--terra-green)' }}>✓ Ledig</p>
          )}
        </div>
      </div>

      <NavButtons
        onNext={saveProfile}
        nextLabel={saving ? 'Lagrer…' : 'Videre →'}
        nextDisabled={!name || saving || !!usernameError}
      />
    </div>
  )

  // STEP 3 — Friends (from invite or general)
  const StepFriends = () => (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Legg til venner
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Venner ser det du deler og kan be om å låne
        </p>
      </div>

      {inviter && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--terra-mid)' }}>
            Invitert av
          </p>
          <div className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg"
                style={{ background: 'rgba(196,103,58,0.15)' }}
              >
                {inviter.avatar_url
                  ? <img src={inviter.avatar_url} className="w-full h-full object-cover" alt="" />
                  : '👤'}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{inviter.name}</p>
                {inviter.username && (
                  <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>@{inviter.username}</p>
                )}
              </div>
            </div>
            {sentFriendRequests.has(inviter.id) ? (
              <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>
                ✓ Sendt
              </span>
            ) : (
              <button
                onClick={() => sendFriendRequest(inviter.id)}
                className="btn-primary text-sm px-4 py-2"
                style={{ borderRadius: 10, padding: '6px 14px' }}
              >
                + Legg til
              </button>
            )}
          </div>
        </div>
      )}

      {friendSuggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--terra-mid)' }}>
            {inviter ? `${inviter.name.split(' ')[0]}s venner` : 'Foreslåtte venner'}
          </p>
          <div className="flex flex-col gap-2">
            {friendSuggestions.map(p => (
              <div key={p.id} className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg"
                    style={{ background: 'rgba(196,103,58,0.15)' }}
                  >
                    {p.avatar_url
                      ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                      : '👤'}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{p.name}</p>
                    {p.username && (
                      <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>@{p.username}</p>
                    )}
                  </div>
                </div>
                {sentFriendRequests.has(p.id) ? (
                  <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>
                    ✓ Sendt
                  </span>
                ) : (
                  <button
                    onClick={() => sendFriendRequest(p.id)}
                    className="btn-glass text-sm"
                    style={{ borderRadius: 10, padding: '6px 14px' }}
                  >
                    + Legg til
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!inviter && friendSuggestions.length === 0 && (
        <div className="glass p-5 text-center" style={{ borderRadius: 16 }}>
          <p className="text-2xl mb-2">👋</p>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Finn venner via «Profil» etter at du er i gang, eller del invitasjonslenken din med dem.
          </p>
        </div>
      )}

      <NavButtons onNext={next} nextLabel="Videre →" />
    </div>
  )

  // STEP 4 — Communities
  const StepCommunities = () => (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Bli med i kretser
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Kretser er grupper du deler ting innen – nabolag, barnehage, idrettslag og mer
        </p>
      </div>

      {communitySuggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {communitySuggestions.map((c: any) => (
            <div key={c.id} className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.avatar_emoji ?? '🏘️'}</span>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{c.name}</p>
              </div>
              {sentJoinRequests.has(c.id) ? (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>
                  ✓ Sendt
                </span>
              ) : (
                <button
                  onClick={() => sendJoinRequest(c.id)}
                  className="btn-glass text-sm"
                  style={{ borderRadius: 10, padding: '6px 14px' }}
                >
                  + Bli med
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass p-5 text-center" style={{ borderRadius: 16 }}>
          <p className="text-2xl mb-2">🏘️</p>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Du kan opprette eller søke etter kretser under «Kretser» i appen.
          </p>
        </div>
      )}

      <NavButtons onNext={next} nextLabel="Videre →" />
    </div>
  )

  // STEP 5 — Interests / categories
  const StepCategories = () => (
    <div className="flex flex-col gap-6 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Hva er du interessert i?
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Velg kategoriene som passer deg – vi bruker det til å foreslå ting du kan dele og låne
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(cat => {
          const active = selectedCategories.includes(cat)
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={active ? 'pill active' : 'pill'}
            >
              {cat}
            </button>
          )
        })}
      </div>
      <NavButtons
        onNext={next}
        nextLabel="Videre →"
        nextDisabled={selectedCategories.length === 0}
        skipLabel="Hopp over"
      />
    </div>
  )

  // STEP 6 — Share items
  const StepShareItems = () => (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Hva kan du dele?
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Merk det du eier og er åpen for å låne ut. Ingenting deles uten at du legger det ut i en krets, og hvert utlån krever din godkjenning.
        </p>
      </div>

      <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
        <span className="text-xl mt-0.5">💡</span>
        <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
          Behovene varierer fra familie til familie – marker bare det som faktisk er aktuelt for deg.
        </p>
      </div>

      {activeCatalogue.map(group => (
        <AgeGroupSection
          key={group.label}
          group={group}
          have={ownedItems}
          want={wantedItems}
          onToggleHave={toggleHave}
          onToggleWant={toggleWant}
        />
      ))}

      <NavButtons
        onNext={next}
        nextLabel={`Videre ${ownedItems.size > 0 ? `(${ownedItems.size} valgt)` : '→'}`}
        skipLabel="Hopp over"
      />
    </div>
  )

  // STEP 7 — Wishlist / wants
  const StepWishlist = () => {
    // Items not yet owned in selected categories
    const notOwnedGroups = activeCatalogue
      .map(group => ({
        ...group,
        items: group.items.filter(i => !ownedItems.has(i)),
      }))
      .filter(g => g.items.length > 0)

    return (
      <div className="flex flex-col gap-5 flex-1">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Hva ønsker du å låne?
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
            Hjertemerk ting du ikke har – du får varsel hvis noen i nettverket ditt begynner å låne det ut.
          </p>
        </div>

        <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
          <span className="text-xl mt-0.5">🔔</span>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Når du hjertemerker noe, varsler vi deg automatisk hvis noen i dine kretser legger det ut.
          </p>
        </div>

        {notOwnedGroups.map(group => (
          <AgeGroupSection
            key={group.label}
            group={group}
            have={ownedItems}
            want={wantedItems}
            onToggleHave={toggleHave}
            onToggleWant={toggleWant}
          />
        ))}

        <NavButtons
          onNext={next}
          nextLabel={`Videre ${wantedItems.size > 0 ? `(${wantedItems.size} ønsket)` : '→'}`}
          skipLabel="Hopp over"
        />
      </div>
    )
  }

  // STEP 8 — Done
  const StepDone = () => (
    <div className="flex flex-col gap-6 flex-1 items-center text-center pt-6">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Du er klar!
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
          Profilen din er satt opp. Nå kan du begynne å dele og låne med vennene dine.
        </p>
      </div>

      <div className="glass w-full p-5 text-left" style={{ borderRadius: 20 }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--terra-dark)' }}>Hva skjer videre</p>
        {[
          { emoji: '📦', text: `Du la til ${ownedItems.size} ting du kan dele – gå til «Legg ut» for å publisere dem i kretser` },
          { emoji: '♥', text: `${wantedItems.size} ønsker lagt til – du varsles når noen i nettverket ditt deler dem` },
          { emoji: '🔍', text: 'Bla i «Utforsk» for å finne ting fra venner og kretser' },
        ].map(({ emoji, text }) => (
          <div key={emoji} className="flex gap-3 mb-2 last:mb-0">
            <span>{emoji}</span>
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{text}</p>
          </div>
        ))}
      </div>

      <NavButtons
        onNext={saveWishes}
        nextLabel="Kom i gang 🏡"
        hideSkip
      />
    </div>
  )

  // ─── Step map ──────────────────────────────────────────────────────────────
  const stepComponents: Record<number, React.ReactNode> = {
    1: <StepWelcome />,
    2: <StepProfile />,
    3: <StepFriends />,
    4: <StepCommunities />,
    5: <StepCategories />,
    6: <StepShareItems />,
    7: <StepWishlist />,
    8: <StepDone />,
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-24 min-h-screen flex flex-col">
      <ProgressBar />
      {stepComponents[step]}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
