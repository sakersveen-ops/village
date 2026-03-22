'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import InviteComposer from '@/components/InviteComposer'

export default function InviteFriendsPage() {
  const [friends, setFriends] = useState<any[]>([])
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [community, setCommunity] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const { id } = useParams()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const [{ data: community }, { data: profileData }, { data: friendships }, { data: members }] = await Promise.all([
        supabase.from('communities').select('*').eq('id', id).single(),
        supabase.from('profiles').select('name').eq('id', user.id).single(),
        supabase.from('friendships')
          .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
          .eq('user_a', user.id),
        supabase.from('community_members').select('user_id').eq('community_id', id),
      ])

      setCommunity(community)
      setProfile(profileData)

      const memberIds = new Set((members || []).map((m: any) => m.user_id))
      setFriends((friendships || []).filter((f: any) => !memberIds.has(f.user_b)))
      setLoading(false)
    }
    load()
  }, [id])

  const invite = async (friendId: string) => {
    const supabase = createClient()
    await supabase.from('community_members').insert({
      community_id: id,
      user_id: friendId,
      role: 'member',
      status: 'pending',
    })
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'join_request',
      title: `Invitasjon til ${community?.name}`,
      body: `Du er invitert til å bli med i kretsen ${community?.name}`,
      metadata: JSON.stringify({ community_id: id }),
    })
    setInvited(prev => new Set([...prev, friendId]))
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || ''

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      <div style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DDD0' }} className="px-4 pt-6 pb-4">
        <h1 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)' }}>
          Inviter venner
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>til {community?.name}</p>

        {/* Personlig invitasjon via composer — primær CTA */}
        <button
          onClick={() => setShowComposer(true)}
          className="mt-4 w-full rounded-2xl p-4 flex items-center gap-3 text-left shadow-sm"
          style={{ background: '#fff', border: '1.5px solid rgba(196,103,58,0.2)' }}
        >
          <div className="flex items-center justify-center rounded-2xl flex-shrink-0 text-xl"
            style={{ width: 44, height: 44, background: 'rgba(196,103,58,0.1)' }}>
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
      </div>

      <div className="px-4 pt-4 flex flex-col gap-2">

        {/* Seksjonstittel for vennelisten */}
        {friends.length > 0 && (
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--terra-mid)' }}>
            Eller inviter direkte fra vennelisten
          </p>
        )}

        {friends.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--terra-mid)' }}>
            <p className="text-4xl mb-2">👥</p>
            <p className="text-sm">Ingen venner å invitere ennå</p>
            <Link href="/profile" style={{ color: 'var(--terra)' }} className="text-sm mt-2 block">
              Legg til venner →
            </Link>
          </div>
        ) : (
          friends.map((f: any) => (
            <div key={f.user_b} className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
              <div className="flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
                style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}>
                {f.profiles?.avatar_url
                  ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                  : (f.profiles?.name || f.profiles?.email)?.[0]?.toUpperCase()}
              </div>
              <p className="flex-1 font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>
                {f.profiles?.name || f.profiles?.email?.split('@')[0]}
              </p>
              {invited.has(f.user_b) ? (
                <span className="text-xs font-medium" style={{ color: 'var(--terra-green)' }}>✓ Invitert</span>
              ) : (
                <button onClick={() => invite(f.user_b)}
                  className="text-xs rounded-full px-3 py-1.5 font-medium"
                  style={{ background: 'var(--terra)', color: '#fff' }}>
                  Inviter
                </button>
              )}
            </div>
          ))
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Link href={`/community/${id}`}>
            <button className="btn-primary w-full py-3 rounded-xl text-sm font-medium">
              Gå til kretsen →
            </button>
          </Link>
        </div>
      </div>

      {showComposer && (
        <InviteComposer
          senderName={displayName}
          communityName={community?.name}
          onClose={() => setShowComposer(false)}
        />
      )}
    </div>
  )
}
