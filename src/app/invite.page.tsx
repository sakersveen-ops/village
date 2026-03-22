'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import InviteComposer from '@/components/InviteComposer'

export default function InvitePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showComposer, setShowComposer] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      const { data: p } = await supabase.from('profiles').select('name').eq('id', data.user.id).single()
      setProfile(p)
    })
  }, [])

  const inviteUrl = user ? `${typeof window !== 'undefined' ? window.location.origin : 'https://village-jade.vercel.app'}/join/${user.id}` : ''
  const displayName = profile?.name || user?.email?.split('@')[0] || ''

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-24">

      <h1 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--terra-dark)' }}>
        Inviter venner
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--terra-mid)' }}>
        Del en personlig invitasjon eller lenken din — når noen klikker den blir dere koblet som venner.
      </p>

      {user && (
        <div className="flex flex-col gap-3">

          {/* Personlig invitasjon — primær CTA */}
          <button
            onClick={() => setShowComposer(true)}
            className="rounded-2xl p-5 flex items-center gap-4 shadow-sm text-left"
            style={{ background: '#fff', border: '1.5px solid rgba(196,103,58,0.2)' }}
          >
            <div className="flex items-center justify-center rounded-2xl flex-shrink-0 text-2xl"
              style={{ width: 52, height: 52, background: 'rgba(196,103,58,0.1)' }}>
              ✉️
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>
                Skriv en personlig invitasjon
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                Del via iMessage, WhatsApp, e-post eller mer
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>

          {/* Invitasjonslenke */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--terra-mid)' }}>Din invitasjonslenke</p>
            <p className="text-sm break-all rounded-xl p-3 mb-3"
              style={{ background: '#FAF7F2', color: 'var(--terra-dark)' }}>
              {inviteUrl}
            </p>
            <button onClick={copyLink}
              className="btn-glass w-full py-2.5 rounded-xl text-sm font-medium">
              📋 Kopiér lenke
            </button>
          </div>

        </div>
      )}

      {showComposer && (
        <InviteComposer
          senderName={displayName}
          onClose={() => setShowComposer(false)}
        />
      )}
    </div>
  )
}
