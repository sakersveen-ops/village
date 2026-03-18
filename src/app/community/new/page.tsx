'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const EMOJIS = ['🏘️', '🌳', '👨‍👩‍👧‍👦', '🤝', '🏡', '🌻', '🎪', '⚽', '📚', '🍼']

// Visibility levels — higher index = more open
type VisibilityLevel = 'friends' | 'friends_of_friends' | 'public'

const VISIBILITY_OPTIONS: { id: VisibilityLevel; label: string; desc: string; emoji: string }[] = [
  { id: 'friends',          label: 'Venner',              desc: 'Kun dine venner kan finne og søke om å bli med', emoji: '👥' },
  { id: 'friends_of_friends', label: 'Venners venner',    desc: 'Dine venner og deres venner kan se kretsen',     emoji: '🔗' },
  { id: 'public',           label: 'Offentlig',           desc: 'Alle kan finne kretsen og søke om å bli med',    emoji: '🌍' },
]

export default function NewCommunityPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🏘️')
  const [visibility, setVisibility] = useState<VisibilityLevel>('friends_of_friends')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // "public" implies friends_of_friends implies friends
  const isSelected = (level: VisibilityLevel) => {
    const order: VisibilityLevel[] = ['friends', 'friends_of_friends', 'public']
    return order.indexOf(level) <= order.indexOf(visibility)
  }

  const isPublic = visibility === 'public'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const inviteCode = Math.random().toString(36).substring(2, 8)

    const { data: community, error } = await supabase
      .from('communities')
      .insert({
        name,
        description,
        avatar_emoji: emoji,
        created_by: user.id,
        is_public: isPublic,
        visibility,         // store the full visibility level for future use
        invite_code: inviteCode,
      })
      .select()
      .single()

    if (error || !community) {
      console.error('community error:', error)
      setLoading(false)
      return
    }

    await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    })

    router.push(`/community/${community.id}/created`)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-28">
      <button onClick={() => router.back()} className="text-[#C4673A] mb-6 text-sm">← Tilbake</button>
      <h1 className="font-display text-2xl font-bold text-[#2C1A0E] mb-6" style={{ letterSpacing: '-0.02em' }}>
        Opprett krets
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Emoji */}
        <div>
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide mb-2 block">Ikon</label>
          <div className="flex gap-2 flex-wrap">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className="w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition-all active:scale-95"
                style={{
                  borderColor: emoji === e ? 'var(--terra)' : 'rgba(196,103,58,0.2)',
                  background: emoji === e ? 'rgba(196,103,58,0.08)' : 'rgba(255,248,243,0.7)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Navn */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Navn</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="eks. Nabolaget på Grünerløkka"
            required
            className="glass rounded-xl px-4 py-3 text-[#2C1A0E] outline-none text-sm"
            style={{ border: '1px solid rgba(196,103,58,0.2)' }}
          />
        </div>

        {/* Beskrivelse */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide">Beskrivelse</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Hvem er dette for?"
            rows={3}
            className="glass rounded-xl px-4 py-3 text-[#2C1A0E] outline-none text-sm resize-none"
            style={{ border: '1px solid rgba(196,103,58,0.2)' }}
          />
        </div>

        {/* Synlighet */}
        <div>
          <label className="text-xs text-[#9C7B65] font-medium uppercase tracking-wide mb-2 block">
            Synlighet
          </label>
          <div className="flex flex-col gap-2">
            {VISIBILITY_OPTIONS.map(opt => {
              const selected = isSelected(opt.id)
              const active = visibility === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVisibility(opt.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: selected ? 'rgba(196,103,58,0.07)' : 'rgba(255,248,243,0.6)',
                    border: `1.5px solid ${active ? 'var(--terra)' : selected ? 'rgba(196,103,58,0.3)' : 'rgba(196,103,58,0.15)'}`,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {/* Checkmark indicator */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: selected ? 'var(--terra)' : 'rgba(196,103,58,0.12)',
                      border: `2px solid ${selected ? 'var(--terra)' : 'rgba(196,103,58,0.25)'}`,
                    }}
                  >
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-lg flex-shrink-0">{opt.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2C1A0E]" style={{ letterSpacing: '-0.01em' }}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-[#9C7B65] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Contextual info */}
          <div className="mt-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(196,103,58,0.06)', border: '1px solid rgba(196,103,58,0.12)' }}>
            <p className="text-xs text-[#9C7B65]">
              {visibility === 'friends' && '🔒 Kun venner kan finne kretsen. Nye medlemmer trenger invitasjonslenke eller din godkjenning.'}
              {visibility === 'friends_of_friends' && '🔗 Venners venner kan se kretsen og søke om å bli med. Du godkjenner alle forespørsler.'}
              {visibility === 'public' && '🌍 Alle kan finne kretsen i søk. Venner, venners venner og ukjente kan søke om å bli med.'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name}
          className="btn-primary w-full py-3 mt-1 disabled:opacity-50"
        >
          {loading ? 'Oppretter…' : 'Opprett krets'}
        </button>

      </form>
    </div>
  )
}
