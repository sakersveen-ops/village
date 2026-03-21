'use client'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { id: 'barn', label: 'Barn', emoji: '🧸', subcategories: ['Spise', 'Leke', 'Tur', 'Stelle', 'Sove', 'Bade', 'Klær'] },
  { id: 'kjole', label: 'Kjoler', emoji: '👗', subcategories: [] },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧', subcategories: [] },
  { id: 'bok', label: 'Bøker', emoji: '📚', subcategories: [] },
  { id: 'annet', label: 'Annet', emoji: '📦', subcategories: [] },
]

type BookResult = {
  title: string; author: string; description: string
  genre: string; isbn: string; image_url: string; selected: boolean
}

const ModeIcons = {
  manual: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  url: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  shelf: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="4" height="18" rx="1" />
      <rect x="8" y="6" width="4" height="15" rx="1" />
      <rect x="14" y="4" width="4" height="17" rx="1" />
      <line x1="2" y1="21" x2="22" y2="21" />
    </svg>
  ),
}

const MODES = [
  { id: 'manual', label: 'Manuelt',  icon: ModeIcons.manual },
  { id: 'image',  label: 'Fra bilde', icon: ModeIcons.image  },
  { id: 'url',    label: 'URL',       icon: ModeIcons.url    },
  { id: 'shelf',  label: 'Bokhylle', icon: ModeIcons.shelf  },
]

