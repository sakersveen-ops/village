'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const INTERESTS = ['Barn', 'Bøker', 'Kjoler', 'Verktøy', 'Sport', 'Musikk', 'Matlaging', 'Hage', 'Kunst', 'Reise']
const LANGUAGES = [{ id: 'no', label: 'Norsk' }, { id: 'en', label: 'English' }]

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data || {})
      setLoading(false)
    }
    load()
  }, [])

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

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <h1 className="text-xl font-bold text-[#2C1A0E]">Innstillinger</h1>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">

        {/* Profil */}
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

        {/* Interesser */}
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

        {/* Språk */}
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

        {/* Personvern */}
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

        {/* Varsler */}
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

        {/* Endre passord */}
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

        {/* Lagre-knapp */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {saved ? '✓ Lagret!' : saving ? 'Lagrer…' : 'Lagre endringer'}
        </button>

        {/* Slett konto */}
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