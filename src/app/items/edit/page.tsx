// Path of this file: src/app/items/edit/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES, getCategoryLabel } from '@/lib/categories'

// Age ranges matching the baby-og-barn taxonomy
const AGE_RANGES = [
  { id: '0-3mnd', label: '0–3 mnd' },
  { id: '3-6mnd', label: '3–6 mnd' },
  { id: '6-12mnd', label: '6–12 mnd' },
  { id: '1-2ar', label: '1–2 år' },
  { id: '2-3ar', label: '2–3 år' },
  { id: '3-5ar', label: '3–5 år' },
  { id: '5-8ar', label: '5–8 år' },
  { id: '8-12ar', label: '8–12 år' },
]

export default function EditItemPage() {
  const searchParams = useSearchParams()
  const itemId = searchParams.get('item') ?? ''
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [available, setAvailable] = useState(true)
  const [price, setPrice] = useState('')
  const [ageRanges, setAgeRanges] = useState<string[]>([])

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBabyCategory = category === 'baby-og-barn'

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: item, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single()

      if (error || !item) { router.push('/profile'); return }
      // Only owner can edit
      if (item.owner_id !== user.id) { router.push(`/items/${itemId}`); return }

      setName(item.name ?? '')
      setDescription(item.description ?? '')
      setCategory(item.category ?? '')
      setSubcategory(item.subcategory ?? '')
      setAvailable(item.available ?? true)
      setPrice(item.price ? String(item.price) : '')
      setImageUrl(item.image_url ?? null)
      setAgeRanges(item.age_ranges ?? [])
      setLoading(false)
    }
    load()
  }, [itemId])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl
    setUploadingImage(true)
    const supabase = createClient()
    const ext = imageFile.name.split('.').pop()
    const path = `items/${user.id}/${itemId}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('item-images')
      .upload(path, imageFile, { upsert: true })
    if (error) { setUploadingImage(false); return imageUrl }
    const { data } = supabase.storage.from('item-images').getPublicUrl(path)
    setUploadingImage(false)
    return data.publicUrl
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const toggleAgeRange = (id: string) => {
    setAgeRanges(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Navn er påkrevd'); return }
    setSaving(true)
    setError(null)

    const finalImageUrl = await uploadImage()
    const supabase = createClient()

    const updates: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      subcategory: subcategory || null,
      available,
      price: price ? Number(price) : null,
      image_url: finalImageUrl,
      age_ranges: isBabyCategory ? ageRanges : [],
    }

    const { error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)

    if (error) {
      setError('Noe gikk galt. Prøv igjen.')
      setSaving(false)
      return
    }

    router.push(`/items/${itemId}`)
  }

  const currentImage = imagePreview || imageUrl

  if (loading) return (
    <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <Link href={`/items/${itemId}`} aria-label="Avbryt">
          <span className="w-9 h-9 flex items-center justify-center rounded-full shadow-sm"
            style={{ background: '#fff', border: '1px solid var(--glass-border)', color: '#1A3542' }}>
            ←
          </span>
        </Link>
        <h1 className="page-header-title font-display" style={{ flex: 1, textAlign: 'center' }}>
          Rediger gjenstand
        </h1>
        <div className="w-9" /> {/* spacer */}
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Bilde */}
        <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--terra-dark)' }}>Bilde</p>

          {currentImage ? (
            <div className="relative">
              <img
                src={currentImage}
                alt="Forhåndsvisning"
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: 240 }}
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid var(--glass-border)', color: 'var(--terra)' }}
                aria-label="Fjern bilde"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl flex flex-col items-center justify-center gap-2 py-8 transition-colors"
              style={{ border: '1.5px dashed var(--glass-border)', background: 'var(--glass-bg)' }}
            >
              <span className="text-2xl">📷</span>
              <span className="text-sm" style={{ color: 'var(--terra-mid)' }}>Legg til bilde</span>
            </button>
          )}

          {currentImage && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 w-full text-center text-sm py-2 rounded-xl"
              style={{ border: '1px solid var(--glass-border)', color: 'var(--terra-mid)', background: 'var(--glass-bg)' }}
            >
              Bytt bilde
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {/* Navn */}
        <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
          <label className="text-sm font-medium block mb-2" style={{ color: 'var(--terra-dark)' }}>
            Navn <span style={{ color: 'var(--terra)' }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Hva heter gjenstanden?"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--terra-dark)',
            }}
          />
        </div>

        {/* Beskrivelse */}
        <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
          <label className="text-sm font-medium block mb-2" style={{ color: 'var(--terra-dark)' }}>
            Beskrivelse
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tilstand, størrelse, ekstra info…"
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--terra-dark)',
            }}
          />
        </div>

        {/* Kategori */}
        <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
          <label className="text-sm font-medium block mb-2" style={{ color: 'var(--terra-dark)' }}>
            Kategori
          </label>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setSubcategory(''); setAgeRanges([]) }}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--terra-dark)',
              appearance: 'none',
            }}
          >
            <option value="">Velg kategori</option>
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Aldersgrupper — vises kun for baby-og-barn */}
        {isBabyCategory && (
          <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--terra-dark)' }}>
              Aldersgrupper
            </label>
            <p className="text-xs mb-3" style={{ color: 'var(--terra-mid)' }}>
              Velg alle som passer — f.eks. passer en tripp trapp til mange aldre
            </p>
            <div className="flex flex-wrap gap-2">
              {AGE_RANGES.map(range => {
                const active = ageRanges.includes(range.id)
                return (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => toggleAgeRange(range.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={active
                      ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                      : { background: '#fff', color: '#1A3542', border: '1px solid var(--glass-border)' }
                    }
                  >
                    {range.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Pris + tilgjengelighet */}
        <div className="rounded-2xl p-4 flex flex-col gap-4" style={{ background: '#fff' }}>
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--terra-dark)' }}>
              Pris per dag (kr)
            </label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0 = gratis"
              min={0}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: 'var(--terra-dark)',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Tilgjengelighet</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                {available ? 'Ledig for utlån' : 'Ikke tilgjengelig nå'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAvailable(v => !v)}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ background: available ? 'var(--terra)' : 'var(--glass-border)' }}
              aria-label="Endre tilgjengelighet"
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-transform"
                style={{
                  background: '#fff',
                  left: available ? 'calc(100% - 22px)' : '2px',
                  transition: 'left 0.15s ease',
                }}
              />
            </button>
          </div>
        </div>

        {/* Feilmelding */}
        {error && (
          <p className="text-sm px-1" style={{ color: 'var(--terra)' }}>{error}</p>
        )}

        {/* Lagre */}
        <button
          onClick={handleSave}
          disabled={saving || uploadingImage}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-opacity"
          style={{
            background: 'var(--terra)',
            color: '#fff',
            opacity: (saving || uploadingImage) ? 0.6 : 1,
          }}
        >
          {uploadingImage ? 'Laster opp bilde…' : saving ? 'Lagrer…' : 'Lagre endringer'}
        </button>

      </div>

      <div className="nav-spacer" />
    </div>
  )
}
