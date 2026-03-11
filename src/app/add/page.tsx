'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AddPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('annet')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    let image_url = ''
    if (image) {
        const ext = image.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('item-images').upload(path, image)
        console.log('upload error:', uploadError)
        if (!uploadError) {
        const { data } = supabase.storage.from('item-images').getPublicUrl(path)
        image_url = data.publicUrl
        console.log('image_url:', image_url)
        }
    }

    const { error } = await supabase.from('items').insert({
        owner_id: user.id,
        name,
        description,
        category,
        image_url,
    })
    console.log('insert error:', error)
    router.push('/')
    }

  const categories = ['baby', 'kjole', 'verktøy', 'bok', 'annet']

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <button onClick={() => router.back()} className="text-[#C4673A] mb-6 flex items-center gap-1">
        ← Tilbake
      </button>
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-6">Legg ut ting</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Bilde */}
        <label className="cursor-pointer">
          {preview ? (
            <img src={preview} className="w-full h-48 object-cover rounded-2xl" />
          ) : (
            <div className="w-full h-48 bg-white border-2 border-dashed border-[#E8DDD0] rounded-2xl flex flex-col items-center justify-center text-[#9C7B65]">
              <span className="text-3xl mb-2">📷</span>
              <span className="text-sm">Legg til bilde</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
        </label>

        {/* Navn */}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Hva er dette?"
          required
          className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A]"
        />

        {/* Beskrivelse */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Beskriv tingen (størrelse, tilstand, etc.)"
          rows={3}
          className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
        />

        {/* Kategori */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                category === c
                  ? 'bg-[#C4673A] text-white border-transparent'
                  : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              {c === 'baby' ? '🍼 Baby' : c === 'kjole' ? '👗 Kjole' : c === 'verktøy' ? '🔧 Verktøy' : c === 'bok' ? '📚 Bok' : 'Annet'}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !name}
          className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2"
        >
          {loading ? 'Legger ut…' : 'Legg ut'}
        </button>
      </form>
    </div>
  )
}