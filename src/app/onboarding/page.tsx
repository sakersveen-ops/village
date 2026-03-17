'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '@/lib/track'

// ─── SVG stroke icons ─────────────────────────────────────────────────────────
const IconShare = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)
const IconHand = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>
)
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const IconHeart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const IconHeartFilled = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

// ─── Item catalogue ───────────────────────────────────────────────────────────
const ITEM_CATALOGUE: Record<string, { label: string; items: string[] }[]> = {
  Barn: [
    { label: '0–6 mnd', items: ['Bedside crib', 'Babynest', 'Babybilstol', 'Bæresjal/sele', 'Babygym', 'Vippestol', 'Badebalje med nyfødtstøtte', 'Brystpumpe', 'Sterilisator', 'Flaskevarmer', 'Omslagsbodyer (str. 50–68)'] },
    { label: '6–12 mnd', items: ['Babysete til høystol', 'Matprosessor/blender', 'Vognpose (vår/vinter)', 'Bæremeis', 'Gåvogn', 'Aktivitetstablett/-bord', 'Parkdress til krabbing'] },
    { label: '1–2 år', items: ['Reiseseng', 'Junior-dyne', 'Bilstol nr. 2', 'Sykkelvogn', 'Trehjulsykkel', 'Balansesykkel', 'Sandkassesett', 'Regntøy og skallbekledning', 'Vinterdress'] },
    { label: '3–6 år', items: ['Sykkel med pedaler', 'Skiutstyr', 'Skøyteutstyr', 'Sparkesykkel', 'Barnehagesekk', 'Termos', 'Sengehest til juniorseng', 'Store ytterklær'] },
  ],
  Verktøy: [{ label: 'Hage & bygg', items: ['Drill', 'Sirkelsag', 'Sliper', 'Høytrykkspyler', 'Gressklipper', 'Hagesaks', 'Trillebår', 'Stige'] }],
  Sport: [{ label: 'Friluft & trening', items: ['Ski (voksen)', 'Skistøvler', 'Sykkel', 'Telt', 'Sovepose', 'Ryggsekk', 'Kajakk', 'Rulleskøyter'] }],
  Bøker: [{ label: 'Bøker & spill', items: ['Brettspill', 'Puslespill', 'Fagbøker', 'Romaner', 'Kokebøker', 'Barnebøker'] }],
  Matlaging: [{ label: 'Kjøkken', items: ['Kjøkkenmaskin', 'Is-maskin', 'Sous vide', 'Vaffelsjern', 'Iskremmaskin', 'Espressmaskin'] }],
  Musikk: [{ label: 'Instrumenter & utstyr', items: ['Gitar', 'Piano/keyboard', 'Ukulele', 'Trommer/pad', 'Mikrofon', 'Høyttaler', 'Forsterker'] }],
  Hage: [{ label: 'Hage & uteplass', items: ['Hagesett', 'Paraply/paviljong', 'Bord og stoler (plast)', 'Hengekøye', 'Kompostbeholder', 'Vatningsanlegg'] }],
}

const ALL_CATEGORIES = Object.keys(ITEM_CATALOGUE)
const TOTAL_STEPS = 8

// ─── Shared primitives (top-level to avoid remount on each render) ────────────

