// Path of this file: src/app/community/[id]/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import ShareLinkButton from '@/components/ShareLinkButton'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name?: string, email?: string) {
  const src = name || email || ''
  return src
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '?'
}

function communityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function communityHue(name: string) {
  return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IconCamera = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)
const IconUsers = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
)
const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)
const IconKey = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/>
    <path d="M21 2l-9.6 9.6"/>
    <path d="M15.5 7.5l3 3L22 7l-3-3"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const IconWarning = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

// ─── Avatar component ─────────────────────────────────────────────────────────
function Avatar({ url, name, email, size = 36 }: { url?: string; name?: string; email?: string; size?: number }) {
  const text = initials(name, email)
  const hue = (name || email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: url ? undefined : `hsl(${hue}, 24%, 86%)`, color: `hsl(${hue}, 28%, 34%)`, fontSize: size * 0.36, border: '1px solid rgba(46,98,113,0.12)' }}>
      {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : text}
    </div>
  )
}

export default function CommunityPage() {
  const [community, setCommunity] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [memberLog, setMemberLog] = useState<any[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [tab, setTab] = useState<'feed' | 'members' | 'admin'>('feed')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [friendSearch, setFriendSearch] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: community } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single()
      setCommunity(community)
      setEditName(community?.name || '')
      setEditDesc(community?.description || '')

      const { data: allMembers } = await supabase
        .from('community_members')
        .select('*, profiles(name, email, avatar_url)')
        .eq('community_id', id)

      const activeMembers = (allMembers || []).filter((m: any) => m.status === 'active')
      const pendingMembers = (allMembers || []).filter((m: any) => m.status === 'pending')
      setMembers(activeMembers)
      setPending(pendingMembers)

      const me = activeMembers.find((m: any) => m.user_id === user.id)
      setMyRole(me?.role || null)

      if (!me) {
        const pendingMe = pendingMembers.find((m: any) => m.user_id === user.id)
        setMembershipStatus(pendingMe ? 'pending' : null)
      }

      const { data: items } = await supabase
        .from('items')
        .select('*, profiles(name, email, avatar_url)')
        .eq('community_id', id)
        .eq('available', true)
        .order('created_at', { ascending: false })
      setItems(items || [])

      const { data: friendsData } = await supabase
        .from('friendships')
        .select('user_b, profiles!friendships_user_b_fkey(id, name, email, avatar_url)')
        .eq('user_a', user.id)
      setFriends((friendsData || []).map((f: any) => f.profiles).filter(Boolean))

      if (me?.role === 'admin') {
        const { data: log } = await supabase
          .from('membership_log')
          .select('*, profiles!membership_log_user_id_fkey(name, email, avatar_url), actor:profiles!membership_log_acted_by_fkey(name, email)')
          .eq('community_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
        setMemberLog(log || [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  const requestMembership = async () => {
    setRequesting(true)
    const supabase = createClient()
    await supabase.from('community_members').insert({
      community_id: id, user_id: user?.id, role: 'member', status: 'pending',
    })
    await supabase.from('membership_log').insert({ community_id: id, user_id: user?.id, action: 'requested' })
    const admins = members.filter(m => m.role === 'admin')
    if (admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((a: any) => ({
          user_id: a.user_id,
          type: 'join_request',
          title: 'Ny forespørsel om å bli med',
          body: `${user?.email?.split('@')[0]} vil bli med i ${community.name}`,
          metadata: JSON.stringify({ community_id: id, requester_id: user?.id }),
        }))
      )
    }
    setMembershipStatus('pending')
    setRequesting(false)
  }

  const approveMember = async (memberId: string, userId: string, approve: boolean) => {
    const supabase = createClient()
    if (approve) {
      await supabase.from('community_members').update({ status: 'active' }).eq('id', memberId)
    } else {
      await supabase.from('community_members').delete().eq('id', memberId)
    }
    await supabase.from('membership_log').insert({
      community_id: id, user_id: userId,
      action: approve ? 'approved' : 'declined',
      acted_by: user?.id,
    })
    await supabase.from('notifications')
      .delete().eq('type', 'join_request').ilike('metadata', `%"requester_id":"${userId}"%`)
    await supabase.from('notifications').insert({
      user_id: userId,
      type: approve ? 'join_accepted' : 'join_declined',
      title: approve ? 'Forespørsel godtatt' : 'Forespørsel avslått',
      body: approve
        ? `Du er nå medlem av ${community.name}`
        : `Forespørselen om å bli med i ${community.name} ble avslått`,
    })
    const approved = pending.find(m => m.id === memberId)
    setPending(prev => prev.filter(m => m.id !== memberId))
    if (approve && approved) setMembers(prev => [...prev, { ...approved, status: 'active' }])
    setMemberLog(prev => [{
      id: Date.now(), user_id: userId,
      action: approve ? 'approved' : 'declined',
      acted_by: user?.id,
      created_at: new Date().toISOString(),
      profiles: approved?.profiles,
      actor: { name: user?.email?.split('@')[0] },
    }, ...prev])
  }

  const removeMember = async (memberId: string) => {
    const supabase = createClient()
    await supabase.from('community_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const promoteToAdmin = async (memberId: string) => {
    const supabase = createClient()
    await supabase.from('community_members').update({ role: 'admin' }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: 'admin' } : m))
  }

  const saveEdits = async () => {
    const supabase = createClient()
    await supabase.from('communities').update({ name: editName, description: editDesc }).eq('id', id)
    setCommunity((c: any) => ({ ...c, name: editName, description: editDesc }))
    setEditing(false)
  }

  const copyInvite = async () => {
    const inviteUrl = `${window.location.origin}/community/join/${community?.invite_code}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = inviteUrl
      textarea.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(textarea)
      textarea.focus(); textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const inviteFriend = async (friendId: string) => {
    const supabase = createClient()
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'community_invite',
      title: `Invitasjon til ${community.name}`,
      body: `${user?.email?.split('@')[0]} inviterer deg til å bli med i kretsen "${community.name}"`,
      metadata: JSON.stringify({ community_id: id, invite_code: community?.invite_code }),
    })
    setInvitedIds(prev => new Set([...prev, friendId]))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `community-covers/${id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('public').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(path)
      await supabase.from('communities').update({ cover_image_url: publicUrl }).eq('id', id)
      setCommunity((c: any) => ({ ...c, cover_image_url: publicUrl }))
    }
    setUploadingImage(false)
  }

  const deleteCommunity = async () => {
    setDeleting(true)
    const supabase = createClient()
    const memberUserIds = members.filter((m: any) => m.user_id !== user?.id).map((m: any) => m.user_id)
    if (memberUserIds.length > 0) {
      await supabase.from('notifications').insert(
        memberUserIds.map((uid: string) => ({
          user_id: uid,
          type: 'community_deleted',
          title: `Kretsen «${community.name}» er slettet`,
          body: `Administratoren har slettet kretsen.`,
        }))
      )
    }
    await supabase.from('community_members').delete().eq('community_id', id)
    await supabase.from('communities').delete().eq('id', id)
    router.push('/community/search')
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const filteredFriends = friends.filter(f =>
    (f.name || f.email || '').toLowerCase().includes(friendSearch.toLowerCase())
  )

  // ─── Loading / guard states ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  )
  if (!community) return (
    <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Fant ikke kretsen</div>
  )

  if (!myRole && membershipStatus === 'pending') return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="glass rounded-3xl p-8 max-w-sm w-full">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(46,98,113,0.08)', border: '1px solid rgba(46,98,113,0.12)' }}>
          <IconSend />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.02em' }}>Forespørsel sendt!</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--terra-mid)' }}>Venter på godkjenning fra en admin i {community.name}.</p>
        <button onClick={() => router.push('/')} className="btn-primary w-full">
          Tilbake til feeden
        </button>
      </div>
    </div>
  )

  if (!myRole) {
    const hue = communityHue(community.name)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="glass rounded-3xl p-8 max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
            style={{ border: '1px solid rgba(46,98,113,0.12)' }}>
            {community.cover_image_url
              ? <img src={community.cover_image_url} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full flex items-center justify-center font-display font-bold text-2xl"
                  style={{ background: `hsl(${hue}, 22%, 90%)`, color: `hsl(${hue}, 28%, 36%)` }}>
                  {communityInitials(community.name)}
                </div>}
          </div>
          <h1 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>{community.name}</h1>
          {community.description && (
            <p className="text-sm mb-4" style={{ color: 'var(--terra-mid)' }}>{community.description}</p>
          )}
          {community.is_public ? (
            <>
              <p className="text-xs mb-6" style={{ color: 'var(--terra-mid)' }}>Send en forespørsel – en admin godkjenner deg.</p>
              <button onClick={requestMembership} disabled={requesting} className="btn-primary w-full disabled:opacity-50">
                {requesting ? 'Sender…' : 'Be om å bli med'}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>Denne kretsen er privat. Du trenger en invitasjonslenke.</p>
            </div>
          )}
          <button onClick={() => router.back()} className="mt-3 text-sm py-2 w-full" style={{ color: 'var(--terra-mid)' }}>← Tilbake</button>
        </div>
      </div>
    )
  }

  const isAdmin = myRole === 'admin'

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40, borderTop: 'none' }}>
        <div className="px-4 pt-10 pb-4">
          <button
            onClick={() => editing ? setEditing(false) : router.back()}
            className="text-sm mb-4 block"
            style={{ color: 'var(--terra)' }}
          >
            ← {editing ? 'Avbryt redigering' : 'Tilbake'}
          </button>

          {editing ? (
            <div className="flex flex-col gap-3">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="glass rounded-xl px-4 py-2 text-xl font-bold outline-none"
                style={{ color: 'var(--terra-dark)', border: '1px solid rgba(46,98,113,0.2)' }}
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Legg til en beskrivelse av kretsen…"
                className="glass rounded-xl px-4 py-2 text-sm outline-none resize-none"
                style={{ color: 'var(--terra-dark)', border: '1px solid rgba(46,98,113,0.2)' }}
              />
              <div className="flex gap-2">
                <button onClick={saveEdits} className="btn-primary flex-1 py-2 text-sm">Lagre</button>
                <button onClick={() => setEditing(false)} className="btn-glass flex-1 py-2 text-sm">Avbryt</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {/* Community avatar with upload */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(46,98,113,0.14)' }}>
                  {community.cover_image_url
                    ? <img src={community.cover_image_url} alt={community.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-display font-bold text-xl"
                        style={{
                          background: `hsl(${communityHue(community.name)}, 22%, 90%)`,
                          color: `hsl(${communityHue(community.name)}, 28%, 36%)`,
                          letterSpacing: '-0.02em',
                        }}>
                        {communityInitials(community.name)}
                      </div>}
                </div>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-sm disabled:opacity-50"
                      style={{ background: 'var(--terra)' }}
                      title="Bytt bilde"
                    >
                      {uploadingImage
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <IconCamera />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
                  {community.name}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                  {community.description
                    ? community.description
                    : isAdmin
                      ? <span className="italic opacity-60">Ingen beskrivelse ennå — trykk Rediger</span>
                      : <span className="italic opacity-60">Ingen beskrivelse</span>}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--terra-mid)' }}>{members.length} medlemmer</p>
              </div>

              {isAdmin && (
                <button onClick={() => setEditing(true)} className="text-sm flex-shrink-0" style={{ color: 'var(--terra)' }}>
                  Rediger
                </button>
              )}
              <ShareLinkButton
                variant="community"
                communityName={community?.name}
                communityId={id as string}
              />
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {(['feed', 'members', ...(isAdmin ? ['admin'] : [])] as string[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                className="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex-shrink-0"
                style={tab === t
                  ? { background: 'var(--terra)', color: 'white', borderColor: 'transparent' }
                  : { background: 'rgba(252,254,255,0.6)', backdropFilter: 'blur(8px)', color: 'var(--terra-dark)', borderColor: 'var(--glass-border)' }}
              >
                {t === 'feed' ? 'Feed'
                  : t === 'members' ? `Medlemmer (${members.length})`
                  : `Administrer krets${pending.length > 0 ? ` (${pending.length})` : ''}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        {/* ── FEED ────────────────────────────────────────────────────────── */}
        {tab === 'feed' && (
          <>
            {/* Invite button — all members can invite */}
            <div className="mb-4">
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full glass rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
                style={{ border: '1.5px dashed rgba(46,98,113,0.3)', color: 'var(--terra)' }}
              >
                <IconUsers size={15} color="var(--terra)" />
                Inviter venner
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-3xl p-8 text-center"
                style={{ background: 'linear-gradient(135deg, rgba(225,240,245,0.7) 0%, rgba(250,247,242,0.7) 100%)', border: '1px solid rgba(46,98,113,0.15)' }}>
                {/* Sprout illustration — SVG, no emoji */}
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3">
                  <circle cx="24" cy="24" r="24" fill="rgba(94,154,120,0.1)"/>
                  <path d="M24 34V22" stroke="#5E9A78" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M24 26c0 0-2-6 6-8 0 0-1 8-6 8z" fill="#5E9A78" opacity="0.8"/>
                  <path d="M24 30c0 0 2-4-4-7 0 0 0 6 4 7z" fill="#5E9A78"/>
                </svg>
                <p className="font-semibold mb-1" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>Ingen ting delt ennå</p>
                <p className="text-sm mb-5" style={{ color: 'var(--terra-mid)' }}>
                  Inviter naboer og venner — jo flere som er med, jo mer å låne!
                </p>
                <button
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/community/join/${community?.invite_code}`
                    if (navigator.share) {
                      try { await navigator.share({ title: community?.name, text: `Bli med i kretsen «${community?.name}» på Village!`, url: shareUrl }) } catch { /* cancelled */ }
                    } else {
                      try { await navigator.clipboard.writeText(shareUrl) } catch { /* ignore */ }
                      setCopySuccess(true)
                      setTimeout(() => setCopySuccess(false), 2000)
                    }
                  }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <IconUsers size={15} color="white" />
                  {copySuccess ? 'Lenke kopiert!' : 'Inviter naboer'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {items.map(item => (
                  <Link key={item.id} href={`/items/${item.id}`}>
                    <div className="rounded-[20px] overflow-hidden group relative"
                      style={{ border: '1px solid rgba(46,98,113,0.15)', boxShadow: '0 2px 16px rgba(26,37,48,0.07)' }}>
                      {item.image_url ? (
                        <div className="relative w-full h-36 overflow-hidden">
                          <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(26,37,48,0.45) 100%)' }} />
                        </div>
                      ) : (
                        <div className="w-full h-36 flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, rgba(225,240,245,1) 0%, rgba(225,232,235,1) 100%)' }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(46,98,113,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2"/>
                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                          </svg>
                        </div>
                      )}
                      <div className="p-3 glass-card">
                        <p className="font-display font-semibold text-sm truncate"
                          style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Avatar url={item.profiles?.avatar_url} name={item.profiles?.name} email={item.profiles?.email} size={16} />
                          <p className="text-xs truncate" style={{ color: 'var(--terra-green)' }}>
                            {item.profiles?.name || item.profiles?.email?.split('@')[0]}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MEMBERS ─────────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                <Avatar url={m.profiles?.avatar_url} name={m.profiles?.name} email={m.profiles?.email} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>
                    {m.profiles?.name || m.profiles?.email?.split('@')[0]}
                  </p>
                  {m.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--terra)' }}>
                      <IconKey /> Admin
                    </span>
                  )}
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex gap-2">
                    {m.role !== 'admin' && (
                      <button onClick={() => promoteToAdmin(m.id)}
                        className="text-xs rounded-full px-2.5 py-1 font-medium"
                        style={{ color: 'var(--terra)', border: '1px solid rgba(46,98,113,0.3)' }}>
                        Gjør admin
                      </button>
                    )}
                    <button onClick={() => removeMember(m.id)}
                      className="text-xs rounded-full px-2.5 py-1"
                      style={{ color: 'var(--terra-mid)', border: '1px solid var(--glass-border)' }}>
                      Fjern
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ADMIN ───────────────────────────────────────────────────────── */}
        {tab === 'admin' && isAdmin && (
          <div className="flex flex-col gap-5">
            {/* Pending requests */}
            <div>
              <h2 className="font-semibold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>
                Ventende forespørsler {pending.length > 0 && <span style={{ color: 'var(--terra)' }}>({pending.length})</span>}
              </h2>
              {pending.length === 0 ? (
                <div className="glass rounded-2xl p-5 text-center text-sm" style={{ color: 'var(--terra-mid)' }}>
                  Ingen ventende forespørsler
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pending.map(m => (
                    <div key={m.id} className="glass rounded-2xl px-4 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar url={m.profiles?.avatar_url} name={m.profiles?.name} email={m.profiles?.email} size={36} />
                        <div className="flex-1">
                          <p className="font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>
                            {m.profiles?.name || m.profiles?.email?.split('@')[0]}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--terra-mid)' }}>{formatDate(m.joined_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveMember(m.id, m.user_id, true)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-white"
                          style={{ background: 'var(--terra-green)' }}>
                          <IconCheck /> Godta
                        </button>
                        <button onClick={() => approveMember(m.id, m.user_id, false)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm btn-glass">
                          <IconX /> Avslå
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Membership log */}
            <div>
              <h2 className="font-semibold mb-3" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>Medlemslogg</h2>
              {memberLog.length === 0 ? (
                <div className="glass rounded-2xl p-5 text-center text-sm" style={{ color: 'var(--terra-mid)' }}>
                  Ingen aktivitet ennå
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {memberLog.map(log => (
                    <div key={log.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                      <Avatar url={log.profiles?.avatar_url} name={log.profiles?.name} email={log.profiles?.email} size={36} />
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: 'var(--terra-dark)' }}>
                          <span className="font-medium">{log.profiles?.name || log.profiles?.email?.split('@')[0]}</span>
                          {log.action === 'requested' && ' søkte om medlemskap'}
                          {log.action === 'approved' && ` ble godkjent av ${log.actor?.name || 'admin'}`}
                          {log.action === 'declined' && ` ble avslått av ${log.actor?.name || 'admin'}`}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{formatDate(log.created_at)}</p>
                      </div>
                      {/* Status dot instead of emoji */}
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: log.action === 'approved' ? 'var(--terra-green)'
                            : log.action === 'declined' ? '#B91C1C'
                            : 'var(--terra)',
                        }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete community */}
            <div className="pt-2 pb-1 text-center">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: '#B91C1C' }}
              >
                <IconTrash /> Slett kretsen
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="nav-spacer" />

      {/* ── DELETE CONFIRMATION ───────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="glass-heavy rounded-t-3xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--glass-border)' }} />
            <div className="flex items-center justify-center mb-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.15)' }}>
                <IconWarning />
              </div>
            </div>
            <h2 className="font-display text-xl font-bold text-center mb-2"
              style={{ color: 'var(--terra-dark)', letterSpacing: '-0.02em' }}>
              Slette «{community.name}»?
            </h2>
            <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
              Dette kan ikke angres. Alle {members.length} medlemmer vil få varsel om at kretsen er slettet.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="btn-glass flex-1 py-3">
                Avbryt
              </button>
              <button onClick={deleteCommunity} disabled={deleting}
                className="flex-1 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50"
                style={{ background: '#B91C1C' }}>
                {deleting ? 'Sletter…' : 'Ja, slett kretsen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE MODAL ─────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setShowInviteModal(false)}>
          <div className="glass-heavy rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--glass-border)' }} />
              <h2 className="font-display text-lg font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.02em' }}>
                Inviter venner
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--terra-mid)' }}>Velg hvem du vil invitere til {community.name}</p>
              <div className="mt-3 glass rounded-xl px-3 py-2 flex items-center gap-2"
                style={{ border: '1px solid rgba(46,98,113,0.18)' }}>
                <IconSearch />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Søk etter venner…"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--terra-dark)' }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--terra-mid)' }}>
                  {friends.length === 0 ? 'Du har ingen venner å invitere ennå' : 'Ingen treff'}
                </div>
              ) : (
                filteredFriends.map(friend => {
                  const alreadyMember = members.some(m => m.user_id === friend.id)
                  const alreadyInvited = invitedIds.has(friend.id)
                  return (
                    <div key={friend.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                      <Avatar url={friend.avatar_url} name={friend.name} email={friend.email} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                          {friend.name || friend.email?.split('@')[0]}
                        </p>
                        {friend.email && (
                          <p className="text-xs truncate" style={{ color: 'var(--terra-mid)' }}>{friend.email}</p>
                        )}
                      </div>
                      {alreadyMember ? (
                        <span className="text-xs font-medium px-3 py-1.5 rounded-full"
                          style={{ background: 'rgba(94,154,120,0.12)', color: 'var(--terra-green)' }}>Medlem</span>
                      ) : alreadyInvited ? (
                        <span className="text-xs px-3 py-1.5 rounded-full"
                          style={{ background: 'rgba(46,98,113,0.08)', color: 'var(--terra-mid)' }}>Sendt</span>
                      ) : (
                        <button onClick={() => inviteFriend(friend.id)}
                          className="text-xs text-white px-3 py-1.5 rounded-full font-medium"
                          style={{ background: 'var(--terra)' }}>
                          Inviter
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <button
                onClick={copyInvite}
                className="w-full rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={copySuccess
                  ? { background: 'rgba(94,154,120,0.12)', color: 'var(--terra-green)', border: '1px solid rgba(94,154,120,0.3)' }
                  : { background: 'transparent', color: 'var(--terra)', border: '1.5px dashed rgba(46,98,113,0.35)' }}
              >
                {copySuccess ? <IconCheck /> : <IconLink />}
                {copySuccess ? 'Invitasjonslenke kopiert!' : 'Kopier invitasjonslenke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
