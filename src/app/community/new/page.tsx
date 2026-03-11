'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const EMOJIS = ['🏘️', '🌳', '👨‍👩‍👧‍👦', '🤝', '🏡', '🌻', '🎪', '⚽', '📚', '🍼']

export default function NewCommunityPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🏘️')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: community, error } = await supabase
      .from('communities')
      .insert({
        name,
        description,
        avatar_emoji: emoji,
        created_by: user.id,
        is_public: isPublic,
      })
      .select()
      .single()

    if (error || !community) { setLoading(false); return }

    await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    })

    router.push(`/community/${community.id}/share`)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-24">
      <button onClick={() => router.back()} className="text-[#C4673A] mb-6">← Tilbake</button>
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-6">Opprett krets</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Emoji */}
        <div>
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide mb-2 block">Ikon</label>
          <div className="flex gap-2 flex-wrap">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition-colors ${
                  emoji === e ? 'border-[#C4673A] bg-[#FFF0E6]' : 'border-[#E8DDD0] bg-white'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Navn */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="eks. Nabolaget på Grünerløkka"
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
            placeholder="Hvem er dette for?"
            rows={3}
            className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-3 text-[#2C1A0E] outline-none focus:border-[#C4673A] resize-none"
          />
        </div>

        {/* Public/privat toggle */}
        <div className="flex items-center justify-between bg-white border border-[#E8DDD0] rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#2C1A0E]">Offentlig krets</p>
            <p className="text-xs text-[#9C7B65]">Vises i søk og for venners venner</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(p => !p)}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isPublic ? 'bg-[#C4673A]' : 'bg-[#E8DDD0]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Info om privat */}
        {!isPublic && (
          <div className="bg-[#FAF7F2] rounded-xl px-4 py-3">
            <p className="text-xs text-[#9C7B65]">🔒 Privat krets – nye medlemmer kan kun bli med via invitasjonslenke.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name}
          className="bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50 mt-2"
        >
          {loading ? 'Oppretter…' : 'Opprett krets'}
        </button>

      </form>
    </div>
  )
}