// Path of this file: src/app/add/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CATEGORIES, SIZES_BY_GENDER, AGE_GROUPS, COLORS,
  getCategoryById, type Gender,
} from '@/lib/categories'
import ImportModal, { type ImportDraft, type ParsedItem } from '@/components/ImportModal'
import FinnImporter from '@/components/FinnImporter'
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

// ─── AddMode ─────────────────────────────────────────────────────────────────
type AddMode = 'manuell' | 'lenke' | 'bilde' | 'finn' | 'mail'

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

// ─── Max bilder per gjenstand ─────────────────────────────────────────────────
const MAX_IMAGES = 10

export default function AddPage() {
  const router = useRouter()
  const analyzeFileInputRef  = useRef<HTMLInputElement>(null)
  const multiFileInputRef    = useRef<HTMLInputElement>(null)

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
  const [bookTitle, setBookTitle]           = useState('')
  const [bookAuthor, setBookAuthor]         = useState('')
  const [userEmail, setUserEmail]           = useState('')

  // ── Image analysis state ──
  const [imageAnalyzing, setImageAnalyzing] = useState(false)
  const [imageAnalyzed, setImageAnalyzed]     = useState(false)
  const [analysisLocked, setAnalysisLocked]   = useState(false)
  const [analysisError, setAnalysisError]     = useState<string | null>(null)
  const [analysisLoadingText, setAnalysisLoadingText] = useState('')
  const [urlAnalyzed, setUrlAnalyzed]         = useState(false)

  // ── Shelf (bokhylle) state ──
  const [shelfBooks, setShelfBooks]       = useState<BookResult[]>([])
  const [shelfStep, setShelfStep]         = useState<'idle' | 'loading' | 'results' | 'saving'>('idle')
  const [shelfProgress, setShelfProgress] = useState(0)

  // ── UI state ──
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  // ── Import modal ──
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null)

  // ── URL analyse ──
  const [urlInput, setUrlInput]     = useState('')
  const [urlLoading, setUrlLoading] = useState(false)

  // ── Opplastingsmodus ──
  const [addMode, setAddMode] = useState<AddMode>('manuell')

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

      setUserEmail(user.email ?? '')

      const { data: prof } = await supabase
        .from('profiles').select('address_street, address_zip, address_city').eq('id', user.id).single()
      const profileLocation = prof
        ? [prof.address_street, prof.address_zip, prof.address_city].filter(Boolean).join(', ')
        : ''

      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        try {
          const d: Draft = JSON.parse(raw)
          if (d.categoryId)       setCategoryId(d.categoryId)
          if (d.subcategoryIds)   setSubcategoryIds(d.subcategoryIds)
          if (d.ageRanges)        setAgeRanges(d.ageRanges)
          if (d.name)             setName(d.name)
          if (d.description)      setDescription(d.description)
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
            setAnalysisLocked(true)
          }
          return
        } catch { /* ugyldig draft – ignorer */ }
      }

      if (profileLocation) setLocation(profileLocation)

      // ── Import draft fra email-import ──
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

  // ─── Last opp bilde til Supabase Storage ─────────────────────────────────
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

  // ─── Morsomme ventetekster ────────────────────────────────────────────────
  const LOADING_TEXTS = [
    'Skal vi se…',
    'Ser på ting i boden…',
    'Denne har jeg vel sett før…',
    'Rydder litt i kategoriene…',
    'Kjenner igjen formen her…',
    'Spør naboen…',
  ]

  // ─── Timeout + feedback logging ───────────────────────────────────────────
  const logAnalysisFailure = async (context: 'bilde' | 'lenke', detail: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('beta_feedback').insert({
        user_id: user?.id ?? null,
        feedback: `Analyse-timeout (${context}): ${detail}`,
        page: '/add',
      })
    } catch { /* silent */ }
  }

  // ─── Bildeanalyse ─────────────────────────────────────────────────────────
  const handleAnalyzeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setAnalysisLocked(false)
    setImageAnalyzing(true)
    setImageAnalyzed(false)
    setAnalysisError(null)
    setSuggestedImageUrl('')
    setSelectedImageSrc('own')

    // Rullerende ventetekst
    let textIdx = 0
    setAnalysisLoadingText(LOADING_TEXTS[0])
    const textTimer = setInterval(() => {
      textIdx = (textIdx + 1) % LOADING_TEXTS.length
      setAnalysisLoadingText(LOADING_TEXTS[textIdx])
    }, 1800)

    // 10s timeout
    let timedOut = false
    const timeoutId = setTimeout(async () => {
      timedOut = true
      clearInterval(textTimer)
      setImageAnalyzing(false)
      setAnalysisError('Klarte ikke analysere denne gangen – prøv igjen eller fyll ut manuelt.')
      await logAnalysisFailure('bilde', file.name)
    }, 10000)

    const uploadedUrl = await uploadImageToStorage(file)
    if (!uploadedUrl) {
      clearTimeout(timeoutId)
      clearInterval(textTimer)
      setImageAnalyzing(false)
      setAnalysisError('Kunne ikke laste opp bildet.')
      return
    }

    setImagePreviews(prev => [uploadedUrl, ...prev.slice(1)].slice(0, MAX_IMAGES))

    const base64 = await toBase64(file)

    try {
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

      clearTimeout(timeoutId)
      clearInterval(textTimer)
      if (timedOut) return

      const data = await res.json()
      const text = data.content?.[0]?.text || ''

      let parsed: any = null
      try {
        const cleaned = text.replace(/```json|```/g, '').trim()
        const jsonStart = cleaned.indexOf('{')
        const jsonEnd = cleaned.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
        }
      } catch {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        setAnalysisError('Klarte ikke gjenkjenne gjenstanden. Prøv et klarere bilde.')
        return
      }

      if (!parsed) {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        setAnalysisError('Klarte ikke gjenkjenne gjenstanden. Prøv et klarere bilde.')
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

      if (parsed.confident === false) {
        setImageAnalyzing(false)
        setImageAnalyzed(false)
        setAnalysisError('Klarte ikke gjenkjenne gjenstanden. Fyll ut manuelt eller prøv et annet bilde.')
        return
      }

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
      clearTimeout(timeoutId)
      clearInterval(textTimer)
      if (!timedOut) {
        setImageAnalyzed(false)
        setAnalysisError('Noe gikk galt. Prøv igjen.')
      }
    }
    if (!timedOut) setImageAnalyzing(false)
  }

  // ─── Legg til flere bilder (ingen analyse) ────────────────────────────────
  const addMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''

    const uploadPromises = files.map(f => uploadImageToStorage(f))
    const urls = await Promise.all(uploadPromises)
    const validUrls = urls.filter((u): u is string => !!u)

    setImagePreviews(prev => {
      const merged = [...prev, ...validUrls]
      return merged.slice(0, MAX_IMAGES)
    })
  }

  const removeImage = (i: number) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i))
    if (i === 0) {
      setSelectedImageSrc('own')
      setSuggestedImageUrl('')
    }
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= imagePreviews.length) return
    setImagePreviews(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
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
    setUrlAnalyzed(false)
    setAnalysisError(null)

    let textIdx = 0
    setAnalysisLoadingText(LOADING_TEXTS[0])
    const textTimer = setInterval(() => {
      textIdx = (textIdx + 1) % LOADING_TEXTS.length
      setAnalysisLoadingText(LOADING_TEXTS[textIdx])
    }, 1800)

    let timedOut = false
    const timeoutId = setTimeout(async () => {
      timedOut = true
      clearInterval(textTimer)
      setUrlLoading(false)
      setAnalysisError('Klarte ikke analysere lenken denne gangen – prøv igjen eller fyll ut manuelt.')
      await logAnalysisFailure('lenke', urlInput)
    }, 10000)

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Analyser denne URL-en og returner KUN et JSON-objekt: {name, description, category (én av: baby-og-barn/klar-og-mote/boker/annet), subcategory, imageUrl, confident: true/false}. URL: ${urlInput}`
          }]
        })
      })

      clearTimeout(timeoutId)
      clearInterval(textTimer)
      if (timedOut) return

      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const cleaned = text.replace(/```json|```/g, '').trim()
      const jsonStart = cleaned.indexOf('{')
      const jsonEnd = cleaned.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
        if (parsed.confident === false) {
          setAnalysisError('Klarte ikke hente informasjon fra denne lenken. Fyll ut manuelt.')
        } else {
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
          setUrlAnalyzed(true)
        }
      } else {
        setAnalysisError('Klarte ikke lese svaret fra AI. Prøv igjen.')
      }
    } catch (e) {
      clearTimeout(timeoutId)
      clearInterval(textTimer)
      if (!timedOut) setAnalysisError('Noe gikk galt. Prøv igjen.')
    }
    if (!timedOut) setUrlLoading(false)
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

  const goToAccess = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }

      const imageUrl =
        selectedImageSrc === 'suggested' && suggestedImageUrl
          ? suggestedImageUrl
          : imagePreviews[0] ?? null

      const extraImages = imagePreviews.slice(1)

      const { data: item, error } = await supabase
        .from('items')
        .insert({
          owner_id:      user.id,
          name:          name.trim(),
          description:   description.trim() || null,
          category:      categoryId,
          subcategories: subcategoryIds,
          location:      location.trim() || null,
          gender:        gender || null,
          size:          size || null,
          age_ranges:    ageRanges.length ? ageRanges : null,
          color:         color || null,
          image_url:     imageUrl,
          extra_images:  extraImages.length ? extraImages : null,
          available:     true,
        })
        .select('id')
        .single()

      if (error || !item?.id) {
        console.error('Insert failed:', error)
        setSaving(false)
        return
      }

      sessionStorage.removeItem(DRAFT_KEY)
      track(Events.ITEM_PUBLISHED, { category: categoryId })
      router.push(`/items/access?item=${item.id}&name=${encodeURIComponent(name.trim())}`)
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
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

        {/* ── OPPLASTINGSMODUS-VELGER (segmented slider) ── */}
        {(() => {
          // SVG icons per mode — designstandard: 1.6px stroke, rounded, teal palette
          const ICONS: Record<AddMode, React.ReactNode> = {
            manuell: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            ),
            lenke: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            ),
            bilde: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            ),
            finn: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            ),
            mail: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            ),
          }
          const LABELS: Record<AddMode, string> = {
            manuell: 'Manuell',
            lenke:   'Lenke',
            bilde:   'Bilde',
            finn:    'Finn',
            mail:    'Mail',
          }
          const MODES: AddMode[] = ['manuell', 'lenke', 'bilde', 'finn', 'mail']
          return (
            <div className="glass" style={{
              borderRadius: 14, padding: 4,
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3,
            }}>
              {MODES.map(m => {
                const active = addMode === m
                return (
                  <button
                    key={m}
                    onClick={() => setAddMode(m)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4,
                      padding: '8px 4px', borderRadius: 10,
                      border: 'none',
                      background: active ? 'var(--terra)' : 'transparent',
                      color: active ? 'white' : 'var(--terra-mid)',
                      fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'all 150ms ease',
                      boxShadow: active ? '0 1px 6px rgba(46,98,113,0.28)' : 'none',
                      fontSize: 10, fontWeight: active ? 600 : 400,
                      letterSpacing: '0.01em',
                      minWidth: 0,
                    }}>
                    {ICONS[m]}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      {LABELS[m]}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* ── MODUS-PANEL: Lenke ── */}
        {addMode === 'lenke' && (
          <div className="flex flex-col gap-3">
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
            {urlLoading && (
              <div className="glass rounded-2xl p-4 flex items-center gap-3" style={{ border: '0.5px solid rgba(46,98,113,0.15)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{analysisLoadingText}</p>
              </div>
            )}
            {urlAnalyzed && (
              <div className="glass" style={{ borderRadius: 12, padding: '10px 14px' }}>
                <span className="status-pill active">✓ Hentet – sjekk og juster under</span>
              </div>
            )}
            {analysisError && addMode === 'lenke' && (
              <div style={{ borderRadius: 12, padding: '12px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}>
                <p className="text-sm" style={{ color: '#b91c1c' }}>{analysisError}</p>
                <button onClick={() => setAnalysisError(null)}
                  style={{ marginTop: 8, fontSize: 12, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Prøv igjen
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODUS-PANEL: Bilde ── */}
        {addMode === 'bilde' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => analyzeFileInputRef.current?.click()}
              disabled={imageAnalyzing}
              className="glass w-full flex items-center gap-3 text-left disabled:opacity-50"
              style={{ borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(46,98,113,0.25)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--terra-dark)', marginBottom: 2 }}>
                  {imageAnalyzing ? 'Gjenkjenner…' : 'Ta bilde eller velg fra kamera'}
                </p>
                <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
                  AI gjenkjenner gjenstanden og fyller ut skjemaet – fungerer også på hele bokhyller
                </p>
              </div>
            </button>
            <input
              ref={analyzeFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAnalyzeImage}
              className="hidden"
            />
            {imageAnalyzing && (
              <div className="glass rounded-2xl p-4 flex items-center gap-3" style={{ border: '0.5px solid rgba(46,98,113,0.15)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>{analysisLoadingText}</p>
              </div>
            )}
            {imageAnalyzed && (
              <div className="glass" style={{ borderRadius: 12, padding: '10px 14px' }}>
                <span className="status-pill active">✓ Gjenkjent – sjekk og juster under</span>
              </div>
            )}
            {analysisError && addMode === 'bilde' && (
              <div style={{ borderRadius: 12, padding: '12px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}>
                <p className="text-sm" style={{ color: '#b91c1c' }}>{analysisError}</p>
                <button onClick={() => { setAnalysisError(null); analyzeFileInputRef.current?.click() }}
                  style={{ marginTop: 8, fontSize: 12, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Prøv igjen
                </button>
              </div>
            )}
            {shelfStep === 'loading' && (
              <div className="glass rounded-2xl p-4 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" style={{ flexShrink: 0 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Analyserer bokhyllen…</p>
              </div>
            )}
          </div>
        )}

        {/* ── MODUS-PANEL: Finn.no ── */}
        {addMode === 'finn' && (
          <div className="glass rounded-2xl p-5 flex flex-col gap-3" style={{ border: '1px solid var(--glass-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--terra-dark)' }}>Importer fra Finn.no</p>
            <p className="text-xs" style={{ color: 'var(--terra-mid)', lineHeight: 1.55 }}>
              Last opp skjermbilder av dine Finn.no-annonser – AI gjenkjenner produktene og drafter annonsene for deg.
            </p>
            <FinnImporter />
          </div>
        )}

        {/* ── MODUS-PANEL: Mail ── */}
        {addMode === 'mail' && (
          <div className="glass rounded-2xl p-5 flex flex-col gap-4" style={{ border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(46,98,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>📧</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--terra-dark)', marginBottom: 2 }}>Videresend ordrebekreftelse</p>
                <p className="text-xs" style={{ color: 'var(--terra-mid)', lineHeight: 1.5 }}>Vi gjenkjenner produktene og drafter annonsene automatisk</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(46,98,113,0.06)', borderRadius: 12,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--terra)', letterSpacing: '-0.01em', userSelect: 'all', flex: 1 }}>
                leggut@villageapp.no
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText('leggut@villageapp.no')}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20,
                  border: '1px solid var(--glass-border)', background: 'white',
                  color: 'var(--terra-mid)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>
                Kopier
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--terra-mid)', lineHeight: 1.65 }}>
              Videresend fra e-postadressen tilknyttet kontoen din
              {userEmail && (
                <> – <strong style={{ color: 'var(--terra-dark)' }}>{userEmail}</strong></>
              )}
              . Vi sender deg et varsel i appen når annonsene er klare til gjennomgang.
            </p>

            <div style={{
              background: 'rgba(46,98,113,0.04)', borderRadius: 10,
              padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
              <p className="text-xs" style={{ color: 'var(--terra-mid)', lineHeight: 1.6 }}>
                Fungerer med de fleste norske nettbutikker: Zalando, H&M, Stokke, Babyshop, Komplett og mer.
              </p>
            </div>
          </div>
        )}

        {/* ── Skjema vises kun etter vellykket analyse i bilde/lenke-modus ── */}
        {(addMode === 'bilde' || addMode === 'lenke') && !imageAnalyzed && !urlAnalyzed && (
          <div className="glass" style={{ borderRadius: 14, padding: '18px 16px', textAlign: 'center', border: '1px dashed rgba(46,98,113,0.2)' }}>
            <p className="text-sm" style={{ color: 'var(--terra-mid)', lineHeight: 1.6 }}>
              {addMode === 'bilde'
                ? 'Ta et bilde av gjenstanden for å fylle ut skjemaet automatisk'
                : 'Lim inn en lenke over for å hente produktinfo automatisk'}
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(46,98,113,0.45)' }}>
              Eller{' '}
              <button onClick={() => setAddMode('manuell')} style={{ color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                fyll ut manuelt
              </button>
            </p>
          </div>
        )}

        {((addMode !== 'bilde' && addMode !== 'lenke') || imageAnalyzed || urlAnalyzed) && (
        <>{/* ── KATEGORI ── */}
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

            {/* Hvilken bok er dette — kun for bøker */}
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

            {/* ALDER */}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setColor(c.id === color ? '' : c.id)}
                      title={c.label}
                      style={{
                        width: 30, height: 30,
                        borderRadius: '50%',
                        background: c.hex,
                        border: color === c.id ? '2.5px solid var(--terra)' : `2px solid ${c.border || 'transparent'}`,
                        transform: color === c.id ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s',
                        outline: c.id === 'hvit' ? '0.5px solid #ddd' : 'none',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                  {/* Velg egendefinert farge — pipette-ikon */}
                  <label
                    title="Velg farge"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: color.startsWith('#') ? color : 'white',
                      border: color.startsWith('#') ? '2.5px solid var(--terra)' : '1.5px dashed rgba(46,98,113,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      transform: color.startsWith('#') ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s',
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={color.startsWith('#') ? 'white' : 'var(--terra-mid)'}
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
                      <path d="M12 2a7 7 0 0 1 7 7c0 4-7 13-7 13S5 13 5 9a7 7 0 0 1 7-7z"/>
                      <circle cx="12" cy="9" r="2.5" fill={color.startsWith('#') ? 'white' : 'var(--terra-mid)'} stroke="none"/>
                    </svg>
                    <input
                      type="color"
                      value={color.startsWith('#') ? color : '#2E6271'}
                      onChange={e => setColor(e.target.value)}
                      style={{
                        position: 'absolute', inset: 0, opacity: 0,
                        width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0,
                      }}
                    />
                  </label>
                </div>
                {color.startsWith('#') && (
                  <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
                    Egendefinert farge: <span style={{ fontWeight: 600, color: 'var(--terra-dark)' }}>{color}</span>
                    <button onClick={() => setColor('')} style={{ marginLeft: 8, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>Fjern</button>
                  </p>
                )}
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

            {/* ── BILDER ── */}
            <div className="flex flex-col gap-3">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>
                  {imagePreviews.length > 0 || suggestedImageUrl ? 'Bilder' : 'Bilder *'}
                </p>
                <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
                  {imagePreviews.length}/{MAX_IMAGES}
                </p>
              </div>

              {/* Velg mellom eget og foreslått bilde */}
              {imagePreviews.length > 0 && suggestedImageUrl && (
                <div className="grid grid-cols-2 gap-3">
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

              {/* Horisontal bildescroller */}
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
                {imagePreviews.map((preview, i) => (
                  <div key={preview} style={{ position: 'relative', flexShrink: 0, width: 90, height: 90 }}>
                    <img
                      src={preview}
                      className="w-full h-full object-cover"
                      style={{ borderRadius: 12 }}
                      alt={`Bilde ${i + 1}`}
                    />
                    {i === 0 && (
                      <span
                        style={{
                          position: 'absolute', bottom: 4, left: 4,
                          background: 'rgba(0,0,0,0.52)', color: 'white',
                          fontSize: 9, padding: '2px 6px', borderRadius: 99,
                        }}>
                        Hoved
                      </span>
                    )}
                    {/* Flytt til venstre */}
                    {i > 0 && (
                      <button
                        onClick={() => moveImage(i, i - 1)}
                        style={{
                          position: 'absolute', top: 4, left: 4,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', border: 'none',
                          color: 'white', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>‹</button>
                    )}
                    {/* Slett */}
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)', border: 'none',
                        color: 'white', fontSize: 14, lineHeight: 1, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                  </div>
                ))}

                {/* Legg til bilder-knapp — vises alltid hvis under maks */}
                {imagePreviews.length < MAX_IMAGES && (
                  <button
                    onClick={() => {
                      // I bilde-modus: analyser hvis ingen bilder enda, ellers bare legg til
                      if (addMode === 'bilde' && imagePreviews.length === 0) {
                        analyzeFileInputRef.current?.click()
                      } else {
                        multiFileInputRef.current?.click()
                      }
                    }}
                    style={{
                      flexShrink: 0, width: 90, height: 90, borderRadius: 12,
                      border: '1px dashed rgba(46,98,113,0.35)',
                      background: 'white', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span style={{ fontSize: 9, color: 'var(--terra-mid)' }}>
                      {imagePreviews.length === 0 ? 'Legg til' : 'Flere'}
                    </span>
                  </button>
                )}
              </div>

              {/* Multi-fil-input — multiple + capture for iOS */}
              <input
                ref={multiFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={addMultipleImages}
                className="hidden"
              />
              {/* Analyse-input — kun én fil, brukes av bilde-modus */}
              {addMode !== 'bilde' && (
                <input
                  ref={analyzeFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAnalyzeImage}
                  className="hidden"
                />
              )}

              <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>
                Første bilde blir hovedbilde. Du kan legge til opptil {MAX_IMAGES} bilder. Hold og dra for å sortere.
              </p>
              {errors.images && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.images}</p>}
            </div>

            {/* NESTE */}
            <button onClick={goToAccess} disabled={saving} className="btn-primary w-full mt-2 disabled:opacity-50">
              Neste →
            </button>
          </>
        )}
      </>
      )}
      </div>
    </div>
  )
}
