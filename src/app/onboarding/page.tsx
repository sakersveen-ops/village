// Path of this file: src/app/onboarding/page.tsx
'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { track } from '@/lib/track'
import FinnImporter from '@/components/FinnImporter'

// ─── Icons ────────────────────────────────────────────────────────────────────
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
const IconChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

// ─── Item catalogue (full + equal list for share and wishlist) ────────────────
const ITEM_CATALOGUE: Record<string, { label: string; items: string[] }[]> = {
  Barn: [
    { label: 'Sove', items: ['Bedside crib', 'Babynest', 'Reiseseng', 'Junior-dyne', 'Sengehest til juniorseng', 'Vippestol', 'Lydmaskin/nattlampe'] },
    { label: 'Reise', items: ['Babybilstol (gruppe 0/1)', 'Bilstol gruppe 2/3', 'Sykkelvogn', 'Trille', 'Bæresjal/sele', 'Bæremeis', 'Vognpose (vår/vinter)'] },
    { label: 'Spise', items: ['Babysete til høystol', 'Matprosessor/blender', 'Brystpumpe', 'Sterilisator', 'Flaskevarmer'] },
    { label: 'Leke & aktivitet', items: ['Babygym', 'Aktivitetstablett/-bord', 'Brettspill', 'Trehjulsykkel', 'Balansesykkel', 'Sykkel med pedaler', 'Sparkesykkel', 'Sandkassesett', 'Skiutstyr (barn)', 'Skøyteutstyr (barn)'] },
    { label: 'Bade & stelle', items: ['Badebalje med nyfødtstøtte', 'Babybadestol', 'Stellebord'] },
    { label: 'Ha på', items: ['Omslagsbodyer (str. 50–68)', 'Tynne ullsett (str. 50–68)', 'Parkdress til krabbing', 'Regntøy og skallbekledning', 'Vinterdress', 'Store ytterklær', 'Pensko til spesielle anledninger', 'Første par med sko'] },
    { label: 'Skole & barnehage', items: ['Barnehagesekk', 'Termos', 'Sitteunderlag', 'Tegnesaker og hobbyutstyr'] },
  ],
  Verktøy: [{ label: 'Hage & bygg', items: ['Drill', 'Sirkelsag', 'Sliper', 'Høytrykkspyler', 'Gressklipper', 'Hagesaks', 'Trillebår', 'Stige', 'Hakke/spade', 'Murpistol'] }],
  Sport: [{ label: 'Friluft & trening', items: ['Ski (voksen)', 'Skistøvler', 'Skistaver', 'Sykkel', 'Telt', 'Sovepose', 'Ryggsekk', 'Kajakk', 'Padleåre', 'Rulleskøyter', 'Isøks', 'Klatresele'] }],
  Bøker: [{ label: 'Bøker & spill', items: ['Brettspill', 'Puslespill', 'Fagbøker', 'Romaner', 'Kokebøker', 'Barnebøker', 'Tegneserier', 'Lydbøker'] }],
  Matlaging: [{ label: 'Kjøkken', items: ['Kjøkkenmaskin', 'Is-maskin', 'Sous vide', 'Vaffelsjern', 'Iskremmaskin', 'Espressomaskin', 'Deigkrok', 'Mandolin/ostehøvel', 'Grillspyd/-sett'] }],
  Musikk: [{ label: 'Instrumenter & utstyr', items: ['Gitar', 'Piano/keyboard', 'Ukulele', 'Trommer/pad', 'Mikrofon', 'Høyttaler', 'Forsterker', 'Stativ', 'Kabel/adaptere'] }],
  Hage: [{ label: 'Hage & uteplass', items: ['Hagesett', 'Paraply/paviljong', 'Bord og stoler (uteplass)', 'Hengekøye', 'Kompostbeholder', 'Vatningsanlegg', 'Plantekasser', 'Markduk', 'Utendørslampe'] }],
}

