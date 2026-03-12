'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

export default function AddPage() {
  const [mode, setMode] = useState<'manual' | 'url' | 'image' | 'shelf'>('manual')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
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

        // Søk etter produktbilde
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
    if (!user) return
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
    if (!user) return

    let image_url = ''

    // Bruk valgt bilde
    if (selectedImage === 'suggested' && suggestedImageUrl) {
      image_url = suggestedImageUrl
    } else if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `items/${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('item-images').upload(path, imageFile)
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      image_url = data.publicUrl
    }

    const { data: item } = await supabase.from('items').insert({
      owner_id: user.id,
      name,
      description,
      category,
      subcategory: subcategory || null,
      image_url: image_url || null,
      available: true,
    }).select().single()

    await matchWatches(item, user.id)
    router.push(`/items/access?item=${item?.id}`)
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)
  const canSubmit = name.trim() && category

  // ── BOKHYLLE: resultater ──
  if (mode === 'shelf' && shelfStep === 'results') {
    return (
      <div className="max-w-lg mx-auto pb-24">
        <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
          <button onClick={() => { setShelfStep('upload'); setBooks([]) }} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
          <h1 className="text-xl font-bold text-[#2C1A0E]">Velg bøker å legge ut</h1>
          <p className="text-xs text-[#9C7B65] mt-1">{books.filter(b => b.selected).length} av {books.length} valgt</p>
        </div>
        <div className="px-4 pt-4 flex flex-col gap-3">
          {books.map((book, i) => (
            <div key={i} onClick={() => toggleBook(i)}
              className={`bg-white rounded-2xl p-4 flex gap-3 shadow-sm cursor-pointer transition-all ${book.selected ? 'ring-2 ring-[#C4673A]' : 'opacity-50'}`}>
              {book.image_url
                ? <img src={book.image_url} alt={book.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                : <div className="w-12 h-16 bg-[#E8DDD0] rounded-lg flex items-center justify-center text-xl flex-shrink-0">📚</div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#2C1A0E] text-sm leading-tight">{book.title}</p>
                {book.author && <p className="text-xs text-[#9C7B65] mt-0.5">{book.author}</p>}
                {book.genre && <p className="text-xs text-[#C4673A] mt-0.5">{book.genre}</p>}
                {book.isbn && <p className="text-xs text-[#9C7B65] mt-0.5">ISBN: {book.isbn}</p>}
                {book.description && <p className="text-xs text-[#6B4226] mt-1 line-clamp-2">{book.description}</p>}
              </div>
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${book.selected ? 'bg-[#C4673A]' : 'border-2 border-[#E8DDD0]'}`}>
                {book.selected && <span className="text-white text-xs">✓</span>}
              </div>
            </div>
          ))}
          <button onClick={saveBooks} disabled={books.filter(b => b.selected).length === 0}
            className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2">
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
        <p className="text-lg font-bold text-[#2C1A0E] mb-2">Lagrer bøker…</p>
        <div className="w-full max-w-xs bg-[#E8DDD0] rounded-full h-2 mt-2">
          <div className="bg-[#C4673A] h-2 rounded-full transition-all" style={{ width: `${saveProgress}%` }} />
        </div>
        <p className="text-sm text-[#9C7B65] mt-2">{saveProgress}%</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-2 block">← Tilbake</button>
        <h1 className="text-xl font-bold text-[#2C1A0E]">Legg ut noe</h1>
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {[
            { id: 'image', label: '📷 Fra bilde' },
            { id: 'url', label: '🔗 Fra URL' },
            { id: 'shelf', label: '📚 Bokhylle' },
            { id: 'manual', label: '✏️ Manuelt' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors flex-shrink-0 ${
                mode === m.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">

        {/* Fra bilde */}
        {mode === 'image' && !imagePreview && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#9C7B65]">Ta et bilde av gjenstanden, så gjenkjenner vi den automatisk og finner et ryddig produktbilde.</p>
            <label className="cursor-pointer">
              <div className="bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl p-10 text-center">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-[#6B4226] font-medium">Ta bilde eller velg fra bibliotek</p>
              </div>
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>
        )}

        {/* Analyserer */}
        {mode === 'image' && imagePreview && imageAnalyzing && (
          <div className="flex flex-col gap-3">
            <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
            <div className="bg-white rounded-2xl p-5 text-center flex flex-col items-center gap-2 shadow-sm">
              <div className="text-2xl animate-pulse">🔍</div>
              <p className="text-sm text-[#6B4226] font-medium">Gjenkjenner gjenstanden…</p>
            </div>
          </div>
        )}

        {/* Ikke gjenkjent */}
        {mode === 'image' && imagePreview && !imageAnalyzing && !imageAnalyzed && name === '' && (
          <div className="flex flex-col gap-3">
            <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
            <div className="bg-[#FFF0E6] rounded-2xl p-4 text-center">
              <p className="text-sm font-medium text-[#C4673A]">Kunne ikke gjenkjenne gjenstanden</p>
              <p className="text-xs text-[#9C7B65] mt-1">Fyll inn informasjonen manuelt under</p>
            </div>
          </div>
        )}

        {/* Bildevalg etter gjenkjenning */}
        {mode === 'image' && imagePreview && imageAnalyzed && suggestedImageUrl && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Velg bilde</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSelectedImage('own')}
                className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImage === 'own' ? 'border-[#C4673A]' : 'border-transparent'}`}>
                <img src={imagePreview} className="w-full h-32 object-cover" />
                <div className={`py-2 text-xs font-medium text-center ${selectedImage === 'own' ? 'bg-[#C4673A] text-white' : 'bg-white text-[#6B4226]'}`}>
                  {selectedImage === 'own' ? '✓ Ditt bilde' : 'Ditt bilde'}
                </div>
              </button>
              <button onClick={() => setSelectedImage('suggested')}
                className={`rounded-2xl overflow-hidden border-2 transition-colors ${selectedImage === 'suggested' ? 'border-[#C4673A]' : 'border-transparent'}`}>
                <img src={suggestedImageUrl} className="w-full h-32 object-cover"
                  onError={() => setSuggestedImageUrl('')} />
                <div className={`py-2 text-xs font-medium text-center ${selectedImage === 'suggested' ? 'bg-[#C4673A] text-white' : 'bg-white text-[#6B4226]'}`}>
                  {selectedImage === 'suggested' ? '✓ Produktbilde' : 'Produktbilde'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Eget bilde uten produktbilde */}
        {mode === 'image' && imagePreview && imageAnalyzed && !suggestedImageUrl && (
          <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
        )}

        {/* URL-modus */}
        {mode === 'url' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#9C7B65]">Lim inn en lenke til gjenstanden, så fyller vi ut skjemaet automatisk.</p>
            <div className="flex gap-2">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
                className="flex-1 bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm" />
              <button onClick={analyzeUrl} disabled={urlLoading || !url.trim()}
                className="bg-[#C4673A] text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50">
                {urlLoading ? '…' : 'Hent'}
              </button>
            </div>
            {name && (
              <div className="bg-[#EEF4F0] rounded-2xl px-4 py-3">
                <p className="text-xs text-[#4A7C59] font-medium">✓ Hentet fra URL – fyll ut resten under</p>
              </div>
            )}
          </div>
        )}

        {/* Bokhylle */}
        {mode === 'shelf' && shelfStep === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#9C7B65]">Ta et bilde av bokhyllen din. Vi gjenkjenner titlene og henter info automatisk.</p>
            {shelfLoading ? (
              <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                <div className="text-3xl animate-pulse">📚</div>
                <p className="text-sm text-[#9C7B65]">Analyserer bokhyllen…</p>
              </div>
            ) : (
              <button onClick={() => shelfRef.current?.click()}
                className="bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl p-8 text-center">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-[#6B4226] font-medium">Velg bilde av bokhyllen</p>
                <p className="text-xs text-[#9C7B65] mt-1">Kamera eller bildebibliotek</p>
              </button>
            )}
            <input ref={shelfRef} type="file" accept="image/*" onChange={handleShelfImage} className="hidden" />
          </div>
        )}

        {/* Skjema (manual, url, image etter analyse) */}
        {(mode === 'manual' || mode === 'url' || (mode === 'image' && (imageAnalyzed || (!imageAnalyzing && imagePreview)))) && (
          <>
            {/* Bilde – kun manual og url */}
            {(mode === 'manual' || mode === 'url') && (
              <div>
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide block mb-2">Bilde</label>
                <label className="cursor-pointer block">
                  {imagePreview ? (
                    <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
                  ) : (
                    <div className="w-full h-36 bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">📷</span>
                      <span className="text-xs text-[#9C7B65]">Legg til bilde</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                </label>
              </div>
            )}

            {imageAnalyzed && (
              <div className="bg-[#EEF4F0] rounded-2xl px-4 py-3">
                <p className="text-xs text-[#4A7C59] font-medium">✓ Gjenkjent – sjekk og juster under</p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Hva vil du låne ut?"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Beskrivelse</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Størrelse, tilstand, merke…"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Kategori *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setCategory(cat.id); setSubcategory('') }}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                      category === cat.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                    }`}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedCat && selectedCat.subcategories.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Underkategori</label>
                <div className="flex flex-wrap gap-2">
                  {selectedCat.subcategories.map(sub => (
                    <button key={sub} onClick={() => setSubcategory(subcategory === sub ? '' : sub)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        subcategory === sub ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                      }`}>
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={saveItem} disabled={saving || !canSubmit}
              className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2">
              {saving ? 'Lagrer…' : 'Neste →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