type NavButtonsProps = {
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  skipLabel?: string
  hideSkip?: boolean
  onSkip?: () => void
}
function NavButtons({ onNext, nextLabel = 'Videre →', nextDisabled = false, skipLabel = 'Gjør senere', hideSkip = false, onSkip }: NavButtonsProps) {
  return (
    <div className="flex gap-3 mt-8">
      {!hideSkip && (
        <button onClick={onSkip} className="text-sm px-4 py-3 shrink-0" style={{ color: 'var(--terra-mid)' }}>
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
}

function ProfileRow({ profile, sent, onAdd }: { profile: any; sent: boolean; onAdd: () => void }) {
  return (
    <div className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg shrink-0"
          style={{ background: 'rgba(196,103,58,0.15)' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" /> : '👤'}
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{profile.name}</p>
          {profile.username && <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>@{profile.username}</p>}
        </div>
      </div>
      {sent
        ? <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>✓ Sendt</span>
        : <button onClick={onAdd} className="btn-glass text-sm" style={{ borderRadius: 10, padding: '6px 14px' }}>+ Legg til</button>}
    </div>
  )
}

function ShareItemRow({ item, owned, onToggle }: { item: string; owned: boolean; onToggle: () => void }) {
  return (
    <div className="glass flex items-center justify-between px-4 py-2.5" style={{ borderRadius: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
      <button onClick={onToggle} className="text-xs px-3 py-1 rounded-full border transition-colors shrink-0"
        style={owned
          ? { background: 'var(--terra)', borderColor: 'transparent', color: '#fff' }
          : { borderColor: 'rgba(196,103,58,0.3)', color: 'var(--terra)' }}>
        {owned ? '✓ Jeg har' : 'Jeg har'}
      </button>
    </div>
  )
}

function WishRow({ item, wished, onToggle }: { item: string; wished: boolean; onToggle: () => void }) {
  return (
    <div className="glass flex items-center justify-between px-4 py-2.5" style={{ borderRadius: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
      <button onClick={onToggle}
        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors shrink-0"
        style={wished
          ? { background: 'var(--terra-green)', borderColor: 'transparent', color: '#fff' }
          : { borderColor: 'rgba(74,124,89,0.4)', color: 'var(--terra-green)' }}>
        {wished ? <IconHeartFilled /> : <IconHeart />}
        {wished ? 'Ønsket' : 'Ønsker'}
      </button>
    </div>
  )
}

// ─── Step 2: Profile (top-level to avoid losing input focus) ─────────────────
type ProfileStepProps = {
  name: string; setName: (v: string) => void
  username: string; setUsername: (v: string) => void
  usernameError: string; setUsernameError: (v: string) => void
  usernameSuggested: boolean; setUsernameSuggested: (v: boolean) => void
  phone: string; setPhone: (v: string) => void
  address: string; setAddress: (v: string) => void
  avatarPreview: string; setAvatarFile: (f: File | null) => void; setAvatarPreview: (s: string) => void
  saving: boolean; onSave: () => void; onSkip: () => void
}
function ProfileStep({
  name, setName, username, setUsername, usernameError, setUsernameError,
  usernameSuggested, setUsernameSuggested,
  phone, setPhone, address, setAddress,
  avatarPreview, setAvatarFile, setAvatarPreview,
  saving, onSave, onSkip,
}: ProfileStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const validateUsername = useCallback(async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(clean)
    if (clean.length < 3) { setUsernameError('Minst 3 tegn'); return }
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle()
    setUsernameError(data ? 'Brukernavnet er tatt' : '')
  }, [setUsername, setUsernameError])

  // Auto-suggest username from name (only when not manually set)
  useEffect(() => {
    if (!name || !usernameSuggested) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const base = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '').slice(0, 20)
      if (!base || base.length < 2) return
      const supabase = createClient()
      let candidate = base
      for (let i = 2; i <= 9; i++) {
        const { data } = await supabase.from('profiles').select('id').eq('username', candidate).maybeSingle()
        if (!data) break
        candidate = `${base}_${i}`
      }
      setUsername(candidate)
      setUsernameError('')
    }, 600)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [name, usernameSuggested, setUsername, setUsernameError])

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  return (
    <div className="flex flex-col gap-6 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Hvem er du?
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Profilen din er kun synlig for venner og kretser</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <label className="cursor-pointer">
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(196,103,58,0.1)', border: '2px dashed rgba(196,103,58,0.35)' }}>
            {avatarPreview
              ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
              : <span className="text-4xl">📷</span>}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </label>
        <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Trykk for å legge til profilbilde</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Navn *</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (!username) setUsernameSuggested(true) }}
            placeholder="Hva heter du?"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Brukernavn</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--terra-mid)' }}>@</span>
            <input
              value={username}
              onChange={e => { setUsernameSuggested(false); validateUsername(e.target.value) }}
              placeholder="ditt_brukernavn"
              className="glass w-full pl-8 pr-4 py-3 outline-none"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15,
                borderColor: usernameError ? 'rgba(220,38,38,0.4)' : undefined }}
            />
          </div>
          {usernameError
            ? <p className="text-xs" style={{ color: '#ef4444' }}>{usernameError}</p>
            : username.length >= 3
              ? <p className="text-xs" style={{ color: 'var(--terra-green)' }}>✓ Ledig</p>
              : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Telefon</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+47 000 00 000" type="tel"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Adresse</label>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Gate, postnummer, by"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        </div>
      </div>

      <NavButtons onNext={onSave} nextLabel={saving ? 'Lagrer…' : 'Videre →'}
        nextDisabled={!name || saving || !!usernameError} onSkip={onSkip} />
    </div>
  )
}

// ─── Step 3: Friends (top-level) ──────────────────────────────────────────────
type FriendsStepProps = {
  inviter: any; friendSuggestions: any[]
  sentFriendRequests: Set<string>; onSendRequest: (id: string) => void
  onNext: () => void; onSkip: () => void
}
function FriendsStep({ inviter, friendSuggestions, sentFriendRequests, onSendRequest, onNext, onSkip }: FriendsStepProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const { data } = await supabase.from('profiles')
        .select('id, name, username, avatar_url')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 400)
  }, [query])

  const shown = query.length >= 2 ? results : friendSuggestions

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Legg til venner
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Venner ser det du deler og kan be om å låne</p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--terra-mid)' }}><IconSearch /></span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Søk på navn eller @brukernavn"
          className="glass w-full pl-10 pr-4 py-3 outline-none"
          style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--terra-mid)' }}>…</span>}
      </div>

      {inviter && query.length < 2 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--terra-mid)' }}>Invitert av</p>
          <ProfileRow profile={inviter} sent={sentFriendRequests.has(inviter.id)} onAdd={() => onSendRequest(inviter.id)} />
        </div>
      )}

      {shown.length > 0 && (
        <div>
          {query.length < 2 && friendSuggestions.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--terra-mid)' }}>
              {inviter ? `${inviter.name.split(' ')[0]}s venner` : 'Foreslåtte venner'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {shown.filter(p => p.id !== inviter?.id).map(p => (
              <ProfileRow key={p.id} profile={p} sent={sentFriendRequests.has(p.id)} onAdd={() => onSendRequest(p.id)} />
            ))}
          </div>
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-center" style={{ color: 'var(--terra-mid)' }}>Ingen treff på «{query}»</p>
      )}

      {!inviter && friendSuggestions.length === 0 && query.length < 2 && (
        <div className="glass p-5 text-center" style={{ borderRadius: 16 }}>
          <p className="text-2xl mb-2">👋</p>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Søk etter venner ovenfor, eller del invitasjonslenken din med dem etter at du er i gang.
          </p>
        </div>
      )}

      <NavButtons onNext={onNext} nextLabel="Videre →" onSkip={onSkip} />
    </div>
  )
}