const ALL_CATEGORIES = Object.keys(ITEM_CATALOGUE)
const TOTAL_STEPS = 7 // 1 Welcome · 2 Profile · 3 Friends · 4 Categories · 5 Share · 6 Wishlist · 7 Finn

// ─── Wish confirmation modal ──────────────────────────────────────────────────
function WishConfirmModal({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-4 p-6" style={{ borderRadius: 24, zIndex: 61 }}>
        <div className="text-center">
          <span className="text-4xl">♥</span>
          <h2 className="font-display text-xl font-bold mt-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            {count > 0 ? `${count} ønsker lagt til` : 'Ønskelisten din'}
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            Ønskene dine er synlige for vennene dine på profilen din. De vil se hva du ønsker å låne, og du får varsel hvis noen legger det ut.
          </p>
        </div>
        <button onClick={onConfirm} className="btn-primary w-full"
          style={{ borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 600 }}>
          Forstått, gå videre →
        </button>
      </div>
    </div>
  )
}

// ─── Shared NavButtons ────────────────────────────────────────────────────────
type NavButtonsProps = {
  onNext: () => void
  onBack?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  skipLabel?: string
  hideSkip?: boolean
  onSkip?: () => void
}
function NavButtons({ onNext, onBack, nextLabel = 'Videre →', nextDisabled = false, skipLabel = 'Gjør senere', hideSkip = false, onSkip }: NavButtonsProps) {
  return (
    <div className="flex flex-col gap-2 mt-8">
      <div className="flex gap-3">
        {onBack && (
          <button onClick={onBack} className="btn-glass flex items-center justify-center shrink-0"
            style={{ borderRadius: 14, padding: '14px 16px' }} aria-label="Tilbake">
            <IconChevronLeft />
          </button>
        )}
        <button onClick={onNext} disabled={nextDisabled} className="btn-primary flex-1"
          style={{ borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 600, opacity: nextDisabled ? 0.45 : 1 }}>
          {nextLabel}
        </button>
      </div>
      {!hideSkip && (
        <button onClick={onSkip} className="text-sm py-2 text-center" style={{ color: 'var(--terra-mid)' }}>
          {skipLabel}
        </button>
      )}
    </div>
  )
}

