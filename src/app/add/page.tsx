// Path of this file: src/app/add/page.tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CATEGORIES, SIZES_BY_GENDER, AGE_GROUPS, COLORS,
  getCategoryById, type Gender,
} from '@/lib/categories'
import ImportModal, { type ImportDraft, type ParsedItem } from '@/components/ImportModal'
import { track, Events } from '@/lib/track'

// ─── Nøkkel for draft i sessionStorage ───────────────────────────────────────
const DRAFT_KEY = 'village_add_draft'

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

// ─── Draft-type ───────────────────────────────────────────────────────────────
type Draft = {
  categoryId: string
  subcategoryIds: string[]
  name: string
  description: string
  location: string
  gender: Gender | ''
  size: string
  ageRanges: string[]
  color: string
  suggestedImageUrl: string
  selectedImageSrc: 'own' | 'suggested'
  imagePreviews: string[]
  bookTitle: string
  bookAuthor: string
}

export default function AddPage() {
  const router = useRouter()
  // FIX: Analyse-input ref (slot 0 i grid + kamera-knapp øverst)
  const analyzeFileInputRef = useRef<HTMLInputElement>(null)
  // FIX: Ekstra bildeslots — bruker én felles multi-input i stedet for separate refs
  const multiFileInputRef = useRef<HTMLInputElement>(null)

  // ── Core state ──
  const [categoryId, setCategoryId]         = useState('baby-og-barn')
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>([])
  const [name, setName]                     = useState('')
  const [description, setDescription]       = useState('')
  const [location, setLocation]             = useState('')
  const [gender, setGender]                 = useState<Gender | ''>('')
  const [size, setSize]                     = useState('')
  const [ageRanges, setAgeRanges]           = useState<string[]>([])
  const [color, setColor]                   = useState('')
  const [imagePreviews, setImagePreviews]   = useState<string[]>([])
  const [suggestedImageUrl, setSuggestedImageUrl] = useState('')
  const [selectedImageSrc, setSelectedImageSrc]   = useState<'own' | 'suggested'>('own')
  // FIX: Bok-felt lagres separat og overskriver aldri manuelt innfylte felt
  const [bookTitle, setBookTitle]           = useState('')
  const [bookAuthor, setBookAuthor]         = useState('')

  // ── Image analysis state ──
  // FIX: imageAnalyzing sporer kun den aktive analysen — ikke ekstra-bilder
  const [imageAnalyzing, setImageAnalyzing] = useState(false)
  const [imageAnalyzed, setImageAnalyzed]   = useState(false)
  // FIX: analysisLocked forhindrer at analyse utløses på manuelt opplastede bilder
  const [analysisLocked, setAnalysisLocked] = useState(false)

  // ── Shelf (bokhylle) state ──
  const [shelfBooks, setShelfBooks]       = useState<BookResult[]>([])
  const [shelfStep, setShelfStep]         = useState<'idle' | 'loading' | 'results' | 'saving'>('idle')
  const [shelfProgress, setShelfProgress] = useState(0)

  // ── UI state ──
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Import modal ──
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null)
  const searchParams = useSearchParams()

  // ── URL analyse ──
  const [urlInput, setUrlInput]     = useState('')
  const [urlLoading, setUrlLoading] = useState(false)

  // ─── Løpende lagring av draft til sessionStorage ──────────────────────────
  useEffect(() => {
    const draft: Draft = {
      categoryId, subcategoryIds, name, description, location,
      gender, size, ageRanges, color,
      suggestedImageUrl, selectedImageSrc, imagePreviews,
      bookTitle, bookAuthor,
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [categoryId, subcategoryIds, name, description, location,
      gender, size, ageRanges, color,
      suggestedImageUrl, selectedImageSrc, imagePreviews,
      bookTitle, bookAuthor])

  // ─── Last inn draft og profil-location ved mount ──────────────────────────
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?next=/add'); return }

      // Hent alltid adresse fra profil — brukes som fallback hvis draft ikke har hentested
      const { data: prof } = await supabase
        .from('profiles').select('address_street, address_zip, address_city').eq('id', user.id).single()
      const profileLocation = prof
        ? [prof.address_street, prof.address_zip, prof.address_city].filter(Boolean).join(', ')
        : ''

      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        try {
          const d: Draft = JSON.parse(raw)
          // FIX: Gjenopprett ALT fra draft — inkludert bilder og bok-felt
          if (d.categoryId)       setCategoryId(d.categoryId)
          if (d.subcategoryIds)   setSubcategoryIds(d.subcategoryIds)
          if (d.ageRanges)        setAgeRanges(d.ageRanges)
          if (d.name)             setName(d.name)
          if (d.description)      setDescription(d.description)
          // Bruk draft-location hvis satt, ellers fall tilbake til profil-adresse
          if (d.location)           setLocation(d.location)
          else if (profileLocation) setLocation(profileLocation)
          if (d.gender)           setGender(d.gender as Gender)
          if (d.size)             setSize(d.size)
          if (d.color)            setColor(d.color)
          if (d.suggestedImageUrl) setSuggestedImageUrl(d.suggestedImageUrl)
          if (d.selectedImageSrc)  setSelectedImageSrc(d.selectedImageSrc)
          if (d.bookTitle)         setBookTitle(d.bookTitle)
          if (d.bookAuthor)        setBookAuthor(d.bookAuthor)
          if (d.imagePreviews?.length) {
            setImagePreviews(d.imagePreviews)
            // FIX: Sett analysisLocked så gjenopprettede bilder ikke utløser analyse
            setAnalysisLocked(true)
          }
          return
        } catch { /* ugyldig draft – ignorer */ }
      }

      // Ingen gyldig draft: sett profil-adresse som default hentested
      if (profileLocation) setLocation(profileLocation)

      // ── Import draft fra email-import (leggut@villageapp.no) ──
      const importId = new URLSearchParams(window.location.search).get('import')
      if (importId) {
        const { data: draft } = await supabase
          .from('item_import_drafts')
          .select('id, parsed_items, store, order_id, source')
          .eq('id', importId)
          .eq('user_id', user.id)
          .is('used_at', null)
          .single()
        if (draft?.parsed_items?.length) {
          setImportDraft({
            id: draft.id,
            parsed_items: draft.parsed_items,
            store: draft.store,
            order_id: draft.order_id,
            source: draft.source,
          })
          track(Events.RECEIPT_IMPORT_STARTED, { source: draft.source })
        }
      }
    }
    load()
  }, [])

  // ─── Last opp bilde til Supabase Storage (persistent URL) ────────────────
  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const ext = file.name.split('.').pop()
      const path = `items/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('item-images').upload(path, file)
      if (error) throw error
      
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      return data.publicUrl
    } catch (e) {
      console.error('Upload failed:', e)
      return null
    }
  }

  // ─── Bildeanalyse — kun kamera-knappen øverst ────────────────────────────
  // FIX: Ekstra bildeslots bruker addMultipleImages() og trigger IKKE analyse.
  const handleAnalyzeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // FIX: Lås analyse-flagg FØR opplasting, slik at gjenopprettede bilder ikke
    // ved et uhell utløser analyse
    setAnalysisLocked(false) // dette bildet skal analyseres
    setImageAnalyzing(true)
    setImageAnalyzed(false)
    setSuggestedImageUrl('')
    setSelectedImageSrc('own')

    const uploadedUrl = await uploadImageToStorage(file)
    if (!uploadedUrl) {
      alert('Kunne ikke laste opp bildet')
      setImageAnalyzing(false)
      return
    }

    // Legg til URL i imagePreviews (persistent, ikke blob-URL)
    setImagePreviews(prev => [uploadedUrl, ...prev.slice(1)].slice(0, 4))

    const base64 = await toBase64(file)

    try {
      // Steg 1: Analyser bildet
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
  "confident":true/false
}

Returner KUN JSON, ingen annen tekst.` }
            ]
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''

      // FIX: Robust parsing — håndter trailing tegn etter JSON-blokken
      let parsed: any = null
      try {
        const cleaned = text.replace(/```json|```/g, '').trim()
        // Finn første { og siste } for å ekstrahere bare JSON-objektet
        const jsonStart = cleaned.indexOf('{')
        const jsonEnd = cleaned.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
        }
      } catch {
        // Kan ikke parse — avbryt stille
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        return
      }

      if (!parsed) {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        return
      }

      if (parsed.type === 'shelf') {
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

      // Enkelt gjenstand
      if (parsed.confident === false) {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        return
      }

      // FIX: Fyll kun tomme felt — aldri overskriv det brukeren har skrevet.
      // Bruk separate bokfelt for bøker så navn/beskrivelse ikke overskrives ved retur.
      if (parsed.name && !name.trim())               setName(parsed.name)
      if (parsed.description && !description.trim()) setDescription(parsed.description)
      if (parsed.category)                           setCategoryId(parsed.category)
      if (parsed.subcategory) {
        setSubcategoryIds(prev =>
          prev.includes(parsed.subcategory) ? prev : [...prev, parsed.subcategory]
        )
      }

      setImageAnalyzed(true)
    } catch {
      setImageAnalyzed(false)
    }
    setImageAnalyzing(false)
  }

  // ─── FIX: Legg til flere bilder samtidig (ingen analyse) ─────────────────
  const addMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''

    // Last opp alle filer parallelt
    const uploadPromises = files.map(f => uploadImageToStorage(f))
    const urls = await Promise.all(uploadPromises)
    const validUrls = urls.filter((u): u is string => !!u)

    setImagePreviews(prev => {
      const merged = [...prev, ...validUrls]
      return merged.slice(0, 4) // maks 4
    })
  }

  const removeImage = (i: number) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i))
    if (i === 0) {
      setSelectedImageSrc('own')
      setSuggestedImageUrl('')
    }
  }

  // ─── Shelf: lagre valgte bøker ────────────────────────────────────────────
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
          book.author      ? `Forfatter: ${book.author}`   : '',
          book.genre       ? `Sjanger: ${book.genre}`      : '',
          book.isbn        ? `ISBN: ${book.isbn}`          : '',
          book.description ? `\n${book.description}`       : '',
        ].filter(Boolean).join('\n'),
        category: 'boker',
        image_url: book.image_url || null,
        available: true,
        location: location || null,
      })
      done++
      setShelfProgress(Math.round((done / selected.length) * 100))
    }
    sessionStorage.removeItem(DRAFT_KEY)
    router.push('/')
  }


  // ─── Import: publiser valgte items fra ordreimport ─────────────────────────
  const handleImportPublish = async (items: ParsedItem[]) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !items.length) return

    for (const item of items) {
      await supabase.from('items').insert({
        owner_id: user.id,
        name: item.name,
        description: item.description,
        category: item.category,
        subcategories: item.subcategory ? [item.subcategory] : [],
        color: item.color || null,
        size: item.size || null,
        age_ranges: item.age_range ? [item.age_range] : [],
        price: item.price_nok || null,
        available: true,
        location: location || null,
      })
    }

    if (importDraft?.id) {
      await supabase
        .from('item_import_drafts')
        .update({ used_at: new Date().toISOString() })
        .eq('id', importDraft.id)
    }

    track(Events.RECEIPT_IMPORT_PUBLISHED, {
      source: importDraft?.source,
      item_count: items.length,
      store: importDraft?.store ?? undefined,
      categories: [...new Set(items.map(i => i.category))],
    })

    setImportDraft(null)
    sessionStorage.removeItem(DRAFT_KEY)
    router.push('/')
  }

  // ─── URL-analyse ──────────────────────────────────────────────────────────
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
      // FIX: Robust parsing
      const cleaned = text.replace(/```json|```/g, '').trim()
      const jsonStart = cleaned.indexOf('{')
      const jsonEnd = cleaned.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
        if (parsed.name && !name.trim())               setName(parsed.name)
        if (parsed.description && !description.trim()) setDescription(parsed.description)
        if (parsed.category)                           setCategoryId(parsed.category)
        if (parsed.subcategory) {
          setSubcategoryIds(prev =>
            prev.includes(parsed.subcategory) ? prev : [...prev, parsed.subcategory]
          )
        }
        if (parsed.imageUrl) {
          setSuggestedImageUrl(parsed.imageUrl)
          setSelectedImageSrc('suggested')
        }
      }
    } catch (e) { console.error(e) }
    setUrlLoading(false)
  }

  // ─── Validering og navigering til access-siden ───────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {}
    if (!categoryId)               errs.category    = 'Velg en kategori'
    if (subcategoryIds.length === 0) errs.subcategory = 'Velg minst én underkategori'
    if (!name.trim())              errs.name        = 'Tittel er påkrevd'
    if (!location.trim())          errs.location    = 'Postnummer er påkrevd'
    const hasImage = imagePreviews.length > 0 || (selectedImageSrc === 'suggested' && suggestedImageUrl)
    if (!hasImage)                 errs.images      = 'Legg til minst ett bilde'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const goToAccess = () => {
    if (!validate()) return
    // FIX: Draft er allerede lagret løpende — gå bare videre.
    // Ingen re-analyse eller state-reset skjer herfra.
    router.push('/items/access')
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
  const isBook = categoryId === 'boker'

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
            <div key={i}
              onClick={() => setShelfBooks(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b))}
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

  // ─── HOVED-SKJEMA ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-24">
      <ImportModal
        draft={importDraft}
        onClose={() => setImportDraft(null)}
        onPublish={handleImportPublish}
      />
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
      />
      <div className="px-4 pt-5 flex flex-col gap-5">

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
                    setGender('')
                    setSize('')
                    setAgeRanges([])
                    setSubcategoryIds([])
                  }}
                  className="flex flex-col items-center gap-1.5 flex-1 rounded-xl py-3 px-2 transition-all"
                  style={{
                    background: isActive ? 'var(--terra)' : 'white',
                    border: isActive ? '0.5px solid var(--terra)' : '0.5px solid rgba(46,98,113,0.25)',
                    color: isActive ? 'white' : 'var(--terra-dark)',
                    fontSize: 11,
                    boxShadow: isActive ? '0 2px 8px rgba(46,98,113,0.25)' : 'none',
                  }}>
                  <span style={{ color: isActive ? 'white' : 'var(--terra-mid)', display: 'flex' }}>
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
            {/* UNDERKATEGORI */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
                {selectedCat.id === 'boker' ? 'Sjanger *' : 'Underkategori *'}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedCat.subcategories.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSubcategoryIds(prev =>
                      prev.includes(sub.id) ? prev.filter(x => x !== sub.id) : [...prev, sub.id]
                    )}
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

            {/* FIX: «Hvilken bok er dette» — kun etter underkategori, kun for bøker */}
            {isBook && subcategoryIds.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Hvilken bok er dette?</p>
                <input
                  value={bookTitle}
                  onChange={e => setBookTitle(e.target.value)}
                  placeholder="Boktittel"
                  className="glass outline-none"
                  style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
                />
                <input
                  value={bookAuthor}
                  onChange={e => setBookAuthor(e.target.value)}
                  placeholder="Forfatter"
                  className="glass outline-none"
                  style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)', fontSize: 15 }}
                />
              </div>
            )}

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

            {/* ALDER (baby-og-barn, ikke gravid) */}
            {selectedCat.hasAge && !subcategoryIds.includes('gravid') && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Alder</p>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map(ag => (
                    <button
                      key={ag.id}
                      onClick={() => setAgeRanges(prev =>
                        prev.includes(ag.id) ? prev.filter(x => x !== ag.id) : [...prev, ag.id]
                      )}
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

            {/* STØRRELSE */}
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

            {/* FIX: BILDER — felles multi-fil-input + analyse-slot holdes separert */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
                {imagePreviews.length > 0 || suggestedImageUrl ? 'Bilder' : 'Bilder *'}
              </p>

              {/* Velg mellom eget og foreslått bilde (vises kun når begge finnes) */}
              {imagePreviews.length > 0 && suggestedImageUrl && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button onClick={() => setSelectedImageSrc('own')}
                    className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImageSrc === 'own' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                    <img src={imagePreviews[0]} className="w-full h-28 object-cover" alt="Ditt bilde" />
                    <div className="py-2 text-xs font-medium text-center"
                      style={{ background: selectedImageSrc === 'own' ? 'var(--terra)' : 'rgba(46,98,113,0.08)', color: selectedImageSrc === 'own' ? 'white' : 'var(--terra-dark)' }}>
                      {selectedImageSrc === 'own' ? '✓ Ditt bilde' : 'Ditt bilde'}
                    </div>
                  </button>
                  <button onClick={() => setSelectedImageSrc('suggested')}
                    className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImageSrc === 'suggested' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                    <img src={suggestedImageUrl} className="w-full h-28 object-cover" alt="Produktbilde" onError={() => setSuggestedImageUrl('')} />
                    <div className="py-2 text-xs font-medium text-center"
                      style={{ background: selectedImageSrc === 'suggested' ? 'var(--terra)' : 'rgba(46,98,113,0.08)', color: selectedImageSrc === 'suggested' ? 'white' : 'var(--terra-dark)' }}>
                      {selectedImageSrc === 'suggested' ? '✓ Produktbilde' : 'Produktbilde'}
                    </div>
                  </button>
                </div>
              )}

              {/* FIX: Bildegrid — slot 0 er alltid analyse-knapp (separat input),
                  slots 1–3 åpner felles multi-fil-input uten analyse */}
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(i => {
                  const preview = imagePreviews[i]
                  return (
                    <div key={i} className="relative" style={{ height: 80 }}>
                      {preview ? (
                        <>
                          <img src={preview} className="w-full h-full object-cover rounded-xl" alt={`Bilde ${i + 1}`} />
                          {i === 0 && (
                            <span className="absolute bottom-1 left-1 text-white px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.5)', fontSize: 9 }}>Hoved</span>
                          )}
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ background: 'rgba(0,0,0,0.5)', fontSize: 12 }}>×</button>
                        </>
                      ) : i === 0 ? (
                        // Slot 0: trigger bildeanalyse
                        <button
                          onClick={() => analyzeFileInputRef.current?.click()}
                          className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-1"
                          style={{ background: 'white', border: '1px dashed rgba(46,98,113,0.35)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span style={{ fontSize: 9, color: 'var(--terra-mid)' }}>Bilde</span>
                        </button>
                      ) : (
                        // Slots 1–3: legg til ekstra bilder uten analyse
                        // Vises alltid (ikke kun om forrige slot er fylt) for fri rekkefølge
                        <button
                          onClick={() => multiFileInputRef.current?.click()}
                          className="w-full h-full rounded-xl flex items-center justify-center"
                          style={{ background: '#F5F0EA', border: '0.5px dashed rgba(46,98,113,0.2)' }}>
                          <span style={{ fontSize: 18, color: 'rgba(46,98,113,0.3)' }}>+</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* FIX: Felles multi-fil-input for slots 1–3 — multiple tillatt */}
              <input
                ref={multiFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={addMultipleImages}
                className="hidden"
              />
              <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>Første bilde blir hovedbilde. Du kan legge til opptil 4 bilder.</p>
              {errors.images && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.images}</p>}
            </div>

            {/* NESTE */}
            <button onClick={goToAccess} disabled={saving} className="btn-primary w-full mt-2 disabled:opacity-50">
              Neste →
            </button>
          </>
        )}

        {/* ── SKILLELINJE ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(46,98,113,0.12)' }} />
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            Eller fyll ut automatisk
          </p>
          <div style={{ flex: 1, height: 1, background: 'rgba(46,98,113,0.12)' }} />
        </div>

        {/* ── FINN PRODUKTET RASKT ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
            {isBook ? 'Finn boken raskt' : 'Finn produktet raskt'}
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

          {/* FIX: Analyser bilde — trigger kun gjenkjenning, separat fra ekstra-bilder */}
          <button
            onClick={() => analyzeFileInputRef.current?.click()}
            disabled={imageAnalyzing}
            className="glass w-full flex items-center gap-3 text-left disabled:opacity-50"
            style={{ borderRadius: 14, padding: '13px 16px', border: '0.5px solid rgba(46,98,113,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)', marginBottom: 2, letterSpacing: '0.06em' }}>
                {imageAnalyzing ? 'Gjenkjenner…' : 'Gjenkjenn med bilde'}
              </p>
              <p className="text-sm" style={{ color: 'var(--terra-dark)' }}>
                Ta bilde av gjenstanden – eller hele bokhylla
              </p>
            </div>
          </button>
          {/* Skjult input KUN for analyse */}
          <input
            ref={analyzeFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAnalyzeImage}
            className="hidden"
          />

          {imageAnalyzing && (
            <div className="glass rounded-2xl p-4 text-center flex items-center justify-center gap-3">
              <span className="text-xl animate-pulse">🔍</span>
              <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Gjenkjenner gjenstanden…</p>
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
        </div>
      </div>
    </div>
  )
}