// ─── Step 4: Communities (top-level) ─────────────────────────────────────────
type CommunitiesStepProps = {
  communitySuggestions: any[]; sentJoinRequests: Set<string>
  onJoin: (id: string) => void; onCreate: (name: string) => void
  onNext: () => void; onSkip: () => void
}
function CommunitiesStep({ communitySuggestions, sentJoinRequests, onJoin, onCreate, onNext, onSkip }: CommunitiesStepProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const { data } = await supabase.from('communities')
        .select('id, name, avatar_emoji, is_public')
        .ilike('name', `%${query}%`)
        .eq('is_public', true)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 400)
  }, [query])

  const shown = query.length >= 2 ? results : communitySuggestions

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Bli med i kretser
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Kretser er grupper du deler ting innen – nabolag, barnehage, idrettslag og mer
        </p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--terra-mid)' }}><IconSearch /></span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk etter en krets…"
          className="glass w-full pl-10 pr-4 py-3 outline-none"
          style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--terra-mid)' }}>…</span>}
      </div>

      {shown.length > 0 && (
        <div className="flex flex-col gap-2">
          {shown.map((c: any) => (
            <div key={c.id} className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.avatar_emoji ?? '🏘️'}</span>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{c.name}</p>
              </div>
              {sentJoinRequests.has(c.id)
                ? <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>✓ Sendt</span>
                : <button onClick={() => onJoin(c.id)} className="btn-glass text-sm" style={{ borderRadius: 10, padding: '6px 14px' }}>+ Bli med</button>}
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-center" style={{ color: 'var(--terra-mid)' }}>Ingen kretser funnet for «{query}»</p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'rgba(196,103,58,0.18)' }} />
        <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>eller opprett ny</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(196,103,58,0.18)' }} />
      </div>

      {creating ? (
        <div className="flex flex-col gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Navn på kretsen (f.eks. Nabolaget Grünerløkka)"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }}
            autoFocus />
          <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setCreating(false); setNewName('') } }}
            disabled={!newName.trim()} className="btn-primary"
            style={{ borderRadius: 12, padding: '10px', opacity: newName.trim() ? 1 : 0.45 }}>
            Opprett krets
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="btn-glass w-full" style={{ borderRadius: 14, padding: '12px' }}>
          + Opprett ny krets
        </button>
      )}

      <NavButtons onNext={onNext} nextLabel="Videre →" onSkip={onSkip} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function OnboardingContent() {
  const [step, setStep] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuggested, setUsernameSuggested] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)

  const [inviter, setInviter] = useState<any>(null)
  const [friendSuggestions, setFriendSuggestions] = useState<any[]>([])
  const [sentFriendRequests, setSentFriendRequests] = useState<Set<string>>(new Set())
  const [communitySuggestions, setCommunitySuggestions] = useState<any[]>([])
  const [sentJoinRequests, setSentJoinRequests] = useState<Set<string>>(new Set())

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set())
  const [wantedItems, setWantedItems] = useState<Set<string>>(new Set())

  // Guard: redirect already-onboarded users away
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      if (profile?.name) {
        router.push('/')
      }
    })()
  }, [router])

  useEffect(() => {
    if (!inviteCode) return
    ;(async () => {
      const supabase = createClient()
      const { data: p } = await supabase.from('profiles').select('id, name, username, avatar_url').eq('id', inviteCode).single()
      if (!p) return
      setInviter(p)
      const { data: fs } = await supabase.from('friendships').select('user_b').eq('user_a', inviteCode).limit(6)
      if (fs?.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', fs.map((f: any) => f.user_b))
        setFriendSuggestions(profiles ?? [])
      }
      const { data: coms } = await supabase.from('community_members').select('communities(id, name, avatar_emoji, is_public)').eq('user_id', inviteCode).limit(6)
      if (coms?.length) setCommunitySuggestions(coms.map((r: any) => r.communities).filter(Boolean))
    })()
  }, [inviteCode])

  const goNext = () => { track('onboarding_step_completed', { step }); setStep(s => s + 1) }
  const goSkip = () => { track('onboarding_step_skipped', { step }); step >= TOTAL_STEPS ? router.push('/') : setStep(s => s + 1) }

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
    const updates: Record<string, unknown> = { id: user.id, email: user.email, name }
    if (username) updates.username = username
    if (phone) updates.phone = phone
    if (address) updates.address = address
    if (avatar_url) updates.avatar_url = avatar_url
    await supabase.from('profiles').upsert(updates)
    track('onboarding_profile_saved')
    setSaving(false)
    goNext()
  }

  const sendFriendRequest = async (toId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('friend_requests').insert({ from_id: user.id, to_id: toId })
    await supabase.from('notifications').insert({ user_id: toId, type: 'friend_request', title: 'Ny venneforespørsel', body: `${name} vil være din venn på Village` })
    track('friend_request_sent', { to_id: toId, from_onboarding: true })
    setSentFriendRequests(prev => new Set(prev).add(toId))
  }

  const sendJoinRequest = async (communityId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('community_members').insert({ user_id: user.id, community_id: communityId, status: 'pending' })
    track('community_join_requested', { community_id: communityId, from_onboarding: true })
    setSentJoinRequests(prev => new Set(prev).add(communityId))
  }

  const createCommunity = async (communityName: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: community } = await supabase.from('communities').insert({ name: communityName, avatar_emoji: '🏘️', is_public: false }).select('id').single()
    if (community) {
      await supabase.from('community_members').insert({ user_id: user.id, community_id: community.id, status: 'active' })
      track('community_created', { from_onboarding: true })
      setSentJoinRequests(prev => new Set(prev).add(community.id))
    }
  }

  const toggleOwned = (item: string) => {
    setOwnedItems(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })
    setWantedItems(prev => { const n = new Set(prev); n.delete(item); return n })
  }
  const toggleWanted = (item: string) => {
    setWantedItems(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })
  }

  const saveAndFinish = async () => {
    track('onboarding_completed', { owned_count: ownedItems.size, wanted_count: wantedItems.size })
    router.push('/')
  }

  const activeCatalogue = selectedCategories.flatMap(cat => ITEM_CATALOGUE[cat] ?? [])

  // Steps 1, 5, 6, 7, 8 stay inside main component (no inputs that lose focus)
  const StepWelcome = (
    <div className="flex flex-col gap-6 flex-1">
      <div className="text-center pt-4 pb-2">
        <div className="text-5xl mb-4">🏡</div>
        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Velkommen til Village!
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
          Takk for at du er med og hjelper kretsen din med å utnytte eiendelene sine bedre – sammen!
        </p>
      </div>
      <div className="glass flex flex-col gap-5 p-5" style={{ borderRadius: 20 }}>
        {([
          { Icon: IconShare, title: 'Del ting når du ikke bruker dem', desc: 'Lån ut til venner og naboer – eller til andre' },
          { Icon: IconHand, title: 'Lån fra folk du stoler på', desc: 'Finn det du trenger i dine kretser – uten å kjøpe nytt' },
          { Icon: IconShield, title: 'Full kontroll alltid', desc: 'Du bestemmer hva, hvem og når – og godkjenner hvert utlån' },
        ] as { Icon: React.FC; title: string; desc: string }[]).map(({ Icon, title, desc }) => (
          <div key={title} className="flex gap-4 items-start">
            <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra)' }}><Icon /></span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{title}</p>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <NavButtons onNext={goNext} nextLabel="La oss sette opp profilen din →" hideSkip />
    </div>
  )

  const StepCategories = (
    <div className="flex flex-col gap-6 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva er du interessert i?</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Velg kategoriene som passer deg – vi bruker det til å foreslå ting du kan dele og låne</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
            className={selectedCategories.includes(cat) ? 'pill active' : 'pill'}>
            {cat}
          </button>
        ))}
      </div>
      <NavButtons onNext={goNext} nextLabel="Videre →" nextDisabled={selectedCategories.length === 0} onSkip={goSkip} skipLabel="Hopp over" />
    </div>
  )

  const StepShareItems = (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva kan du dele?</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Merk det du har og er åpen for å låne ut. Ingenting deles uten at du legger det ut i en krets, og hvert utlån krever din godkjenning.
        </p>
      </div>
      <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
        <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra)' }}><IconInfo /></span>
        <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Behovene varierer – marker bare det som faktisk er aktuelt for deg.</p>
      </div>
      {activeCatalogue.map(group => (
        <div key={group.label} className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--terra-mid)' }}>{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.items.slice(0, 3).map(item => (
              <ShareItemRow key={item} item={item} owned={ownedItems.has(item)} onToggle={() => toggleOwned(item)} />
            ))}
          </div>
        </div>
      ))}
      <NavButtons onNext={goNext} nextLabel={ownedItems.size > 0 ? `Videre (${ownedItems.size} valgt)` : 'Videre →'} onSkip={goSkip} skipLabel="Hopp over" />
    </div>
  )

  const wishGroups = activeCatalogue
    .map(g => ({ ...g, items: g.items.filter(i => !ownedItems.has(i)) }))
    .filter(g => g.items.length > 0)

  const StepWishlist = (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva ønsker du å låne?</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Hjertemerk ting du ikke har – du får varsel hvis noen i nettverket ditt begynner å låne det ut.
        </p>
      </div>
      <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
        <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra)' }}><IconBell /></span>
        <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Når du hjertemerker noe varsler vi deg automatisk når noen i dine kretser legger det ut.</p>
      </div>
      {wishGroups.map(group => (
        <div key={group.label} className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--terra-mid)' }}>{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.items.map(item => (
              <WishRow key={item} item={item} wished={wantedItems.has(item)} onToggle={() => toggleWanted(item)} />
            ))}
          </div>
        </div>
      ))}
      <NavButtons onNext={goNext} nextLabel={wantedItems.size > 0 ? `Videre (${wantedItems.size} ønsket)` : 'Videre →'} onSkip={goSkip} skipLabel="Hopp over" />
    </div>
  )

  const StepDone = (
    <div className="flex flex-col gap-6 flex-1 items-center text-center pt-6">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Du er klar!</h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--terra-mid)' }}>Profilen din er satt opp. Nå kan du begynne å dele og låne med vennene dine.</p>
      </div>
      <div className="glass w-full p-5 text-left" style={{ borderRadius: 20 }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--terra-dark)' }}>Hva skjer videre</p>
        {[
          { e: '📦', t: ownedItems.size > 0 ? `Du markerte ${ownedItems.size} ting – gå til «Legg ut» for å publisere dem i kretser` : 'Gå til «Legg ut» for å publisere ting i kretsene dine' },
          { e: '♥', t: wantedItems.size > 0 ? `${wantedItems.size} ønsker lagt til – du varsles når noen i nettverket ditt deler dem` : 'Hjertemerk ting du ønsker å låne under «Utforsk»' },
          { e: '🔍', t: 'Bla i «Utforsk» for å finne ting fra venner og kretser' },
        ].map(({ e, t }) => (
          <div key={e} className="flex gap-3 mb-2 last:mb-0">
            <span>{e}</span>
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{t}</p>
          </div>
        ))}
      </div>
      <NavButtons onNext={saveAndFinish} nextLabel="Kom i gang 🏡" hideSkip />
    </div>
  )

  const steps: Record<number, React.ReactNode> = {
    1: StepWelcome,
    2: <ProfileStep
          name={name} setName={setName}
          username={username} setUsername={setUsername}
          usernameError={usernameError} setUsernameError={setUsernameError}
          usernameSuggested={usernameSuggested} setUsernameSuggested={setUsernameSuggested}
          phone={phone} setPhone={setPhone}
          address={address} setAddress={setAddress}
          avatarPreview={avatarPreview} setAvatarFile={setAvatarFile} setAvatarPreview={setAvatarPreview}
          saving={saving} onSave={saveProfile} onSkip={goSkip}
        />,
    3: <FriendsStep inviter={inviter} friendSuggestions={friendSuggestions}
          sentFriendRequests={sentFriendRequests} onSendRequest={sendFriendRequest}
          onNext={goNext} onSkip={goSkip} />,
    4: <CommunitiesStep communitySuggestions={communitySuggestions} sentJoinRequests={sentJoinRequests}
          onJoin={sendJoinRequest} onCreate={createCommunity} onNext={goNext} onSkip={goSkip} />,
    5: StepCategories,
    6: StepShareItems,
    7: StepWishlist,
    8: StepDone,
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-24 min-h-screen flex flex-col">
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i < step ? 'var(--terra)' : 'rgba(196,103,58,0.15)' }} />
        ))}
      </div>
      {steps[step]}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 pt-10 pb-24 min-h-screen flex flex-col" />}>
      <OnboardingContent />
    </Suspense>
  )
}