// ─── ProfileRow ───────────────────────────────────────────────────────────────
function ProfileRow({ profile, sent, onAdd }: { profile: any; sent: boolean; onAdd: () => void }) {
  return (
    <div className="glass flex items-center justify-between px-4 py-3" style={{ borderRadius: 14 }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg shrink-0"
          style={{ background: 'rgba(46,98,113,0.15)' }}>
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

// ─── Step 2: Profile (hoisted to avoid focus loss) ────────────────────────────
type ProfileStepProps = {
  name: string; setName: (v: string) => void
  username: string; setUsername: (v: string) => void
  usernameError: string; setUsernameError: (v: string) => void
  usernameSuggested: boolean; setUsernameSuggested: (v: boolean) => void
  phone: string; setPhone: (v: string) => void
  addressStreet: string; setAddressStreet: (v: string) => void
  addressZip: string; setAddressZip: (v: string) => void
  addressCity: string; setAddressCity: (v: string) => void
  avatarPreview: string; setAvatarFile: (f: File | null) => void; setAvatarPreview: (s: string) => void
  saving: boolean; onSave: () => void; onBack: () => void; onSkip: () => void
}
function ProfileStep({ name, setName, username, setUsername, usernameError, setUsernameError,
  usernameSuggested, setUsernameSuggested, phone, setPhone,
  addressStreet, setAddressStreet, addressZip, setAddressZip, addressCity, setAddressCity,
  avatarPreview, setAvatarFile, setAvatarPreview, saving, onSave, onBack, onSkip }: ProfileStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const validateUsername = useCallback(async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(clean)
    if (clean.length < 3) { setUsernameError('Minst 3 tegn'); return }
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle()
    setUsernameError(data ? 'Brukernavnet er tatt' : '')
  }, [setUsername, setUsernameError])

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
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hvem er du?</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Profilen din er kun synlig for venner og kretser</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <label className="cursor-pointer">
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(46,98,113,0.1)', border: '2px dashed rgba(46,98,113,0.35)' }}>
            {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" /> : <span className="text-4xl">📷</span>}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </label>
        <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Trykk for å legge til profilbilde</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Navn *</label>
          <input value={name} onChange={e => { setName(e.target.value); if (!username) setUsernameSuggested(true) }}
            placeholder="Hva heter du?" className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Brukernavn</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--terra-mid)' }}>@</span>
            <input value={username} onChange={e => { setUsernameSuggested(false); validateUsername(e.target.value) }}
              placeholder="ditt_brukernavn" className="glass w-full pl-8 pr-4 py-3 outline-none"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15, borderColor: usernameError ? 'rgba(220,38,38,0.4)' : undefined }} />
          </div>
          {usernameError
            ? <p className="text-xs" style={{ color: '#ef4444' }}>{usernameError}</p>
            : username.length >= 3 ? <p className="text-xs" style={{ color: 'var(--terra-green)' }}>✓ Ledig</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Telefon</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+47 000 00 000" type="tel"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Gateadresse</label>
          <input value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Gatenavn 12"
            className="glass px-4 py-3 outline-none w-full"
            style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1" style={{ width: '35%' }}>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Postnummer</label>
            <input value={addressZip} onChange={e => setAddressZip(e.target.value)} placeholder="0000"
              inputMode="numeric" maxLength={4}
              className="glass px-4 py-3 outline-none w-full"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Sted</label>
            <input value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="Oslo"
              className="glass px-4 py-3 outline-none w-full"
              style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 15 }} />
          </div>
        </div>
      </div>
      <NavButtons onNext={onSave} onBack={onBack} nextLabel={saving ? 'Lagrer…' : 'Videre →'}
        nextDisabled={!name || saving || !!usernameError} onSkip={onSkip} />
    </div>
  )
}

// ─── Step 3: Friends (hoisted) ────────────────────────────────────────────────
type FriendsStepProps = {
  inviter: any; friendSuggestions: any[]; currentUserId: string
  sentFriendRequests: Set<string>; onSendRequest: (id: string) => void
  onNext: () => void; onBack: () => void; onSkip: () => void
}
function FriendsStep({ inviter, friendSuggestions, currentUserId, sentFriendRequests, onSendRequest, onNext, onBack, onSkip }: FriendsStepProps) {
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
        .neq('id', currentUserId)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 400)
  }, [query, currentUserId])

  const shown = (query.length >= 2 ? results : friendSuggestions)
    .filter((p: any) => p.id !== currentUserId)

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Legg til venner</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Venner ser det du deler og kan be om å låne</p>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--terra-mid)' }}><IconSearch /></span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk på navn eller @brukernavn"
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
            {shown.filter((p: any) => p.id !== inviter?.id).map((p: any) => (
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
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Søk etter venner ovenfor, eller del invitasjonslenken din etter at du er i gang.</p>
        </div>
      )}
      <NavButtons onNext={onNext} onBack={onBack} nextLabel="Videre →" onSkip={onSkip} />
    </div>
  )
}

