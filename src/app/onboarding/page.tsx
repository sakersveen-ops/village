'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const INTERESTS = ['Barn', 'Bøker', 'Kjoler', 'Verktøy', 'Sport', 'Musikk', 'Matlaging', 'Hage', 'Kunst', 'Reise']

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const toggleInterest = (i: string) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const checkUsername = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(clean)
    if (clean.length < 3) { setUsernameError('Minst 3 tegn'); return }
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).single()
    setUsernameError(data ? 'Brukernavnet er tatt' : '')
  }

  const finish = async () => {
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
      interests,
      avatar_url: avatar_url || null,
    })

    router.push('/')
  }

  const skip = () => router.push('/')

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-24 min-h-screen flex flex-col">
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#C4673A]' : 'bg-[#E8DDD0]'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">Velkommen til Village! 👋</h1>
            <p className="text-sm text-[#9C7B65] mt-1">La oss sette opp profilen din</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#E8DDD0] flex items-center justify-center overflow-hidden">
                {avatarPreview
                  ? <img src={avatarPreview} className="w-full h-full object-cover" />
                  : <span className="text-4xl">📷</span>}
              </div>
              <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            </label>
            <p className="text-xs text-[#9C7B65]">Trykk for å legge til profilbilde</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Hva heter du?"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Brukernavn</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C7B65] text-sm">@</span>
                <input
                  value={username}
                  onChange={e => checkUsername(e.target.value)}
                  placeholder="ditt_brukernavn"
                  className={`w-full bg-white border rounded-xl pl-8 pr-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] ${usernameError ? 'border-red-300' : 'border-[#E8DDD0]'}`}
                />
              </div>
              {usernameError && <p className="text-xs text-red-400">{usernameError}</p>}
              {username && !usernameError && username.length >= 3 && (
                <p className="text-xs text-[#4A7C59]">✓ Ledig</p>
              )}
              <p className="text-xs text-[#9C7B65]">Kun bokstaver, tall, punktum og understrek</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Telefon</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+47 000 00 000"
                type="tel"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">Hvor bor du?</h1>
            <p className="text-sm text-[#9C7B65] mt-1">Brukes til å finne ting nær deg</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Adresse</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Gate, postnummer, by"
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">Hva interesserer deg?</h1>
            <p className="text-sm text-[#9C7B65] mt-1">Vi tilpasser feeden din basert på dette</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => (
              <button key={interest} onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${interests.includes(interest) ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'}`}>
                {interest}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button onClick={skip} className="text-sm text-[#9C7B65] px-4 py-3">
          {step === 3 ? 'Hopp over' : 'Gjør senere'}
        </button>
        <button
          onClick={step === 3 ? finish : () => setStep(s => s + 1)}
          disabled={(step === 1 && !name) || saving || (step === 1 && !!usernameError)}
          className="flex-1 bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Lagrer…' : step === 3 ? 'Kom i gang 🎉' : 'Neste →'}
        </button>
      </div>
    </div>
  )
}