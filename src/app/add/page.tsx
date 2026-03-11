'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { id: 'barn', label: 'Barn', emoji: '🧸' },
  { id: 'kjole', label: 'Kjoler', emoji: '👗' },
  { id: 'verktøy', label: 'Verktøy', emoji: '🔧' },
  { id: 'bok', label: 'Bøker', emoji: '📚' },
  { id: 'annet', label: 'Annet', emoji: '📦' },
]

const BARN_SUBCATEGORIES = ['Spise', 'Leke', 'Tur', 'Stelle', 'Sove', 'Bade', 'Klær']

type BookCandidate = {
  title: string
  author: string
  image_url: string
  selected: boolean
}

type Mode = 'choose' | 'manual' | 'url' | 'bookshelf'

export default function AddPage() {
  const [mode, setMode] = useState<Mode>('choose')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('annet')
  const [subcategory, setSubcategory] = useState('')
  const [price, setPrice] = useState('')
  const [vipps, setVipps] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)

  // URL-modus
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlFetched, setUrlFetched] = useState(false)

  // Bokhylle-modus
  const [shelfImage, setShelfImage] = useState<File | null>(null)
  const [shelfPreview, setShelfPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [books, setBooks] = useState<BookCandidate[]>([])
  const [savingBooks, setSavingBooks] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const shelfRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleShelfImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setShelfImage(file)
    setShelfPreview(URL.createObjectURL(file))
  }

  // URL-gjenkjenning via Claude
  const fetchFromUrl = async () => {
    if (!url.trim()) return
    setUrlLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Fra denne URL-en: ${url}
            
Prøv å gjette hva slags produkt dette er basert på URL-en og domenet.
Svar KUN med et JSON-objekt, ingen annen tekst:
{
  "name": "produktnavn",
  "description": "kort beskrivelse 1-2 setninger",
  "category": "barn|kjole|verktøy|bok|annet"
}`
          }]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setName(parsed.name || '')
      setDescription(parsed.description || '')
      setCategory(parsed.category || 'annet')
      setUrlFetched(true)
    } catch (err) {
      console.error(err)
    }
    setUrlLoading(false)
  }

  // Bokhylle-skanning via Claude + Google Books
  const scanBookshelf = async () => {
    if (!shelfImage) return
    setScanning(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej(new Error('Read failed'))
        r.readAsDataURL(shelfImage)
      })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: shelfImage.type, data: base64 }
              },
              {
                type: 'text',
                text: `Se på dette bildet av en bokhylle. List opp alle bøkene du kan lese tittelen på.
Svar KUN med et JSON-array, ingen annen tekst:
[{"title": "tittel", "author": "forfatter eller ukjent"}]`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const recognized: { title: string; author: string }[] = JSON.parse(clean)

      // Hent fra Google Books
      const candidates: BookCandidate[] = []
      for (const book of recognized.slice(0, 12)) {
        try {
          const q = encodeURIComponent(`${book.title} ${book.author}`)
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
          const gdata = await res.json()
          const vol = gdata.items?.[0]?.volumeInfo
          candidates.push({
            title: vol?.title || book.title,
            author: vol?.authors?.[0] || book.author,
            image_url: vol?.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
            selected: true,
          })
        } catch {
          candidates.push({ title: book.title, author: book.author, image_url: '', selected: true })
        }
      }
      setBooks(candidates)
    } catch (err) {
      console.error(err)
    }
    setScanning(false)
  }

  const toggleBook = (i: number) => {
    setBooks(prev => prev.map((b, idx) => idx === i ? { ...b, selected: !b.selected } : b))
  }

  const saveBooks = async () => {
    setSavingBooks(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const selected = books.filter(b => b.selected)
    for (const book of selected) {
      await supabase.from('items').insert({
        owner_id: user.id,
        name: book.title,
        description: `Forfatter: ${book.author}`,
        category: 'bok',
        image_url: book.image_url,
        available: true,
      })
    }
    router.push('/profile')
  }

  // Lagre enkelt item
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    await supabase.from('items').insert({
      owner_id: user.id,
      name,
      description,
      category,
      subcategory: subcategory || null,
      image_url,
      available: true,
      price: price ? parseInt(price) : null,
      vipps_number: vipps || null,
    })

    router.push('/profile')
  }

  // ── VELG MODUS ──
  if (mode === 'choose') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 pb-24">
        <button onClick={() => router.back()} className="text-[#C4673A] mb-6 text-sm">← Tilbake</button>
        <h1 className="text-2xl font-bold text-[#2C1A0E] mb-2">Legg ut gjenstand</h1>
        <p className="text-sm text-[#9C7B65] mb-8">Hvordan vil du legge til?</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setMode('manual')}
            className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm text-left"
          >
            <span className="text-3xl">✏️</span>
            <div>
              <p className="font-bold text-[#2C1A0E]">Manuelt</p>
              <p className="text-sm text-[#9C7B65] mt-0.5">Fyll inn navn, bilde og info selv</p>
            </div>
          </button>

          <button
            onClick={() => setMode('url')}
            className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm text-left"
          >
            <span className="text-3xl">🔗</span>
            <div>
              <p className="font-bold text-[#2C1A0E]">Fra URL</p>
              <p className="text-sm text-[#9C7B65] mt-0.5">Lim inn en lenke, vi fyller inn automatisk</p>
            </div>
          </button>

          <button
            onClick={() => setMode('bookshelf')}
            className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm text-left"
          >
            <span className="text-3xl">📚</span>
            <div>
              <p className="font-bold text-[#2C1A0E]">Bokhylle-skanning</p>
              <p className="text-sm text-[#9C7B65] mt-0.5">Ta bilde av bokhyllen, AI gjenkjenner titlene</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── BOKHYLLE ──
  if (mode === 'bookshelf') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 pb-32">
        <button onClick={() => { setMode('choose'); setBooks([]); setShelfPreview('') }} className="text-[#C4673A] mb-6 text-sm">← Tilbake</button>
        <h1 className="text-2xl font-bold text-[#2C1A0E] mb-2">Bokhylle-skanning</h1>
        <p className="text-sm text-[#9C7B65] mb-6">Ta bilde av bokhyllen din, så gjenkjenner AI titlene og legger dem til automatisk</p>

        {!shelfPreview ? (
          <button
            onClick={() => shelfRef.current?.click()}
            className="w-full bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl py-12 flex flex-col items-center gap-3 text-[#9C7B65]"
          >
            <span className="text-4xl">📸</span>
            <p className="text-sm font-medium">Ta bilde eller velg fra bibliotek</p>
            <input ref={shelfRef} type="file" accept="image/*" capture="environment" onChange={handleShelfImage} className="hidden" />
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <img src={shelfPreview} className="w-full rounded-2xl object-cover max-h-64" />
              <button
                onClick={() => { setShelfPreview(''); setShelfImage(null); setBooks([]) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
              >✕</button>
            </div>

            {books.length === 0 && !scanning && (
              <button
                onClick={scanBookshelf}
                className="bg-[#C4673A] text-white rounded-xl py-3 font-medium"
              >
                🔍 Skann bokhylle
              </button>
            )}

            {scanning && (
              <div className="bg-white rounded-2xl p-6 text-center">
                <div className="text-3xl mb-2 animate-pulse">🔍</div>
                <p className="text-[#9C7B65] text-sm">Claude analyserer bildet…</p>
              </div>
            )}

            {books.length > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-[#2C1A0E]">{books.filter(b => b.selected).length} av {books.length} valgt</p>
                  <button
                    onClick={() => setBooks(prev => {
                      const allSelected = prev.every(b => b.selected)
                      return prev.map(b => ({ ...b, selected: !allSelected }))
                    })}
                    className="text-sm text-[#C4673A] font-medium"
                  >
                    {books.every(b => b.selected) ? 'Fjern alle' : 'Velg alle'}
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {books.map((book, i) => (
                    <button
                      key={i}
                      onClick={() => toggleBook(i)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm text-left transition-colors ${
                        book.selected ? 'bg-[#FFF0E6] border border-[#C4673A]' : 'bg-white border border-transparent'
                      }`}
                    >
                      {book.image_url ? (
                        <img src={book.image_url} className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-16 rounded-lg bg-[#E8DDD0] flex items-center justify-center text-2xl flex-shrink-0">📚</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2C1A0E] text-sm leading-tight">{book.title}</p>
                        <p className="text-xs text-[#9C7B65] mt-0.5">{book.author}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        book.selected ? 'bg-[#C4673A] border-[#C4673A]' : 'border-[#E8DDD0]'
                      }`}>
                        {book.selected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {books.filter(b => b.selected).length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FAF7F2] border-t border-[#E8DDD0]">
            <button
              onClick={saveBooks}
              disabled={savingBooks}
              className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
            >
              {savingBooks ? 'Lagrer…' : `Legg til ${books.filter(b => b.selected).length} bøker`}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── MANUELT OG URL ──
  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-32">
      <button onClick={() => { setMode('choose'); setUrlFetched(false) }} className="text-[#C4673A] mb-6 text-sm">← Tilbake</button>
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-6">
        {mode === 'url' ? 'Fra URL' : 'Legg ut manuelt'}
      </h1>

      {/* URL-søk */}
      {mode === 'url' && !urlFetched && (
        <div className="flex flex-col gap-3 mb-6">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.finn.no/..."
            className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
          />
          <button
            onClick={fetchFromUrl}
            disabled={urlLoading || !url}
            className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {urlLoading ? '🔍 Henter info…' : 'Hent produktinfo'}
          </button>
        </div>
      )}

      {(mode === 'manual' || urlFetched) && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Bilde */}
          <div>
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide mb-2 block">Bilde</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
                <button type="button" onClick={() => { setImagePreview(''); setImageFile(null) }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl py-8 flex flex-col items-center gap-2 text-[#9C7B65]">
                <span className="text-3xl">📷</span>
                <p className="text-sm">Legg til bilde</p>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>

          {/* Navn */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Hva heter gjenstanden?"
              required
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
            />
          </div>

          {/* Beskrivelse */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Beskrivelse</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Litt info om gjenstanden…"
              rows={3}
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
            />
          </div>

          {/* Kategori */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Kategori</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategory(c.id); setSubcategory('') }}
                  className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                    category === c.id ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Underkategori for barn */}
          {category === 'barn' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Underkategori</label>
              <div className="flex gap-2 flex-wrap">
                {BARN_SUBCATEGORIES.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubcategory(subcategory === sub ? '' : sub)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Pris per dag (valgfritt)</label>
            <input
              type="number"
              placeholder="eks. 100 – la stå tom for gratis"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
            />
          </div>

          {/* Vipps */}
          {price && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Vipps-nummer</label>
              <input
                type="tel"
                placeholder="eks. 98765432"
                value={vipps}
                onChange={e => setVipps(e.target.value)}
                className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !name}
            className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2"
          >
            {saving ? 'Lagrer…' : 'Legg ut'}
          </button>
        </form>
      )}
    </div>
  )
}