// ─── Finn onboarding step ─────────────────────────────────────────────────────
function FinnOnboardingStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Leier du ut noe på Finn?
        </h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
          Vi ELSKER Finn! Men ikke til utleie. Har du ting på Finn som du også kunne tenkt deg å dele med venner og naboer?
        </p>
      </div>

      {/* Yes / No choice */}
      {answer === null && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setAnswer('yes')}
            className="glass flex items-center gap-4 px-5 py-4 text-left"
            style={{ borderRadius: 16 }}
          >
            <span className="text-2xl">👍</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>Ja, jeg har ting på Finn</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Importer annonsene dine automatisk</p>
            </div>
          </button>
          <button
            onClick={() => { setAnswer('no'); onNext() }}
            className="glass flex items-center gap-4 px-5 py-4 text-left"
            style={{ borderRadius: 16 }}
          >
            <span className="text-2xl">👎</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>Nei, ikke akkurat nå</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Hopp videre – du kan legge ut ting manuelt senere</p>
            </div>
          </button>
        </div>
      )}

      {/* Show importer only if they said yes */}
      {answer === 'yes' && (
        <>
          <FinnImporter
            communityId={undefined}
            onImported={(count) => {
              track('onboarding_finn_imported', { count })
            }}
          />
          <NavButtons
            onNext={onNext}
            onBack={() => setAnswer(null)}
            nextLabel="Kom i gang 🏡"
            onSkip={onNext}
            skipLabel="Hopp over, kom i gang →"
          />
        </>
      )}

      {answer === null && (
        <NavButtons
          onNext={onNext}
          onBack={onBack}
          nextLabel="Kom i gang 🏡"
          hideSkip
        />
      )}
    </div>
  )
}