function AddPageInnerComponent() {
  const [mode, setMode] = useState<'manual' | 'url' | 'image' | 'shelf'>('manual')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [location, setLocation] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [suggestedImageUrl, setSuggestedImageUrl] = useState('')
  const [selectedImage, setSelectedImage] = useState<'own' | 'suggested'>('own')
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [imageAnalyzing, setImageAnalyzing] = useState(false)
  const [imageAnalyzed, setImageAnalyzed] = useState(false)
  const [shelfLoading, setShelfLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [books, setBooks] = useState<BookResult[]>([])
  const [shelfStep, setShelfStep] = useState<'upload' | 'results' | 'saving'>('upload')
  const [saveProgress, setSaveProgress] = useState(0)
  const shelfRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('location').eq('id', user.id).single()
      if (prof?.location) setLocation(prof.location)

      const paramName     = searchParams.get('name')
      const paramCategory = searchParams.get('category')
      const paramImageUrl = searchParams.get('image_url')

      if (paramName)     setName(paramName)
      if (paramCategory) setCategory(paramCategory)
      if (paramImageUrl) {
        setImagePreview(paramImageUrl)
        setSuggestedImageUrl(paramImageUrl)
        setSelectedImage('suggested')
      }
    }
    load()
  }, [])

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))

    if (mode === 'image') {
      setImageAnalyzing(true)
      setSuggestedImageUrl('')
      setImageAnalyzed(false)

      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej(new Error('Read failed'))
        r.readAsDataURL(file)
      })

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
                { type: 'text', text: `Analyser dette bildet av en gjenstand og returner KUN et JSON-objekt med feltene:
- name: kort navn på gjenstanden (norsk)
- description: kort beskrivelse inkl. merke, størrelse, tilstand hvis synlig (norsk, 1-2 setninger)
- category: én av barn/kjole/verktøy/bok/annet
- searchQuery: et godt engelsk søkeord for å finne et produktbilde av denne gjenstanden på nettet (f.eks. "Bosch drill GSB 18V" eller "H&M floral dress")
- confident: true/false om du er sikker på hva gjenstanden er

Returner KUN JSON, ingen annen tekst.` }
              ]
            }]
          })
        })
        const data = await res.json()
        const text = data.content?.[0]?.text || ''
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)

        if (parsed.confident === false) {
          setImageAnalyzing(false)
          setImageAnalyzed(false)
          return
        }

        setName(parsed.name || '')
        setDescription(parsed.description || '')
        setCategory(parsed.category || '')

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
                setSelectedImage('suggested')
              }
            }
          } catch {
            // Produktbilde feilet – ikke kritisk
          }
        }

        setImageAnalyzed(true)
      } catch {
        setImageAnalyzed(false)
      }
      setImageAnalyzing(false)
    }
  }

  const analyzeUrl = async () => {
    if (!url.trim()) return
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
            content: `Analyser denne URL-en og returner KUN et JSON-objekt med feltene: name, description, category (én av: barn/kjole/verktøy/bok/annet). URL: ${url}`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setName(parsed.name || '')
      setDescription(parsed.description || '')
      setCategory(parsed.category || '')
    } catch (e) { console.error(e) }
    setUrlLoading(false)
  }

  const handleShelfImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setShelfLoading(true)

    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(file)
    })

    try {
      const claudeRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              { type: 'text', text: 'Se på bokhyllen. List opp alle bøkene du kan se. Returner KUN et JSON-array: [{title, author}]. Gjett forfatter hvis du ikke er sikker.' }
            ]
          }]
        })
      })
      const claudeData = await claudeRes.json()
      const rawText = claudeData.content?.[0]?.text || '[]'
      const cleanClaude = rawText.replace(/```json|```/g, '').trim()
      const recognized: { title: string; author: string }[] = JSON.parse(cleanClaude)

      const results: BookResult[] = []
      for (const book of recognized.slice(0, 15)) {
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
      setBooks(results)
      setShelfStep('results')
    } catch (e) { console.error(e) }
    setShelfLoading(false)
  }

  const toggleBook = (i: number) =>
    setBooks(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b))

  const saveBooks = async () => {
    setShelfStep('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const selected = books.filter(b => b.selected)
    let done = 0
    for (const book of selected) {
      await supabase.from('items').insert({
        owner_id: user.id,
        name: book.title,
        description: [
          book.author ? `Forfatter: ${book.author}` : '',
          book.genre ? `Sjanger: ${book.genre}` : '',
          book.isbn ? `ISBN: ${book.isbn}` : '',
          book.description ? `\n${book.description}` : '',
        ].filter(Boolean).join('\n'),
        category: 'bok',
        image_url: book.image_url || null,
        available: true,
        location: location || null,
      })
      done++
      setSaveProgress(Math.round((done / selected.length) * 100))
    }
    router.push('/')
  }

  const matchWatches = async (item: any, userId: string) => {
    const supabase = createClient()
    const { data: watches } = await supabase.from('item_watches').select('*').neq('user_id', userId)
    if (!watches || watches.length === 0) return
    const matches = watches.filter(w => {
      const q = w.query.toLowerCase()
      if (!item.name?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false
      if (w.category && w.category !== item.category) return false
      if (w.max_price && item.price && item.price > w.max_price) return false
      return true
    })
    for (const watch of matches) {
      await supabase.from('notifications').insert({
        user_id: watch.user_id,
        type: 'watch_match',
        title: '🔍 Nytt treff på søkevarsel',
        body: `"${item.name}" matcher søket ditt: "${watch.query}"`,
      })
    }
  }

  const saveItem = async () => {
    if (!name.trim() || !category) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    let image_url = ''

    if (selectedImage === 'suggested' && suggestedImageUrl) {
      image_url = suggestedImageUrl
    } else if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `items/${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('item-images').upload(path, imageFile)
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      image_url = data.publicUrl
    }

    const { data: item, error: insertError } = await supabase.from('items').insert({
      owner_id: user.id,
      name,
      description,
      category,
      image_url: image_url || null,
      available: true,
      location: location || null,
    }).select().single()

    if (insertError || !item?.id) {
      console.error('Insert failed:', insertError)
      setSaving(false)
      return
    }

    await matchWatches(item, user.id)
    router.push(`/items/access?item=${item.id}&name=${encodeURIComponent(name)}`)
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)
  const canSubmit = name.trim() && category

  if (mode === 'shelf' && shelfStep === 'results') {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="page-header glass sticky top-0 z-10 px-4 pt-4 pb-4" style={{ borderRadius: '0 0 20px 20px' }}>
          <button onClick={() => { setShelfStep('upload'); setBooks([]) }}
            className="btn-glass text-sm mb-2 block" style={{ color: 'var(--terra)' }}>
            ← Tilbake
          </button>
          <h1 className="font-display font-bold" style={{ fontSize: 20, color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Velg bøker å legge ut
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>
            {books.filter(b => b.selected).length} av {books.length} valgt
          </p>
        </div>
        <div className="px-4 pt-4 flex flex-col gap-3">
          {books.map((book, i) => (
            <div key={i} onClick={() => toggleBook(i)}
              className={`glass rounded-2xl p-4 flex gap-3 cursor-pointer transition-all ${book.selected ? 'ring-2' : 'opacity-50'}`}
              style={book.selected ? { '--tw-ring-color': 'var(--terra)' } as React.CSSProperties : {}}>
              {book.image_url
                ? <img src={book.image_url} alt={book.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                : <div className="w-12 h-16 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'rgba(196,103,58,0.12)' }}>📚</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--terra-dark)' }}>{book.title}</p>
                {book.author    && <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{book.author}</p>}
                {book.genre     && <p className="text-xs mt-0.5" style={{ color: 'var(--terra)' }}>{book.genre}</p>}
                {book.isbn      && <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>ISBN: {book.isbn}</p>}
                {book.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--terra-dark)' }}>{book.description}</p>}
              </div>
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: book.selected ? 'var(--terra)' : 'transparent', border: book.selected ? 'none' : '2px solid rgba(196,103,58,0.25)' }}>
                {book.selected && <span className="text-white text-xs">✓</span>}
              </div>
            </div>
          ))}
          <button onClick={saveBooks} disabled={books.filter(b => b.selected).length === 0}
            className="btn-primary w-full mt-2 disabled:opacity-50">
            Legg ut {books.filter(b => b.selected).length} bøker
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'shelf' && shelfStep === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">📚</div>
        <p className="font-bold mb-2" style={{ fontSize: 18, color: 'var(--terra-dark)' }}>Lagrer bøker…</p>
        <div className="w-full max-w-xs rounded-full h-2 mt-2" style={{ background: 'rgba(196,103,58,0.15)' }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${saveProgress}%`, background: 'var(--terra)' }} />
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--terra-mid)' }}>{saveProgress}%</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="page-header glass sticky top-0 z-10 px-4 pb-3"
        style={{ borderRadius: '0 0 20px 20px', paddingTop: 12, display: 'flex', flexDirection: 'column' }}>
        <h1 className="font-display font-bold mb-3"
          style={{ fontSize: 22, color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          Hvordan vil du legge ut gjenstanden?
        </h1>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                mode === m.id ? 'pill active' : 'pill'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        {mode === 'image' && !imagePreview && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
              Ta et bilde av gjenstanden, så gjenkjenner vi den automatisk og finner et ryddig produktbilde.
            </p>
            <label className="cursor-pointer">
              <div className="glass rounded-2xl p-10 text-center border-dashed">
                <div className="flex justify-center mb-3">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--terra-mid)' }}>
                    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Ta bilde eller velg fra bibliotek</p>
              </div>
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>
        )}

        {mode === 'image' && imagePreview && imageAnalyzing && (
          <div className="flex flex-col gap-3">
            <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
            <div className="glass rounded-2xl p-5 text-center flex flex-col items-center gap-2">
              <div className="text-2xl animate-pulse">🔍</div>
              <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Gjenkjenner gjenstanden…</p>
            </div>
          </div>
        )}

        {mode === 'image' && imagePreview && !imageAnalyzing && !imageAnalyzed && name === '' && (
          <div className="flex flex-col gap-3">
            <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
            <div className="glass rounded-2xl p-4 text-center" style={{ border: '1px solid rgba(196,103,58,0.3)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--terra)' }}>Kunne ikke gjenkjenne gjenstanden</p>
              <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>Fyll inn informasjonen manuelt under</p>
            </div>
          </div>
        )}

        {mode === 'image' && imagePreview && imageAnalyzed && suggestedImageUrl && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Velg bilde</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSelectedImage('own')}
                className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImage === 'own' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                <img src={imagePreview} className="w-full h-32 object-cover" />
                <div className="py-2 text-xs font-medium text-center"
                  style={{ background: selectedImage === 'own' ? 'var(--terra)' : 'rgba(196,103,58,0.08)', color: selectedImage === 'own' ? 'white' : 'var(--terra-dark)' }}>
                  {selectedImage === 'own' ? '✓ Ditt bilde' : 'Ditt bilde'}
                </div>
              </button>
              <button onClick={() => setSelectedImage('suggested')}
                className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImage === 'suggested' ? 'border-[var(--terra)]' : 'border-transparent'}`}>
                <img src={suggestedImageUrl} className="w-full h-32 object-cover"
                  onError={() => setSuggestedImageUrl('')} />
                <div style={{ background: selectedImage === 'suggested' ? 'var(--terra)' : 'rgba(196,103,58,0.08)', color: selectedImage === 'suggested' ? 'white' : 'var(--terra-dark)' }}
                  className="py-2 text-xs font-medium text-center">
                  {selectedImage === 'suggested' ? '✓ Produktbilde' : 'Produktbilde'}
                </div>
              </button>
            </div>
          </div>
        )}

        {mode === 'image' && imagePreview && imageAnalyzed && !suggestedImageUrl && (
          <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
        )}

        {mode === 'url' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
              Lim inn en lenke til gjenstanden, så fyller vi ut skjemaet automatisk.
            </p>
            <div className="flex gap-2">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
                className="glass flex-1 outline-none text-sm"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)' }} />
              <button onClick={analyzeUrl} disabled={urlLoading || !url.trim()}
                className="btn-primary disabled:opacity-50" style={{ padding: '12px 16px' }}>
                {urlLoading ? '…' : 'Hent'}
              </button>
            </div>
            {name && (
              <div className="glass" style={{ borderRadius: 16, padding: '12px 16px' }}>
                <span className="status-pill active">✓ Hentet fra URL – fyll ut resten under</span>
              </div>
            )}
          </div>
        )}

        {mode === 'shelf' && shelfStep === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
              Ta et bilde av bokhyllen din. Vi gjenkjenner titlene og henter info automatisk.
            </p>
            {shelfLoading ? (
              <div className="glass rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                <div className="text-3xl animate-pulse">📚</div>
                <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Analyserer bokhyllen…</p>
              </div>
            ) : (
              <button onClick={() => shelfRef.current?.click()}
                className="glass rounded-2xl p-8 text-center border-dashed w-full">
                <div className="flex justify-center mb-3">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--terra-mid)' }}>
                    <rect x="2" y="3" width="4" height="18" rx="1" />
                    <rect x="8" y="6" width="4" height="15" rx="1" />
                    <rect x="14" y="4" width="4" height="17" rx="1" />
                    <line x1="2" y1="21" x2="22" y2="21" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Velg bilde av bokhyllen</p>
                <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>Kamera eller bildebibliotek</p>
              </button>
            )}
            <input ref={shelfRef} type="file" accept="image/*" onChange={handleShelfImage} className="hidden" />
          </div>
        )}

        {(mode === 'manual' || mode === 'url' || (mode === 'image' && (imageAnalyzed || (!imageAnalyzing && imagePreview)))) && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Kategori *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setCategory(cat.id); setSubcategory('') }}
                    className={`pill ${category === cat.id ? 'active' : ''} text-sm`}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedCat && selectedCat.subcategories.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Underkategori</label>
                <div className="flex flex-wrap gap-2">
                  {selectedCat.subcategories.map(sub => (
                    <button key={sub} onClick={() => setSubcategory(subcategory === sub ? '' : sub)}
                      className={`pill ${subcategory === sub ? 'active' : ''} text-sm`}>
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {imageAnalyzed && (
              <div className="glass" style={{ borderRadius: 16, padding: '12px 16px' }}>
                <span className="status-pill active">✓ Gjenkjent – sjekk og juster under</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Tittel *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Hva vil du låne ut?"
                className="glass outline-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Beskrivelse</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Størrelse, tilstand, merke…"
                className="glass outline-none resize-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--terra-mid)' }}>Sted</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Hvor hentes gjenstanden?"
                className="glass outline-none"
                style={{ borderRadius: 12, padding: '12px 16px', color: 'var(--terra-dark)' }} />
            </div>

            {(mode === 'manual' || mode === 'url') && (
              <div>
                <label className="text-xs font-medium uppercase tracking-wide block mb-2" style={{ color: 'var(--terra-mid)' }}>Bilde</label>
                <label className="cursor-pointer block">
                  {imagePreview ? (
                    <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
                  ) : (
                    <div className="glass w-full rounded-2xl flex flex-col items-center justify-center gap-2 border-dashed"
                      style={{ height: 144 }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--terra-mid)' }}>
                        <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Legg til bilde</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                </label>
              </div>
            )}

            <button onClick={saveItem} disabled={saving || !canSubmit}
              className="btn-primary w-full mt-2 disabled:opacity-50">
              {saving ? 'Lagrer…' : 'Neste →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const AddPageInner = dynamic(() => Promise.resolve(AddPageInnerComponent), { ssr: false })

export default function AddPage() {
  return <AddPageInner />
}
