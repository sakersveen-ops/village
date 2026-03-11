'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function CommunityPage() {
  const [community, setCommunity] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [memberLog, setMemberLog] = useState<any[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'feed' | 'members' | 'admin'>('feed')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
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

      const activeMembers = (allMembers || []).filter(m => m.status === 'active')
      const pendingMembers = (allMembers || []).filter(m => m.status === 'pending')
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

      // Logg for admins
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
      community_id: id,
      user_id: user?.id,
      role: 'member',
      status: 'pending',
    })

    // Logg
    await supabase.from('membership_log').insert({
      community_id: id,
      user_id: user?.id,
      action: 'requested',
    })

    // Varsle alle admins
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

    // Logg
    await supabase.from('membership_log').insert({
      community_id: id,
      user_id: userId,
      action: approve ? 'approved' : 'declined',
      acted_by: user?.id,
    })

    // Fjern varsler hos alle andre admins for denne brukeren
    await supabase.from('notifications')
      .delete()
      .eq('type', 'join_request')
      .ilike('metadata', `%"requester_id":"${userId}"%`)

    // Varsle brukeren
    await supabase.from('notifications').insert({
      user_id: userId,
      type: approve ? 'join_accepted' : 'join_declined',
      title: approve ? '✓ Forespørsel godtatt!' : 'Forespørsel avslått',
      body: approve
        ? `Du er nå medlem av ${community.name}`
        : `Forespørselen om å bli med i ${community.name} ble avslått`,
    })

    const approved = pending.find(m => m.id === memberId)
    setPending(prev => prev.filter(m => m.id !== memberId))
    if (approve && approved) setMembers(prev => [...prev, { ...approved, status: 'active' }])

    // Oppdater logg
    setMemberLog(prev => [{
      id: Date.now(),
      user_id: userId,
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

  const copyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/community/join/${community?.invite_code}`)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-[#9C7B65]">Laster…</div>
  )
  if (!community) return (
    <div className="p-8 text-center text-[#9C7B65]">Fant ikke community</div>
  )

  // Ikke-medlem: pending
  if (!myRole && membershipStatus === 'pending') return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
        <div className="text-5xl mb-4">📬</div>
        <h1 className="text-xl font-bold text-[#2C1A0E] mb-2">Forespørsel sendt!</h1>
        <p className="text-[#9C7B65] text-sm mb-6">Venter på godkjenning fra en admin i {community.name}.</p>
        <button onClick={() => router.push('/')} className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">
          Tilbake til feeden
        </button>
      </div>
    </div>
  )

  // Ikke-medlem: be om tilgang
  if (!myRole) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
        <div className="text-5xl mb-3">{community.avatar_emoji}</div>
        <h1 className="text-xl font-bold text-[#2C1A0E] mb-1">{community.name}</h1>
        {community.description && (
          <p className="text-[#9C7B65] text-sm mb-4">{community.description}</p>
        )}
        {community.is_public ? (
          <>
            <p className="text-xs text-[#9C7B65] mb-6">Send en forespørsel – en admin godkjenner deg.</p>
            <button
              onClick={requestMembership}
              disabled={requesting}
              className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium disabled:opacity-50"
            >
              {requesting ? 'Sender…' : 'Be om å bli med'}
            </button>
          </>
        ) : (
          <p className="text-sm text-[#9C7B65] mt-2">🔒 Denne kretsen er privat. Du trenger en invitasjonslenke.</p>
        )}
        <button onClick={() => router.back()} className="mt-3 text-sm text-[#9C7B65] w-full py-2">← Tilbake</button>
      </div>
    </div>
  )

  const isAdmin = myRole === 'admin'

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4">
        <button onClick={() => router.back()} className="text-[#C4673A] text-sm mb-4 block">← Tilbake</button>

        {editing ? (
          <div className="flex flex-col gap-3">
            <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-2 text-[#2C1A0E] text-xl font-bold outline-none focus:border-[#C4673A]" />
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className="bg-white border border-[#E8DDD0] rounded-xl px-4 py-2 text-[#2C1A0E] text-sm outline-none focus:border-[#C4673A] resize-none" />
            <div className="flex gap-2">
              <button onClick={saveEdits} className="flex-1 bg-[#C4673A] text-white rounded-xl py-2 text-sm font-medium">Lagre</button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2 text-sm">Avbryt</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF0E6] flex items-center justify-center text-3xl flex-shrink-0">
              {community.avatar_emoji}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-[#2C1A0E]">{community.name}</h1>
              {community.description && <p className="text-sm text-[#9C7B65] mt-0.5">{community.description}</p>}
              <p className="text-xs text-[#9C7B65] mt-1">{members.length} medlemmer</p>
            </div>
            {isAdmin && (
              <button onClick={() => setEditing(true)} className="text-sm text-[#C4673A]">Rediger</button>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4 overflow-x-auto">
          {(['feed', 'members', ...(isAdmin ? ['admin'] : [])] as string[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex-shrink-0 ${
                tab === t ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
              }`}
            >
              {t === 'feed' ? 'Feed'
                : t === 'members' ? `Medlemmer (${members.length})`
                : `Admin${pending.length > 0 ? ` (${pending.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">

        {/* FEED */}
        {tab === 'feed' && (
          <>
            {isAdmin && (
              <div className="flex gap-2 mb-4">
                <button onClick={copyInvite} className="flex-1 bg-white border border-dashed border-[#C4673A] rounded-2xl py-3 text-sm text-[#C4673A] font-medium">
                  📋 Kopier invitasjonslenke
                </button>
                <Link href={`/community/${id}/share`}>
                  <button className="bg-white border border-[#E8DDD0] rounded-2xl py-3 px-4 text-sm text-[#6B4226] font-medium">Del ting</button>
                </Link>
              </div>
            )}
            {items.length === 0 ? (
              <div className="text-center py-16 text-[#9C7B65]">
                <div className="text-4xl mb-2">📭</div>
                <p>Ingen ting lagt ut ennå</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {items.map(item => (
                  <Link key={item.id} href={`/items/${item.id}`}>
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                      ) : (
                        <div className="w-full h-36 bg-[#E8DDD0] flex items-center justify-center text-3xl">📦</div>
                      )}
                      <div className="p-3">
                        <p className="font-semibold text-[#2C1A0E] text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-4 h-4 rounded-full bg-[#E8DDD0] flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.profiles?.avatar_url
                              ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" />
                              : <span className="text-xs font-bold text-[#6B4226]" style={{ fontSize: '8px' }}>{(item.profiles?.name || item.profiles?.email)?.[0]?.toUpperCase()}</span>}
                          </div>
                          <p className="text-xs text-[#4A7C59] truncate">{item.profiles?.name || item.profiles?.email?.split('@')[0]}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                  {m.profiles?.avatar_url
                    ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" />
                    : (m.profiles?.name || m.profiles?.email)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[#2C1A0E] font-medium text-sm">{m.profiles?.name || m.profiles?.email?.split('@')[0]}</p>
                  {m.role === 'admin' && <span className="text-xs text-[#C4673A] font-medium">Admin</span>}
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex gap-2">
                    {m.role !== 'admin' && (
                      <button onClick={() => promoteToAdmin(m.id)} className="text-xs text-[#C4673A] border border-[#C4673A] rounded-full px-2 py-1">Gjør admin</button>
                    )}
                    <button onClick={() => removeMember(m.id)} className="text-xs text-[#9C7B65] border border-[#E8DDD0] rounded-full px-2 py-1">Fjern</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ADMIN */}
        {tab === 'admin' && isAdmin && (
          <div className="flex flex-col gap-5">

            {/* Ventende forespørsler */}
            <div>
              <h2 className="font-bold text-[#2C1A0E] mb-3">
                Ventende forespørsler {pending.length > 0 && <span className="text-[#C4673A]">({pending.length})</span>}
              </h2>
              {pending.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">Ingen ventende forespørsler</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pending.map(m => (
                    <div key={m.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                          {m.profiles?.avatar_url
                            ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" />
                            : (m.profiles?.name || m.profiles?.email)?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-[#2C1A0E] text-sm">{m.profiles?.name || m.profiles?.email?.split('@')[0]}</p>
                          <p className="text-xs text-[#9C7B65]">{formatDate(m.joined_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveMember(m.id, m.user_id, true)} className="flex-1 bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium">✓ Godta</button>
                        <button onClick={() => approveMember(m.id, m.user_id, false)} className="flex-1 bg-white border border-[#E8DDD0] text-[#9C7B65] rounded-xl py-2 text-sm">Avslå</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medlemslogg */}
            <div>
              <h2 className="font-bold text-[#2C1A0E] mb-3">Medlemslogg</h2>
              {memberLog.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 text-center text-[#9C7B65] text-sm">Ingen aktivitet ennå</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {memberLog.map(log => (
                    <div key={log.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center font-bold text-sm text-[#6B4226] overflow-hidden flex-shrink-0">
                        {log.profiles?.avatar_url
                          ? <img src={log.profiles.avatar_url} className="w-full h-full object-cover" />
                          : (log.profiles?.name || log.profiles?.email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#2C1A0E]">
                          <span className="font-medium">{log.profiles?.name || log.profiles?.email?.split('@')[0]}</span>
                          {log.action === 'requested' && ' søkte om medlemskap'}
                          {log.action === 'approved' && ` ble godkjent av ${log.actor?.name || 'admin'}`}
                          {log.action === 'declined' && ` ble avslått av ${log.actor?.name || 'admin'}`}
                        </p>
                        <p className="text-xs text-[#9C7B65] mt-0.5">{formatDate(log.created_at)}</p>
                      </div>
                      <span className={`text-lg flex-shrink-0 ${log.action === 'approved' ? '✅' : log.action === 'declined' ? '❌' : '📬'}`}>
                        {log.action === 'approved' ? '✅' : log.action === 'declined' ? '❌' : '📬'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}