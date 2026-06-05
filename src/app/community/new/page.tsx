'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { track, Events } from '@/lib/track'

const EMOJIS = ['🏘️', '🌳', '👨‍👩‍👧‍👦', '🤝', '🏡', '🌻', '🎪', '⚽', '📚', '🍼']

type VisibilityLevel = 'friends' | 'friends_of_friends' | 'public'

const VISIBILITY_OPTIONS: { id: VisibilityLevel; label: string; desc: string; emoji: string }[] = [
  { id: 'friends',            label: 'Venner',          desc: 'Kun dine venner kan finne og søke om å bli med',          emoji: '👥' },
  { id: 'friends_of_friends', label: 'Venners venner',  desc: 'Dine venner og deres venner kan se kretsen',              emoji: '🔗' },
  { id: 'public',             label: 'Offentlig',        desc: 'Alle kan finne kretsen og søke om å bli med',             emoji: '🌍' },
]

const CONTEXT_TEXT: Record<VisibilityLevel, string> = {
  friends:            '🔒 Kun venner kan finne kretsen. Nye medlemmer trenger invitasjonslenke eller din godkjenning.',
  friends_of_friends: '🔗 Venners venner kan se kretsen og søke om å bli med. Du godkjenner alle forespørsler.',
  public:             '🌍 Alle kan finne kretsen i søk. Venner, venners venner og ukjente kan søke om å bli med.',
}

const MAX_DESCRIPTION = 500
const MAX_NAME = 80

export default function NewCommunityPage() {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji]             = useState('🏘️')
  const [visibility, setVisibility]   = useState<VisibilityLevel>('friends_of_friends')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const inviteCode = Math.random().toString(36).substring(2, 8)

    const { data: community, error: insertError } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        description: description.trim(),
        avatar_emoji: emoji,
        created_by: user.id,
        is_public: visibility === 'public',
        visibility,
        invite_code: inviteCode,
      })
      .select()
      .single()

    if (insertError || !community) {
      console.error('community error:', insertError)
      setError('Noe gikk galt. Prøv igjen.')
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    })

    if (memberError) {
      console.error('member error:', memberError)
      // Community was created — still navigate, don't block user
    }

    router.push(`/community/${community.id}/created`)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-28">
      <button onClick={() => router.back()} className="text-[var(--terra)] mb-6 text-sm">
        ← Tilbake
      </button>

      <h1
        className="font-display text-2xl font-bold text-[var(--terra-dark)] mb-6"
        style={{ letterSpacing: '-0.02em' }}
      >
        Opprett krets
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Emoji */}
        <div>
          <label className="text-xs text-[var(--terra-mid)] font-medium uppercase tracking-wide mb-2 block">
            Ikon
          </label>
          <div className="flex gap-2 flex-wrap">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className="w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition-all active:scale-95"
                style={{
                  borderColor: emoji === e ? 'var(--terra)' : 'rgba(46,98,113,0.2)',
                  background:  emoji === e ? 'rgba(46,98,113,0.08)' : 'rgba(252,254,255,0.7)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Navn */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--terra-mid)] font-medium uppercase tracking-wide">
              Navn
            </label>
            <span className="text-xs text-[var(--terra-mid)]">
              {name.length}/{MAX_NAME}
            </span>
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value.slice(0, MAX_NAME))}
            placeholder="eks. Nabolaget på Grünerløkka"
            required
            maxLength={MAX_NAME}
            className="glass rounded-xl px-4 py-3 text-[var(--terra-dark)] outline-none text-sm"
            style={{ border: '1px solid rgba(46,98,113,0.2)' }}
          />
        </div>

        {/* Beskrivelse */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--terra-mid)] font-medium uppercase tracking-wide">
              Beskrivelse
            </label>
            <span className="text-xs text-[var(--terra-mid)]">
              {description.length}/{MAX_DESCRIPTION}
            </span>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
            placeholder="Hvem er dette for?"
            rows={3}
            maxLength={MAX_DESCRIPTION}
            className="glass rounded-xl px-4 py-3 text-[var(--terra-dark)] outline-none text-sm resize-none"
            style={{ border: '1px solid rgba(46,98,113,0.2)' }}
          />
        </div>

        {/* Synlighet — radio */}
        <div>
          <label className="text-xs text-[var(--terra-mid)] font-medium uppercase tracking-wide mb-2 block">
            Synlighet
          </label>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Synlighet">
            {VISIBILITY_OPTIONS.map(opt => {
              const active = visibility === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setVisibility(opt.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background:    active ? 'rgba(46,98,113,0.07)' : 'rgba(252,254,255,0.6)',
                    border:        `1.5px solid ${active ? 'var(--terra)' : 'rgba(46,98,113,0.15)'}`,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {/* Radio indicator */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: active ? 'var(--terra)' : 'transparent',
                      border:     `2px solid ${active ? 'var(--terra)' : 'rgba(46,98,113,0.3)'}`,
                    }}
                  >
                    {active && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'white' }}
                      />
                    )}
                  </div>
                  <span className="text-lg flex-shrink-0">{opt.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-[var(--terra-dark)]"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-[var(--terra-mid)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Context hint */}
          <div
            className="mt-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(46,98,113,0.06)', border: '1px solid rgba(46,98,113,0.12)' }}
          >
            <p className="text-xs text-[var(--terra-mid)]">{CONTEXT_TEXT[visibility]}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn-primary w-full py-3 mt-1 disabled:opacity-50"
        >
          {loading ? 'Oppretter…' : 'Opprett krets'}
        </button>

      </form>
    </div>
  )
}
