'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CATEGORIES, SIZES_BY_GENDER, AGE_GROUPS, COLORS,
  getCategoryById, type Gender,
} from '@/lib/categories'

// ─── SVG-ikoner per kategori ──────────────────────────────────────────────────

const CAT_ICONS: Record<string, React.ReactNode> = {
  'baby-og-barn': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
    </svg>
  ),
  'klar-og-mote': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  ),
  'boker': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  'annet': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
}

type BookResult = {
  title: string; author: string; description: string
  genre: string; isbn: string; image_url: string; selected: boolean
}

export default function AddPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shelfSaveRef = useRef<HTMLInputElement>(null)

  // ── Core state ──
  const [categoryId, setCategoryId]       = useState('')
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>([])
  const [name, setName]                   = useState('')
  const [description, setDescription]    = useState('')
  const [location, setLocation]           = useState('')
  const [gender, setGender]               = useState<Gender | ''>('')
  const [size, setSize]                   = useState('')
  const [ageRanges, setAgeRanges]         = useState<string[]>([])
  const [color, setColor]                 = useState('')
  const [images, setImages]               = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [suggestedImageUrl, setSuggestedImageUrl] = useState('')
  const [selectedImageSrc, setSelectedImageSrc]   = useState<'own' | 'suggested'>('own')

  // ── Image analysis state ──
  const [imageAnalyzing, setImageAnalyzing] = useState(false)
  const [imageAnalyzed, setImageAnalyzed]   = useState(false)

  // ── Shelf (bokhylle) state ──
  const [shelfBooks, setShelfBooks]     = useState<BookResult[]>([])
  const [shelfStep, setShelfStep]       = useState<'idle' | 'loading' | 'results' | 'saving'>('idle')
  const [shelfProgress, setShelfProgress] = useState(0)

  // ── UI state ──
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  // Load default location from profile
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // ── Restore draft from sessionStorage (user came back from access page) ──
      const draft = sessionStorage.getItem('village_add_draft')
      if (draft) {
        try {
          const d = JSON.parse(draft)
          if (d.categoryId)    setCategoryId(d.categoryId)
          if (d.subcategoryIds) setSubcategoryIds(d.subcategoryIds)
          if (d.ageRanges)      setAgeRanges(d.ageRanges)
          if (d.name)          setName(d.name)
          if (d.description)   setDescription(d.description)
          if (d.location)      setLocation(d.location)
          if (d.gender)        setGender(d.gender)
          if (d.size)          setSize(d.size)
          if (d.color)         setColor(d.color)
          if (d.suggestedImageUrl) setSuggestedImageUrl(d.suggestedImageUrl)
          if (d.selectedImageSrc)  setSelectedImageSrc(d.selectedImageSrc)
          if (d.imagePreviews) setImagePreviews(d.imagePreviews)
          // Note: File objects can't be stored — previews shown, user re-uploads if needed
        } catch {}
        sessionStorage.removeItem('village_add_draft')
      } else {
        // Only load profile location if no draft (draft has its own location)
        const { data: prof } = await supabase.from('profiles').select('location').eq('id', user.id).single()
        if (prof?.location) setLocation(prof.location)
      }
    }
    load()
  }, [])

  // ─── Image handler — detects shelf vs single item ─────────────────────────

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Add to image list (max 4)
    setImages(prev => [...prev, file].slice(0, 4))
    setImagePreviews(prev => [...prev, URL.createObjectURL(file)].slice(0, 4))

    setImageAnalyzing(true)
    setImageAnalyzed(false)
    setSuggestedImageUrl('')

    const base64 = await toBase64(file)

    try {
      // Step 1: Analyze the image — detect shelf or single item
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              { type: 'text', text: `Analyser dette bildet. Returner KUN et JSON-objekt:

Hvis det er en bokhylle med flere bøker:
{"type":"shelf","books":[{"title":"...","author":"..."}]}

Hvis det er en enkelt gjenstand:
{
  "type":"item",
  "name":"...",
  "description":"...",
  "category":"baby-og-barn|klar-og-mote|boker|annet",
  "subcategory":"...",
  "searchQuery":"...",
  "confident":true/false
}

Returner KUN JSON, ingen annen tekst.` }
            ]
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      if (parsed.type === 'shelf') {
        // ── BOKHYLLE-FLYT ──
        setImageAnalyzing(false)
        setShelfStep('loading')
        const results: BookResult[] = []
        for (const book of (parsed.books || []).slice(0, 15)) {
          try {
            const q = encodeURIComponent(`${book.title} ${book.author}`)
            const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
            const gbData = await gbRes.json()
            const vol = gbData.items?.[0]?.volumeInfo
            const isbn = vol?.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier
              || vol?.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier || ''
            results.push({
              title: vol?.title || book.title,
              author: vol?.authors?.[0] || book.author,
              description: vol?.description?.slice(0, 300) || '',
              genre: vol?.categories?.[0] || '',
              isbn,
              image_url: vol?.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
              selected: true,
            })
          } catch {
            results.push({ title: book.title, author: book.author, description: '', genre: '', isbn: '', image_url: '', selected: true })
          }
        }
        setShelfBooks(results)
        setShelfStep('results')
        return
      }

      // ── ENKELT GJENSTAND-FLYT ──
      if (parsed.confident === false) {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        return
      }

      if (parsed.name && !name.trim())        setName(parsed.name)
      if (parsed.description && !description.trim()) setDescription(parsed.description)
      if (parsed.category)    setCategoryId(parsed.category)
      if (parsed.subcategory) setSubcategoryIds(prev => prev.includes(parsed.subcategory) ? prev.filter(x => x !== parsed.subcategory) : [...prev, parsed.subcategory])

      // Step 2: Fetch product image
      if (parsed.searchQuery) {
        try {
          const imgRes = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 200,
              tools: [{ type: 'web_search_20250305', name: 'web_search' }],
              messages: [{
                role: 'user',
                content: `Find a clean product image URL (preferably white background) for: ${parsed.searchQuery}. Return ONLY a JSON object: {"imageUrl": "https://..."} with a direct image URL ending in .jpg, .jpeg, or .png`
              }]
            })
          })
          const imgData = await imgRes.json()
          const imgText = imgData.content?.find((b: any) => b.type === 'text')?.text || ''
          const imgClean = imgText.replace(/```json|```/g, '').trim()
          if (imgClean.startsWith('{')) {
            const imgParsed = JSON.parse(imgClean)
            if (imgParsed.imageUrl) {
              setSuggestedImageUrl(imgParsed.imageUrl)
              setSelectedImageSrc('suggested')
            }
          }
        } catch { /* ikke kritisk */ }
      }

      setImageAnalyzed(true)
    } catch {
      setImageAnalyzed(false)
    }
    setImageAnalyzing(false)
  }

  // ─── Shelf: save selected books ───────────────────────────────────────────

  const saveShelfBooks = async () => {
    setShelfStep('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const selected = shelfBooks.filter(b => b.selected)
    let done = 0
    for (const book of selected) {
      await supabase.from('items').insert({
        owner_id: user.id,
        name: book.title,
        description: [
          book.author   ? `Forfatter: ${book.author}`   : '',
          book.genre    ? `Sjanger: ${book.genre}`      : '',
          book.isbn     ? `ISBN: ${book.isbn}`          : '',
          book.description ? `\n${book.description}`   : '',
        ].filter(Boolean).join('\n'),
        category: 'boker',
        image_url: book.image_url || null,
        available: true,
        location: location || null,
      })
      done++
      setShelfProgress(Math.round((done / selected.length) * 100))
    }
    router.push('/')
  }

  // ─── URL analysis ─────────────────────────────────────────────────────────

  const [urlInput, setUrlInput]     = useState('')
  const [urlLoading, setUrlLoading] = useState(false)

  const analyzeUrl = async () => {
    if (!urlInput.trim()) return
    setUrlLoading(true)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Analyser denne URL-en og returner KUN et JSON-objekt: {name, description, category (én av: baby-og-barn/klar-og-mote/boker/annet), subcategory, imageUrl}. URL: ${urlInput}`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      if (parsed.name && !name.trim())        setName(parsed.name)
      if (parsed.description && !description.trim()) setDescription(parsed.description)
      if (parsed.category)    setCategoryId(parsed.category)
      if (parsed.subcategory) setSubcategoryIds(prev => prev.includes(parsed.subcategory) ? prev.filter(x => x !== parsed.subcategory) : [...prev, parsed.subcategory])
      if (parsed.imageUrl) {
        setSuggestedImageUrl(parsed.imageUrl)
        setSelectedImageSrc('suggested')
      }
    } catch (e) { console.error(e) }
    setUrlLoading(false)
  }

  // ─── Validation & save ────────────────────────────────────────────────────

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!categoryId)   errs.category    = 'Velg en kategori'
    if (subcategoryIds.length === 0) errs.subcategory = 'Velg minst én underkategori'
    if (!name.trim())  errs.name        = 'Tittel er påkrevd'
    if (!location.trim()) errs.location = 'Postnummer er påkrevd'
    const hasImage = images.length > 0 || selectedImageSrc === 'suggested'
    if (!hasImage)     errs.images      = 'Legg til minst ett bilde'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveItem = async () => {
    if (!validate()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    let image_url = ''
    if (selectedImageSrc === 'suggested' && suggestedImageUrl) {
      image_url = suggestedImageUrl
    } else if (images[0]) {
      const ext = images[0].name.split('.').pop()
      const path = `items/${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('item-images').upload(path, images[0])
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      image_url = data.publicUrl

      // Upload remaining images (2–4) — stored in extra_images jsonb or ignored for now
    }

    const { data: item, error } = await supabase.from('items').insert({
      owner_id: user.id,
      name,
      description,
      category: categoryId,
      subcategory: subcategoryIds[0] || null,
      subcategories: subcategoryIds,
      image_url: image_url || null,
      available: true,
      location: location || null,
      color: color || null,
      size: size || null,
      age_ranges: ageRanges,
    }).select().single()

    if (error || !item?.id) {
      console.error('Insert failed:', JSON.stringify(error))
      setSaving(false)
      return
    }

    // ── Save draft so user can come back without losing their info ──
    sessionStorage.setItem('village_add_draft', JSON.stringify({
      categoryId, subcategoryIds, name, description, location,
      gender, size, ageRanges, color,
      suggestedImageUrl, selectedImageSrc, imagePreviews,
    }))

    router.push(`/items/access?item=${item.id}&name=${encodeURIComponent(name)}`)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(file)
    })

  const selectedCat = getCategoryById(categoryId)

  // ─── SHELF: resultater ────────────────────────────────────────────────────

  if (shelfStep === 'results') {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="page-header glass sticky top-0 z-10 px-4 pt-4 pb-4" style={{ borderRadius: '0 0 20px 20px' }}>
          <button onClick={() => { setShelfStep('idle'); setShelfBooks([]) }}
            className="btn-glass text-sm mb-2 block" style={{ color: 'var(--terra)' }}>← Tilbake</button>
          <h1 className="font-display font-bold" style={{ fontSize: 20, color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Velg bøker å legge ut
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>
            {shelfBooks.filter(b => b.selected).length} av {shelfBooks.length} valgt
          </p>
        </div>
        <div className="px-4 pt-4 flex flex-col gap-3">
          {shelfBooks.map((book, i) => (
            <div key={i} onClick={() => setShelfBooks(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b))}
              className={`glass rounded-2xl p-4 flex gap-3 cursor-pointer transition-all ${book.selected ? 'ring-2' : 'opacity-50'}`}
              style={book.selected ? { '--tw-ring-color': 'var(--terra)' } as React.CSSProperties : {}}>
              {book.image_url
                ? <img src={book.image_url} alt={book.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                : <div className="w-12 h-16 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'rgba(46,98,113,0.12)' }}>📚</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--terra-dark)' }}>{book.title}</p>
                {book.author && <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{book.author}</p>}
                {book.genre  && <p className="text-xs mt-0.5" style={{ color: 'var(--terra)' }}>{book.genre}</p>}
                {book.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--terra-dark)' }}>{book.description}</p>}
              </div>
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: book.selected ? 'var(--terra)' : 'transparent', border: book.selected ? 'none' : '2px solid rgba(46,98,113,0.25)' }}>
                {book.selected && <span className="text-white text-xs">✓</span>}
              </div>
            </div>
          ))}
          <button onClick={saveShelfBooks} disabled={shelfBooks.filter(b => b.selected).length === 0}
            className="btn-primary w-full mt-2 disabled:opacity-50">
            Legg ut {shelfBooks.filter(b => b.selected).length} bøker
          </button>
        </div>
      </div>
    )
  }

  if (shelfStep === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">📚</div>
        <p className="font-bold mb-2" style={{ fontSize: 18, color: 'var(--terra-dark)' }}>Lagrer bøker…</p>
        <div className="w-full max-w-xs rounded-full h-2 mt-2" style={{ background: 'rgba(46,98,113,0.15)' }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${shelfProgress}%`, background: 'var(--terra)' }} />
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--terra-mid)' }}>{shelfProgress}%</p>
      </div>
    )
  }

  // ─── MAIN FORM ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-5 flex flex-col gap-5">

        {/* ── FINN PRODUKTET RASKT ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            {categoryId === 'boker' ? 'Finn boken raskt' : 'Finn produktet raskt'}
          </p>

          {/* URL */}
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="Lim inn lenke til gjenstanden…"
              className="glass flex-1 outline-none text-sm"
              style={{ borderRadius: 12, padding: '11px 14px', color: 'var(--terra-dark)' }}
            />
            <button onClick={analyzeUrl} disabled={urlLoading || !urlInput.trim()}
              className="btn-primary disabled:opacity-50" style={{ padding: '11px 16px', fontSize: 14 }}>
              {urlLoading ? '…' : 'Hent'}
            </button>
          </div>

          {/* Bilde — trigger filvelger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="glass w-full flex items-center gap-3 text-left"
            style={{ borderRadius: 14, padding: '13px 16px', border: '0.5px solid rgba(46,98,113,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)', marginBottom: 2, letterSpacing: '0.06em' }}>Bilde</p>
              <p className="text-sm" style={{ color: 'var(--terra-dark)' }}>Ta bilde av gjenstanden – eller hele bokhylla</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />

          {imageAnalyzing && (
            <div className="glass rounded-2xl p-4 text-center flex items-center justify-center gap-3">
              <span className="text-xl animate-pulse">🔍</span>
              <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>
                {shelfStep === 'loading' ? 'Analyserer bokhyllen…' : 'Gjenkjenner gjenstanden…'}
              </p>
            </div>
          )}

          {shelfStep === 'loading' && (
            <div className="glass rounded-2xl p-4 text-center flex items-center justify-center gap-3">
              <span className="text-xl animate-pulse">📚</span>
              <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Analyserer bokhyllen…</p>
            </div>
          )}

          {imageAnalyzed && (
            <div className="glass" style={{ borderRadius: 12, padding: '10px 14px' }}>
              <span className="status-pill active">✓ Gjenkjent – sjekk og juster under</span>
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Eller fyll ut manuelt under.</p>
        </div>

        {/* ── KATEGORI ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Kategori *</p>
          <div className="flex gap-2">
            {CATEGORIES.map(cat => {
              const isActive = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategoryId(cat.id)
                    setSubcategoryIds(prev => prev.includes('') ? prev.filter(x => x !== '') : [...prev, ''])
                    setGender('')
                    setSize('')
                    setAgeRanges([])
                  }}
                  className="flex flex-col items-center gap-1.5 flex-1 rounded-xl py-3 px-2 transition-all"
                  style={{
                    background: isActive ? 'var(--terra)' : 'white',
                    border: isActive ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.25)',
                    color: isActive ? 'white' : 'var(--terra-dark)',
                    fontSize: 11,
                    boxShadow: isActive ? '0 2px 8px rgba(46,98,113,0.25)' : 'none',
                  }}>
                  <span style={{ color: isActive ? 'var(--terra)' : 'var(--terra-mid)', display: 'flex' }}>
                    {CAT_ICONS[cat.id]}
                  </span>
                  <span style={{ lineHeight: 1.2, textAlign: 'center', fontWeight: isActive ? 500 : 400 }}>
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Flere kategorier kommer – dette er et tidlig utvalg.</p>
          {errors.category && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.category}</p>}
        </div>

        {/* ── RESTEN vises etter kategori er valgt ── */}
        {selectedCat && (
          <>
            {/* TITTEL */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Tittel *</p>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Hva vil du låne ut?"
                className="glass outline-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
              />
              {errors.name && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.name}</p>}
            </div>

            {/* UNDERKATEGORI */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
                {selectedCat.id === 'boker' ? 'Sjanger *' : 'Underkategori *'}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedCat.subcategories.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSubcategoryIds(prev => prev.includes(sub.id) ? prev.filter(x => x !== sub.id) : [...prev, sub.id])}
                    className="pill"
                    style={{
                      background: subcategoryIds.includes(sub.id) ? 'var(--terra)' : 'white',
                      color: subcategoryIds.includes(sub.id) ? 'white' : 'var(--terra-dark)',
                      border: subcategoryIds.includes(sub.id) ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.3)',
                      borderRadius: 999, padding: '6px 12px', fontSize: 13,
                    }}>
                    {sub.label}
                  </button>
                ))}
              </div>
              {selectedCat.subcategoryHint && (
                <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>{selectedCat.subcategoryHint}</p>
              )}
              {errors.subcategory && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.subcategory}</p>}
            </div>

            {/* ALDER (baby-og-barn, ikke gravid) */}
            {selectedCat.hasAge && !subcategoryIds.includes('gravid') && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Alder</p>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map(ag => (
                    <button
                      key={ag.id}
                      onClick={() => setAgeRanges(prev => prev.includes(ag.id) ? prev.filter(x => x !== ag.id) : [...prev, ag.id])}
                      style={{
                        background: ageRanges.includes(ag.id) ? 'var(--terra)' : 'white',
                        color: ageRanges.includes(ag.id) ? 'white' : 'var(--terra-dark)',
                        border: ageRanges.includes(ag.id) ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.3)',
                        borderRadius: 999, padding: '6px 12px', fontSize: 13,
                      }}>
                      {ag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STØRRELSE (antrekk) */}
            {selectedCat.hasSize && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Størrelse</p>
                <div className="flex gap-2">
                  {(['dame', 'herre', 'barn'] as Gender[]).map(g => (
                    <button
                      key={g}
                      onClick={() => { setGender(g); setSize('') }}
                      style={{
                        flex: 1,
                        background: gender === g ? 'var(--terra)' : 'white',
                        color: gender === g ? 'white' : 'var(--terra-dark)',
                        border: gender === g ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.3)',
                        borderRadius: 10, padding: '8px 14px', fontSize: 13,
                      }}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                {gender && (
                  <div className="flex flex-wrap gap-2">
                    {SIZES_BY_GENDER[gender].map(s => (
                      <button
                        key={s}
                        onClick={() => setSize(s === size ? '' : s)}
                        style={{
                          background: size === s ? 'var(--terra)' : 'white',
                          color: size === s ? 'white' : 'var(--terra-dark)',
                          border: size === s ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.3)',
                          borderRadius: 999, padding: '6px 12px', fontSize: 13,
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FARGE */}
            {selectedCat.hasColor && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Farge</p>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setColor(c.id === color ? '' : c.id)}
                      title={c.label}
                      style={{
                        width: 28, height: 28,
                        borderRadius: '50%',
                        background: c.hex,
                        border: color === c.id ? '2.5px solid var(--terra)' : `2px solid ${c.border || 'transparent'}`,
                        transform: color === c.id ? 'scale(1.2)' : 'scale(1)',
                        transition: 'transform 0.1s',
                        outline: c.id === 'hvit' ? '0.5px solid #ddd' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* BESKRIVELSE */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Beskrivelse</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Størrelse, tilstand, merke…"
                rows={3}
                className="glass outline-none resize-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
              />
            </div>

            {/* HENTESTED */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Hentested *</p>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Postnummer"
                className="glass outline-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
              />
              {errors.location && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.location}</p>}
            </div>

            {/* BILDER */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
                {imagePreviews.length > 0 || suggestedImageUrl ? 'Legg til flere bilder' : 'Bilder *'}
              </p>

              {/* Bildevalg: eget vs. foreslått */}
              {imagePreviews.length > 0 && suggestedImageUrl && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button onClick={() => setSelectedImageSrc('own')}
                    className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImageSrc === 'own' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                    <img src={imagePreviews[0]} className="w-full h-28 object-cover" />
                    <div className="py-2 text-xs font-medium text-center"
                      style={{ background: selectedImageSrc === 'own' ? 'var(--terra)' : 'rgba(46,98,113,0.08)', color: selectedImageSrc === 'own' ? 'white' : 'var(--terra-dark)' }}>
                      {selectedImageSrc === 'own' ? '✓ Ditt bilde' : 'Ditt bilde'}
                    </div>
                  </button>
                  <button onClick={() => setSelectedImageSrc('suggested')}
                    className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImageSrc === 'suggested' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                    <img src={suggestedImageUrl} className="w-full h-28 object-cover" onError={() => setSuggestedImageUrl('')} />
                    <div className="py-2 text-xs font-medium text-center"
                      style={{ background: selectedImageSrc === 'suggested' ? 'var(--terra)' : 'rgba(46,98,113,0.08)', color: selectedImageSrc === 'suggested' ? 'white' : 'var(--terra-dark)' }}>
                      {selectedImageSrc === 'suggested' ? '✓ Produktbilde' : 'Produktbilde'}
                    </div>
                  </button>
                </div>
              )}

              {/* Grid med opptil 4 bilder */}
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map(i => {
                  const preview = imagePreviews[i]
                  const isFirst = i === 0
                  return (
                    <div key={i} className="relative" style={{ height: 96 }}>
                      {preview ? (
                        <>
                          <img src={preview} className="w-full h-full object-cover rounded-xl" />
                          {isFirst && (
                            <span className="absolute bottom-1.5 left-1.5 text-white text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.5)', fontSize: 10 }}>Hoved</span>
                          )}
                          <button onClick={() => {
                            setImages(prev => prev.filter((_, idx) => idx !== i))
                            setImagePreviews(prev => prev.filter((_, idx) => idx !== i))
                          }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ background: 'rgba(0,0,0,0.5)', fontSize: 12 }}>×</button>
                        </>
                      ) : (
                        <label className="cursor-pointer block w-full h-full">
                          <div className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-1.5"
                            style={{ background: i === 0 ? 'white' : '#F5F0EA', border: i === 0 ? '1px dashed rgba(46,98,113,0.35)' : '0.5px dashed rgba(46,98,113,0.15)' }}>
                            {i === 0 && (
                              <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Legg til bilde</span>
                              </>
                            )}
                          </div>
                          <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Første bilde blir hovedbilde. Maks 4 bilder.</p>
              {errors.images && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.images}</p>}
            </div>

            {/* SUBMIT */}
            <button onClick={saveItem} disabled={saving} className="btn-primary w-full mt-2 disabled:opacity-50">
              {saving ? 'Lagrer…' : 'Neste →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
