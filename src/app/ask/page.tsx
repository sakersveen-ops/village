'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { track, Events } from '@/lib/track'

const CATEGORIES = [
  { id: 'barn',     label: 'Barn',    emoji: '🧸' },
  { id: 'kjole',    label: 'Kjoler',  emoji: '👗' },
  { id: 'verktøy',  label: 'Verktøy', emoji: '🔧' },
  { id: 'bok',      label: 'Bøker',   emoji: '📚' },
  { id: 'annet',    label: 'Annet',   emoji: '📦' },
]

function AskPageInnerComponent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser]         = useState<any>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [itemName, setItemName] = useState(searchParams.get('name') ?? '')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [audience, setAudience] = useState<'friends' | 'friends_of_friends'>('friends')
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
      setProfile(prof)
    }
    init()
  }, [])

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!itemName.trim()) { setError('Skriv inn hva du leter etter'); return }
    if (!category)        { setError('Velg en kategori'); return }
    setError('')
    setSaving(true)

    const supabase = createClient()

    let image_url: string | null = null
    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `requests/${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('item-images').upload(path, imageFile)
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      image_url = data.publicUrl
    }

    const { data: req, error: insertError } = await supabase
      .from('item_requests')
      .insert({ user_id: user.id, item_name: itemName.trim(), category, image_url, audience })
      .select()
      .single()

    if (insertError || !req) {
      console.error('Ask error:', insertError)
      setError('Noe gikk galt. Prøv igjen.')
      setSaving(false)
      return
    }

    const { data: friendships } = await supabase
      .from('friendships').select('user_b').eq('user_a', user.id)
    const friendIds = (friendships || []).map((f: any) => f.user_b)

    let recipientIds = [...friendIds]

    if (audience === 'friends_of_friends') {
      const { data: fof } = await supabase
        .from('friendships').select('user_b').in('user_a', friendIds)
      const fofIds = (fof || []).map((f: any) => f.user_b)
        .filter(id => id !== user.id && !friendIds.includes(id))
      recipientIds = [...recipientIds, ...fofIds]
    }

    const uniqueRecipients = [...new Set(recipientIds)]
    const { data: relevantOwners } = await supabase
      .from('items').select('owner_id')
      .in('owner_id', uniqueRecipients).eq('category', category)
    const relevantIds = [...new Set((relevantOwners || []).map((i: any) => i.owner_id))]

    const senderName = profile?.name || user?.email?.split('@')[0] || 'Noen'
    const catLabel   = CATEGORIES.find(c => c.id === category)?.label ?? category

    if (relevantIds.length > 0) {
      await supabase.from('notifications').insert(
        relevantIds.map((uid: string) => ({
          user_id: uid,
          type:    'item_request',
          title:   `${senderName} leter etter noe`,
          body:    `Har du en ${itemName} å låne ut? (${catLabel})`,
        }))
      )
    }

    track(Events.ITEM_REQUEST_POSTED, { category, audience, notified: relevantIds.length })
    router.push('/?requested=1')
  }

  return (
    <div className="max-w-lg mx-auto">
      <header className="page-header glass">
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(196,103,58,0.10)', border: '1px solid rgba(196,103,58,0.15)', flexShrink: 0, cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark,#2C1A0E)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="page-header-title font-display">Spør kretsen</h1>
        <div style={{ width: 36 }} />
      </header>

      <div className="px-4 pt-5 flex flex-col gap-5">

        <div className="glass rounded-[16px] px-4 py-3">
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            Fortell kretsen din hva du trenger å låne — vi varsler de som har det.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            Hva leter du etter? *
          </label>
          <input
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            placeholder="F.eks. drill, kjole, barnevogn…"
            maxLength={80}
            className="glass outline-none"
            style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            Kategori *
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`pill ${category === cat.id ? 'active' : ''} text-sm`}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            Bilde (valgfritt)
          </label>
          <label className="cursor-pointer block">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} className="w-full h-40 object-cover rounded-[16px]" />
                <button
                  onClick={e => { e.preventDefault(); setImageFile(null); setImagePreview('') }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm"
                  style={{ background: 'rgba(44,26,14,0.5)' }}
                >✕</button>
              </div>
            ) : (
              <div className="glass rounded-[16px] flex flex-col items-center justify-center gap-2 border-dashed"
                style={{ height: 100 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--terra-mid)' }}>
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Legg til bilde</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            Hvem skal spørres?
          </label>
          <div className="glass rounded-[16px] p-1 flex gap-1">
            <button onClick={() => setAudience('friends')} className="flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-all"
              style={{ background: audience === 'friends' ? 'white' : 'transparent', color: audience === 'friends' ? 'var(--terra-dark)' : 'var(--terra-mid)', boxShadow: audience === 'friends' ? '0 1px 8px rgba(44,26,14,0.08)' : 'none' }}>
              👥 Venner
            </button>
            <button onClick={() => setAudience('friends_of_friends')} className="flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-all"
              style={{ background: audience === 'friends_of_friends' ? 'white' : 'transparent', color: audience === 'friends_of_friends' ? 'var(--terra-dark)' : 'var(--terra-mid)', boxShadow: audience === 'friends_of_friends' ? '0 1px 8px rgba(44,26,14,0.08)' : 'none' }}>
              🌐 Venners venner
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
            {audience === 'friends'
              ? 'Kun venner som har ting i denne kategorien varsles'
              : 'Venner og venners venner med ting i kategorien varsles'}
          </p>
        </div>

        {error && <p className="text-sm font-medium" style={{ color: 'var(--terra)' }}>{error}</p>}

        <button onClick={handleSubmit} disabled={saving || !itemName.trim() || !category}
          className="btn-primary w-full py-4 disabled:opacity-50">
          {saving ? 'Sender…' : 'Spør kretsen →'}
        </button>

      </div>
      <div className="nav-spacer" />
    </div>
  )
}

const AddPageInner = dynamic(() => Promise.resolve(AddPageInnerComponent), { ssr: false })

export default function AddPage() {
  return <AddPageInner />
}