// ─── Step 5b: Add-item loop ───────────────────────────────────────────────────
type AddItemLoopProps = {
  items: string[]
  currentIndex: number
  onNext: () => void
  onSkipAll: () => void
}
function AddItemLoopStep({ items, currentIndex, onNext, onSkipAll }: AddItemLoopProps) {
  const supabase = createClient()
  const item = items[currentIndex]
  const total = items.length
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form when item changes
  useEffect(() => {
    setDescription('')
    setImageFile(null)
    setImagePreview('')
  }, [currentIndex])

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { onNext(); return }
      let image_url = ''
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `items/${user.id}_${Date.now()}.${ext}`
        await supabase.storage.from('item-images').upload(path, imageFile, { upsert: true })
        const { data } = supabase.storage.from('item-images').getPublicUrl(path)
        image_url = data.publicUrl
      }
      await supabase.from('items').insert({
        owner_id: user.id,
        name: item,
        description: description || null,
        image_url: image_url || null,
        available: true,
      })
      track('onboarding_item_registered', { item_name: item })
    } catch {
      // continue even on error
    }
    setSaving(false)
    onNext()
  }

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Progress within loop */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all"
              style={{ width: 24, background: i <= currentIndex ? 'var(--terra)' : 'rgba(46,98,113,0.15)' }} />
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>{currentIndex + 1} av {total}</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--terra-mid)' }}>
          Legg ut gjenstand
        </p>
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          {item}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Legg gjerne til et bilde og en kort beskrivelse – da er det lettere for venner å se hva du tilbyr.
        </p>
      </div>

      {/* Image upload */}
      <label className="cursor-pointer">
        <div className="w-full aspect-video rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: 'rgba(46,98,113,0.08)', border: '2px dashed rgba(46,98,113,0.25)' }}>
          {imagePreview
            ? <img src={imagePreview} className="w-full h-full object-cover" alt="" />
            : (
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <span className="text-3xl">📷</span>
                <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Trykk for å legge til bilde</p>
              </div>
            )}
        </div>
        <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </label>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
          Beskrivelse <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(valgfritt)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={`Eks: "Brukes 1–2 ganger, god stand. Kan hentes i Frogner."`}
          rows={3}
          className="glass px-4 py-3 outline-none w-full resize-none"
          style={{ borderRadius: 14, color: 'var(--terra-dark)', fontSize: 14 }}
        />
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full"
          style={{ borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Lagrer…' : currentIndex < total - 1 ? `Lagre og gå til neste →` : 'Lagre og fortsett →'}
        </button>
        <button
          onClick={onNext}
          className="text-sm py-2 text-center"
          style={{ color: 'var(--terra-mid)' }}>
          Hopp over denne
        </button>
        {total > 2 && currentIndex < total - 1 && (
          <button
            onClick={onSkipAll}
            className="text-sm py-1 text-center"
            style={{ color: 'var(--terra-mid)', opacity: 0.7 }}>
            Hopp over alle gjenværende
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function OnboardingContent() {
  const [step, setStep] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  const [currentUserId, setCurrentUserId] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuggested, setUsernameSuggested] = useState(false)
  const [phone, setPhone] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressZip, setAddressZip] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)

  const [inviter, setInviter] = useState<any>(null)
  const [friendSuggestions, setFriendSuggestions] = useState<any[]>([])
  const [sentFriendRequests, setSentFriendRequests] = useState<Set<string>>(new Set())

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set())
  const [wantedItems, setWantedItems] = useState<Set<string>>(new Set())

  // Add-item loop: after step 5, loop through selected items for proper registration
  const [addItemQueue, setAddItemQueue] = useState<string[]>([])
  const [addItemIndex, setAddItemIndex] = useState(0)
  const [addItemPhase, setAddItemPhase] = useState(false)

  const [showWishModal, setShowWishModal] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)

  // Guard: redirect if already onboarded
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      // Guard: only redirect if user has explicitly finished onboarding before.
      // Checking profile.name is unreliable — Supabase may auto-populate it from auth metadata.
      const doneKey = 'village_onboarding_done_' + user.id
      if (localStorage.getItem(doneKey)) { router.push('/'); return }
    })()
  }, [router])

  // Load inviter + their friends
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
    })()
  }, [inviteCode])

  const goNext = () => { track('onboarding_step_completed', { step }); setStep(s => s + 1) }
  const goBack = () => setStep(s => Math.max(1, s - 1))
  const goSkip = () => {
    track('onboarding_step_skipped', { step })
    // Always mark onboarding done when skipping — user may skip at any point
    if (currentUserId) localStorage.setItem('village_onboarding_done_' + currentUserId, '1')
    if (step >= TOTAL_STEPS) {
      router.push('/')
    } else {
      setStep(s => s + 1)
    }
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
    const updates: Record<string, unknown> = { id: user.id, email: user.email, name }
    if (username) updates.username = username
    if (phone) updates.phone = phone
    if (addressStreet) updates.address_street = addressStreet
    if (addressZip) updates.address_zip = addressZip
    if (addressCity) updates.address_city = addressCity
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

  const toggleOwned = (item: string) => {
    setOwnedItems(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })
    setWantedItems(prev => { const n = new Set(prev); n.delete(item); return n })
  }
  const toggleWanted = (item: string) => {
    setWantedItems(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })
  }

  const finishWishlist = () => setShowWishModal(true)
  const confirmWishModal = () => {
    setShowWishModal(false)
    track('onboarding_wishlist_confirmed', { count: wantedItems.size })
    goNext()
  }

  const saveAndFinish = async () => {
    track('onboarding_completed', { owned_count: ownedItems.size, wanted_count: wantedItems.size })
    if (ownedItems.size > 0) {
      localStorage.setItem('village_owned_items', JSON.stringify([...ownedItems]))
    }
    if (currentUserId) localStorage.setItem('village_onboarding_done_' + currentUserId, '1')
    setShowCongrats(true)
    // Redirect after splash animation
    setTimeout(() => router.push('/'), 2800)
  }

  const activeCatalogue = selectedCategories.flatMap(cat => ITEM_CATALOGUE[cat] ?? [])
  const wishGroups = activeCatalogue.map(g => ({ ...g, items: g.items.filter(i => !ownedItems.has(i)) })).filter(g => g.items.length > 0)


  // ── Step map ────────────────────────────────────────────────────────────────
  const steps: Record<number, React.ReactNode> = {
    1: (
      <div className="flex flex-col gap-6 flex-1">
        <div className="text-center pt-4 pb-2">
          <div className="text-5xl mb-4">🏡</div>
          <h1 className="font-display text-3xl font-bold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.03em' }}>Velkommen til Village!</h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            Takk for at du er med og hjelper omgangskretsene dine med å utnytte eiendelene sine bedre – sammen.
          </p>
        </div>
        <div className="glass flex flex-col gap-4 p-5" style={{ borderRadius: 20 }}>
          {[
            { icon: <IconShare />, title: 'Del ting du ikke bruker', desc: 'Lån ut til venner – ingen deling skjer uten din godkjenning' },
            { icon: <IconHand />, title: 'Lån fra folk du stoler på', desc: 'Finn det du trenger i dine kretser – uten å kjøpe nytt' },
            { icon: <IconShield />, title: 'Full kontroll alltid', desc: 'Du bestemmer hva, hvem og når – og godkjenner hvert utlån' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4 items-start">
              <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra)' }}>{icon}</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{title}</p>
                <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <NavButtons onNext={goNext} nextLabel="La oss sette opp profilen din →" hideSkip />
      </div>
    ),
    2: <ProfileStep name={name} setName={setName} username={username} setUsername={setUsername}
          usernameError={usernameError} setUsernameError={setUsernameError}
          usernameSuggested={usernameSuggested} setUsernameSuggested={setUsernameSuggested}
          phone={phone} setPhone={setPhone}
          addressStreet={addressStreet} setAddressStreet={setAddressStreet}
          addressZip={addressZip} setAddressZip={setAddressZip}
          addressCity={addressCity} setAddressCity={setAddressCity}
          avatarPreview={avatarPreview} setAvatarFile={setAvatarFile} setAvatarPreview={setAvatarPreview}
          saving={saving} onSave={saveProfile} onBack={goBack} onSkip={goSkip} />,
    3: <FriendsStep inviter={inviter} friendSuggestions={friendSuggestions} currentUserId={currentUserId}
          sentFriendRequests={sentFriendRequests} onSendRequest={sendFriendRequest}
          onNext={goNext} onBack={goBack} onSkip={goSkip} />,
    4: (
      <div className="flex flex-col gap-6 flex-1">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva er du interessert i?</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>Velg kategoriene som passer deg – vi bruker det til å foreslå ting å dele og låne</p>
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
        <NavButtons onNext={goNext} onBack={goBack} nextLabel="Videre →"
          nextDisabled={selectedCategories.length === 0} onSkip={goSkip} skipLabel="Hopp over" />
      </div>
    ),
    5: (
      <div className="flex flex-col gap-5 flex-1">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva kan du dele?</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
            For å komme i gang har vi listet gjenstander som typisk etterspørres på Village. Velg det du har – du kan gjøre dem tilgjengelige for vennene dine nå eller legge til detaljer senere.
          </p>
        </div>
        <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
          <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra)' }}><IconInfo /></span>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Ingenting deles uten at du legger det ut i en krets, og hvert utlån krever din godkjenning. Behovene varierer fra person til person – marker bare det som er aktuelt.
          </p>
        </div>
        {activeCatalogue.map(group => (
          <div key={group.label} className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--terra-mid)' }}>{group.label}</p>
            <div className="flex flex-col gap-2">
              {group.items.map(item => (
                <div key={item} className="glass flex items-center justify-between px-4 py-2.5" style={{ borderRadius: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
                  <button onClick={() => toggleOwned(item)} className="text-xs px-3 py-1 rounded-full border transition-colors shrink-0"
                    style={ownedItems.has(item)
                      ? { background: 'var(--terra)', borderColor: 'transparent', color: '#fff' }
                      : { borderColor: 'rgba(46,98,113,0.3)', color: 'var(--terra)' }}>
                    {ownedItems.has(item) ? '✓ Ja' : 'Ja'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <NavButtons onNext={() => {
          if (ownedItems.size > 0) {
            setAddItemQueue([...ownedItems])
            setAddItemIndex(0)
            setAddItemPhase(true)
          } else {
            goNext()
          }
        }} onBack={goBack}
          nextLabel={ownedItems.size > 0 ? `Registrer ${ownedItems.size} gjenstand${ownedItems.size > 1 ? 'er' : ''} →` : 'Videre →'}
          onSkip={goSkip} skipLabel="Hopp over" />
      </div>
    ),
    6: (
      <div className="flex flex-col gap-5 flex-1">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>Hva ønsker du å låne?</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
            For å komme i gang har vi listet ting som typisk lånes ut på Village. Hjertemerk det du ikke har – du får varsel hvis noen i nettverket ditt begynner å tilby det.
          </p>
        </div>
        <div className="glass px-4 py-3 flex items-start gap-3" style={{ borderRadius: 14 }}>
          <span className="shrink-0 mt-0.5" style={{ color: 'var(--terra-green)' }}><IconBell /></span>
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Ønskene dine legges til på profilen din og er synlige for vennene dine.
          </p>
        </div>
        {wishGroups.map(group => (
          <div key={group.label} className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--terra-mid)' }}>{group.label}</p>
            <div className="flex flex-col gap-2">
              {group.items.map(item => (
                <div key={item} className="glass flex items-center justify-between px-4 py-2.5" style={{ borderRadius: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
                  <button onClick={() => toggleWanted(item)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors shrink-0"
                    style={wantedItems.has(item)
                      ? { background: 'var(--terra-green)', borderColor: 'transparent', color: '#fff' }
                      : { borderColor: 'rgba(74,124,89,0.4)', color: 'var(--terra-green)' }}>
                    {wantedItems.has(item) ? <IconHeartFilled /> : <IconHeart />}
                    {wantedItems.has(item) ? 'Ønsket' : 'Ønsker'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <NavButtons onNext={finishWishlist} onBack={goBack}
          nextLabel={wantedItems.size > 0 ? `Videre (${wantedItems.size} ønsket)` : 'Videre →'}
          onSkip={goSkip} skipLabel="Hopp over" />
      </div>
    ),
    7: (
      <FinnOnboardingStep
        onNext={saveAndFinish}
        onBack={goBack}
      />
    ),
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-24 min-h-screen flex flex-col">
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i < step ? 'var(--terra)' : 'rgba(46,98,113,0.15)' }} />
        ))}
      </div>
      {addItemPhase ? (
        <AddItemLoopStep
          items={addItemQueue}
          currentIndex={addItemIndex}
          onNext={() => {
            if (addItemIndex < addItemQueue.length - 1) {
              setAddItemIndex(i => i + 1)
            } else {
              setAddItemPhase(false)
              goNext()
            }
          }}
          onSkipAll={() => { setAddItemPhase(false); goNext() }}
        />
      ) : steps[step]}
      {showWishModal && <WishConfirmModal count={wantedItems.size} onConfirm={confirmWishModal} />}

      {/* Gratulerer-splash */}
      {showCongrats && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center"
          style={{ background: 'linear-gradient(160deg, #FFF5EE 0%, #F5E6D8 50%, #EDD5C0 100%)' }}
        >
          <div className="text-7xl mb-6" style={{ animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both' }}>
            🏡
          </div>
          <h1 className="font-display text-3xl font-bold mb-3"
            style={{ color: 'var(--terra-dark)', letterSpacing: '-0.03em', animation: 'fadeUp 0.5s 0.2s both' }}>
            Velkommen til Village!
          </h1>
          <p className="text-base leading-relaxed mb-8"
            style={{ color: 'var(--terra-mid)', maxWidth: 300, animation: 'fadeUp 0.5s 0.35s both' }}>
            Profilen din er klar. Nå kan du dele og låne med folk du stoler på.
          </p>
          <div className="flex gap-2" style={{ animation: 'fadeUp 0.5s 0.5s both' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-full"
                style={{
                  width: 8, height: 8,
                  background: 'var(--terra)',
                  opacity: 0.3,
                  animation: `pulse 1.2s ${i * 0.2}s infinite`,
                }} />
            ))}
          </div>
          <style>{`
            @keyframes popIn {
              from { transform: scale(0.5); opacity: 0; }
              to   { transform: scale(1);   opacity: 1; }
            }
            @keyframes fadeUp {
              from { transform: translateY(16px); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50%       { opacity: 1;   transform: scale(1.3); }
            }
          `}</style>
        </div>
      )}
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
