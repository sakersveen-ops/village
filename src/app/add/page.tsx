'use client'
import { useEffect, useRef, useState } from 'react'
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
  title: string
  author: string
  description: string
  genre: string
  isbn: string
  image_url: string
  selected: boolean
}

export default function AddPage() {
  const [mode, setMode] = useState<'manual' | 'url' | 'shelf'>('manual')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [price, setPrice] = useState('')
  const [vippsNumber, setVippsNumber] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [shelfLoading, setShelfLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [books, setBooks] = useState<BookResult[]>([])
  const [shelfStep, setShelfStep] = useState<'upload' | 'results' | 'saving'>('upload')
  const [saveProgress, setSaveProgress] = useState(0)
  const shelfRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    console.log('fil:', file.name, file.type, file.size)
    alert(`Fil valgt: ${file.name}, type: ${file.type}, størrelse: ${file.size}`)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
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
            content: `Analyser denne URL-en og returner KUN et JSON-objekt (ingen annen tekst) med feltene: name, description, category (én av: barn/kjole/verktøy/bok/annet). URL: ${url}`
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
    } catch (e) {
      console.error(e)
    }
    setUrlLoading(false)
  }

  const handleShelfImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  console.log('fil valgt:', file.name, file.type, file.size)
  setShelfLoading(true)
  setShelfStep('upload')

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
            { type: 'text', text: 'Se på bokhyllen. List opp alle bøkene du kan se. Returner KUN et JSON-array med objekter: [{title, author}]. Gjett forfatter hvis du ikke er sikker.' }
          ]
        }]
      })
    })
    const claudeData = await claudeRes.json()
    const claudeText = claudeData.content?.[0]?.text || '[]'
    const cleanClaude = claudeText.replace(/```json|```/g, '').trim()
    const recognized: { title: string; author: string }[] = JSON.parse(cleanClaude)

    const results: BookResult[] = []
    for (const book of recognized.slice(0, 15)) {
      try {
        const q = encodeURIComponent(`${book.title} ${book.author}`)
        const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
        const gbData = await gbRes.json()
        const vol = gbData.items?.[0]?.volumeInfo
        const isbn = vol?.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier
          || vol?.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier
          || ''
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
  } catch (e) {
    console.error(e)
  }
  setShelfLoading(false)
}

  const toggleBook = (i: number) => {
    setBooks(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b))
  }

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
    const { data: watches } = await supabase
      .from('item_watches')
      .select('*')
      .neq('user_id', userId)

    if (!watches || watches.length === 0) return

    const matches = watches.filter(w => {
      const q = w.query.toLowerCase()
      const nameMatch = item.name?.toLowerCase().includes(q)
      const descMatch = item.description?.toLowerCase().includes(q)
      if (!nameMatch && !descMatch) return false
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
    if (imageFile) {
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
      price: price ? parseInt(price) : null,
      vipps_number: vippsNumber || null,
      image_url: image_url || null,
      available: true,
    }).select().single()

    await matchWatches(item, user.id)
    router.push(`/items/access?item=${item?.id}`)
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)

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
            <div
              key={i}
              onClick={() => toggleBook(i)}
              className={`bg-white rounded-2xl p-4 flex gap-3 shadow-sm cursor-pointer transition-all ${book.selected ? 'ring-2 ring-[#C4673A]' : 'opacity-50'}`}
            >
              {book.image_url ? (
                <img src={book.image_url} alt={book.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 bg-[#E8DDD0] rounded-lg flex items-center justify-center text-xl flex-shrink-0">📚</div>
              )}
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
          <button
            onClick={saveBooks}
            disabled={books.filter(b => b.selected).length === 0}
            className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2"
          >
            Legg ut {books.filter(b => b.selected).length} bøker
          </button>
        </div>
      </div>
    )
  }

  // ── BOKHYLLE: lagrer ──
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
            { id: 'manual', label: '✏️ Manuelt' },
            { id: 'url', label: '🔗 Fra URL' },
            { id: 'shelf', label: '📚 Bokhylle' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors flex-shrink-0 ${
                mode === m.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">

        {/* URL-modus */}
        {mode === 'url' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#9C7B65]">Lim inn en lenke til gjenstanden, så fyller vi ut skjemaet automatisk.</p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
              />
              <button
                onClick={analyzeUrl}
                disabled={urlLoading || !url.trim()}
                className="bg-[#C4673A] text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                {urlLoading ? '…' : 'Hent'}
              </button>
            </div>
            {name && (
              <div className="bg-[#EEF4F0] rounded-2xl px-4 py-3">
                <p className="text-xs text-[#4A7C59] font-medium mb-1">✓ Hentet fra URL – fyll ut resten under</p>
              </div>
            )}
          </div>
        )}

        {/* Bokhylle-modus */}
        {mode === 'shelf' && shelfStep === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#9C7B65]">Ta et bilde av bokhyllen din. Vi gjenkjenner titlene og henter info automatisk.</p>
            {shelfLoading ? (
              <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                <div className="text-3xl animate-pulse">📚</div>
                <p className="text-sm text-[#9C7B65]">Analyserer bokhyllen…</p>
              </div>
            ) : (
              <button
                onClick={() => shelfRef.current?.click()}
                className="bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl p-8 text-center"
              >
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-[#6B4226] font-medium">Velg bilde av bokhyllen</p>
                <p className="text-xs text-[#9C7B65] mt-1">Kamera eller bildebibliotek</p>
              </button>
            )}
            <input ref={shelfRef} type="file" accept="image/*" onChange={handleShelfImage} className="hidden" />
          </div>
        )}

        {/* Manuelt skjema (vises også etter URL-analyse) */}
        {(mode === 'manual' || mode === 'url') && (
          <>
            {/* Bilde */}
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

            {/* Navn */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Hva vil du låne ut?"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
              />
            </div>

            {/* Beskrivelse */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Beskrivelse</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Størrelse, tilstand, merke…"
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
              />
            </div>

            {/* Kategori */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Kategori *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setSubcategory('') }}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                      category === cat.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Underkategori */}
            {selectedCat && selectedCat.subcategories.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Underkategori</label>
                <div className="flex flex-wrap gap-2">
                  {selectedCat.subcategories.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setSubcategory(subcategory === sub ? '' : sub)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        subcategory === sub ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pris */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Pris (kr/dag)</label>
                <input
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  type="number"
                  placeholder="La stå for gratis"
                  className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Vipps-nr</label>
                <input
                  value={vippsNumber}
                  onChange={e => setVippsNumber(e.target.value)}
                  type="tel"
                  placeholder="Kun ved pris"
                  className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
                />
              </div>
            </div>

            <button
              onClick={saveItem}
              disabled={saving || !name.trim() || !category}
              className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2"
            >
              {saving ? 'Lagrer…' : 'Legg ut →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}