'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type ItemRequest = {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  loan_from: string | null
  loan_to: string | null
  post_to_friends: boolean
  friends_can_repost: boolean
  created_at: string
}

const CAT_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function DateChip({ from, to }: { from: string | null; to: string | null }) {
  if (!from && !to) return null
  return (
    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--terra-mid)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      {from ? formatDate(from) : '?'} → {to ? formatDate(to) : '?'}
    </p>
  )
}

// ── Fullskjerm viewer ──
function RequestViewer({
  request, isOwner, ownerName, onClose, onEdit,
}: {
  request: ItemRequest
  isOwner: boolean
  ownerName: string
  onClose: () => void
  onEdit?: () => void
}) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const offerLoan = async () => {
    setSending(true)
    const supabase = createClient()
    const dateNote = request.loan_from && request.loan_to
      ? ` (${formatDate(request.loan_from)} – ${formatDate(request.loan_to)})` : ''
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'loan_offer',
      title: '🎉 Noen kan låne deg dette!',
      body: `En venn tilbyr å låne deg: ${request.name}${dateNote}`,
    })
    setSent(true)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(44,26,14,0.94)' }}
      onClick={onClose}>
      <button onClick={onClose} className="absolute top-12 right-4 text-white text-2xl opacity-60 z-10">✕</button>
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full"
        onClick={e => e.stopPropagation()}>

        {request.image_url ? (
          <img src={request.image_url} alt={request.name}
            className="rounded-3xl object-cover mb-5 shadow-xl"
            style={{ width: '100%', maxHeight: 300 }} />
        ) : (
          <div className="rounded-3xl flex items-center justify-center text-6xl mb-5 shadow-xl"
            style={{ width: '100%', height: 200, background: 'rgba(196,103,58,0.15)', border: '1px solid rgba(196,103,58,0.3)' }}>
            {CAT_EMOJI[request.category ?? ''] ?? '🔍'}
          </div>
        )}

        <div className="w-full text-center">
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,248,243,0.55)' }}>
            {isOwner ? 'Din ønskeliste' : `${ownerName} ønsker å låne`}
          </p>
          <h2 className="font-display text-2xl font-bold text-white mb-1">{request.name}</h2>

          {(request.loan_from || request.loan_to) && (
            <div className="flex items-center gap-2 justify-center mt-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,248,243,0.15)', border: '1px solid rgba(255,248,243,0.25)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,248,243,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="text-xs font-medium" style={{ color: 'rgba(255,248,243,0.9)' }}>
                  {request.loan_from ? formatDate(request.loan_from) : '?'} → {request.loan_to ? formatDate(request.loan_to) : '?'}
                </span>
              </div>
            </div>
          )}

          {request.description && (
            <p className="text-sm mt-3" style={{ color: 'rgba(255,248,243,0.7)' }}>{request.description}</p>
          )}
        </div>

        <div className="w-full mt-5">
          {isOwner ? (
            <div className="flex gap-3">
              <button onClick={onEdit}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(255,248,243,0.15)', color: '#fff', border: '1px solid rgba(255,248,243,0.2)' }}>
                ✏️ Rediger
              </button>
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(255,248,243,0.08)', color: 'rgba(255,248,243,0.6)' }}>
                Lukk
              </button>
            </div>
          ) : sent ? (
            <div className="w-full py-3 rounded-2xl text-center text-sm font-semibold"
              style={{ background: 'rgba(74,124,89,0.3)', color: '#6FCF97', border: '1px solid rgba(74,124,89,0.4)' }}>
              ✓ Melding sendt til {ownerName}!
            </div>
          ) : (
            <button onClick={offerLoan} disabled={sending}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--terra, #C4673A)', color: '#fff' }}>
              {sending ? '…' : '🤝 Du kan låne min!'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Creator / Editor — alltid ny hvis existing=null, rediger hvis existing satt ──
function RequestCreator({
  existing, userId, onClose, onSaved, onDeleted,
}: {
  existing: ItemRequest | null
  userId: string
  onClose: () => void
  onSaved: (req: ItemRequest) => void
  onDeleted?: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [loanFrom, setLoanFrom] = useState(existing?.loan_from?.slice(0, 10) ?? '')
  const [loanTo, setLoanTo] = useState(existing?.loan_to?.slice(0, 10) ?? '')
  const [postToFriends, setPostToFriends] = useState(existing?.post_to_friends ?? true)
  const [friendsCanRepost, setFriendsCanRepost] = useState(existing?.friends_can_repost ?? false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existing?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()

    let image_url = existing?.image_url ?? null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `requests/${userId}-${Date.now()}.${ext}`
      await supabase.storage.from('item-images').upload(path, imageFile, { upsert: true })
      const { data } = supabase.storage.from('item-images').getPublicUrl(path)
      image_url = data.publicUrl
    }

    const payload = {
      user_id: userId,
      name: name.trim(),
      description: description.trim() || null,
      image_url,
      loan_from: loanFrom || null,
      loan_to: loanTo || null,
      post_to_friends: postToFriends,
      friends_can_repost: friendsCanRepost,
    }

    let result: ItemRequest | null = null
    if (existing) {
      const { data } = await supabase.from('item_requests').update(payload).eq('id', existing.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('item_requests').insert(payload).select().single()
      result = data
    }

    setSaving(false)
    if (result) onSaved(result)
  }

  const deleteRequest = async () => {
    if (!existing) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('item_requests').delete().eq('id', existing.id)
    setDeleting(false)
    onDeleted?.()
    onClose()
  }

  const inputStyle = { background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(44,26,14,0.6)' }}
      onClick={onClose}>
      <div className="glass-heavy w-full max-w-lg mx-auto max-h-[92vh] overflow-y-auto"
        style={{ borderRadius: '24px 24px 0 0' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-8 flex flex-col gap-4">

          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>
              {existing ? 'Rediger ønskeliste' : 'Ny ønskeliste'}
            </h2>
            <button onClick={onClose} style={{ color: 'var(--terra-mid)' }}>✕</button>
          </div>

          <button onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ height: 160, background: '#F0E9E2', border: '2px dashed rgba(196,103,58,0.3)' }}>
            {imagePreview
              ? <img src={imagePreview} className="w-full h-full object-cover" alt="" />
              : <div className="flex flex-col items-center gap-2" style={{ color: 'var(--terra-mid)' }}>
                  <span className="text-3xl">📷</span>
                  <span className="text-sm">Legg til bilde</span>
                </div>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>Hva leter du etter?</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="f.eks. Sykkel, Drill, Kjole til bryllup…"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>Beskrivelse (valgfritt)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Størrelse, tilstand, andre detaljer…"
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--terra-mid)' }}>Lånedatoer (valgfritt)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: 'var(--terra-mid)' }}>Fra</p>
                <input type="date" value={loanFrom} onChange={e => setLoanFrom(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
                />
              </div>
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: 'var(--terra-mid)' }}>Til</p>
                <input type="date" value={loanTo} onChange={e => setLoanTo(e.target.value)}
                  min={loanFrom || undefined}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: '#FAF7F2', border: '1px solid #E8DDD0' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Post til mine venner</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Vises i venners feed</p>
              </div>
              <button onClick={() => setPostToFriends(v => !v)}
                className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
                style={{ background: postToFriends ? 'var(--terra)' : '#E8DDD0' }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: postToFriends ? 26 : 4 }} />
              </button>
            </div>
            {postToFriends && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Venner kan reposte</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Sprer ønsket videre i nettverket</p>
                </div>
                <button onClick={() => setFriendsCanRepost(v => !v)}
                  className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
                  style={{ background: friendsCanRepost ? 'var(--terra)' : '#E8DDD0' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: friendsCanRepost ? 26 : 4 }} />
                </button>
              </div>
            )}
          </div>

          <button onClick={save} disabled={saving || !name.trim()}
            className="btn-primary w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ opacity: !name.trim() ? 0.5 : 1 }}>
            {saving ? 'Lagrer…' : existing ? 'Oppdater' : 'Legg ut ønskeliste'}
          </button>

          {existing && (
            <button onClick={deleteRequest} disabled={deleting}
              className="w-full py-2.5 rounded-2xl text-sm"
              style={{ color: 'var(--terra)', border: '1px solid rgba(196,103,58,0.25)' }}>
              {deleting ? '…' : 'Fjern ønskeliste'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Hovedkomponent ──
export default function ItemRequestCard({
  profileUserId, viewerId, isOwner, ownerName,
}: {
  profileUserId: string
  viewerId: string
  isOwner: boolean
  ownerName: string
}) {
  const [requests, setRequests] = useState<ItemRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingRequest, setViewingRequest] = useState<ItemRequest | null>(null)
  const [editingRequest, setEditingRequest] = useState<ItemRequest | null>(null)
  const [showNewCreator, setShowNewCreator] = useState(false)

  const loadRequests = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('item_requests')
      .select('*')
      .eq('user_id', profileUserId)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [profileUserId])

  if (loading) return null

  // Andres profil: skjul hvis ingen requests eller ingen post_to_friends
  const visibleRequests = isOwner
    ? requests
    : requests.filter(r => r.post_to_friends)

  if (!isOwner && visibleRequests.length === 0) return null

  return (
    <>
      <div className="mx-4 my-3 rounded-2xl overflow-hidden shadow-sm"
        style={{ border: '1.5px solid rgba(196,103,58,0.25)' }}>

        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, rgba(196,103,58,0.08) 0%, rgba(74,124,89,0.06) 100%)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--terra)' }}>
            {isOwner ? 'Min ønskeliste' : `${ownerName} ønsker å låne`}
            {visibleRequests.length > 0 && (
              <span className="ml-1.5 font-normal" style={{ color: 'var(--terra-mid)' }}>
                ({visibleRequests.length})
              </span>
            )}
          </p>
          {isOwner && (
            <button
              onClick={() => setShowNewCreator(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--terra)', color: '#fff' }}
            >
              + Legg til
            </button>
          )}
        </div>

        {/* Liste over requests */}
        {visibleRequests.length === 0 ? (
          <button onClick={() => setShowNewCreator(true)}
            className="w-full px-4 py-4 flex items-center gap-3 text-left"
            style={{ background: 'rgba(196,103,58,0.03)' }}>
            <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ width: 44, height: 44, background: 'rgba(196,103,58,0.10)' }}>
              ✨
            </div>
            <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
              Legg til en gjenstand du ønsker å låne
            </p>
          </button>
        ) : (
          <div>
            {visibleRequests.map((req, idx) => (
              <button
                key={req.id}
                onClick={() => setViewingRequest(req)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
                style={{
                  background: '#fff',
                  borderTop: idx === 0 ? '1px solid rgba(196,103,58,0.1)' : '1px solid #F0EAE4',
                }}
              >
                {req.image_url ? (
                  <img src={req.image_url} alt={req.name}
                    className="rounded-xl object-cover flex-shrink-0" style={{ width: 44, height: 44 }} />
                ) : (
                  <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ width: 44, height: 44, background: '#E8DDD0' }}>
                    {CAT_EMOJI[req.category ?? ''] ?? '🔍'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                    {req.name}
                  </p>
                  <DateChip from={req.loan_from} to={req.loan_to} />
                </div>
                <span className="text-lg flex-shrink-0">{isOwner ? '✏️' : '→'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viewer */}
      {viewingRequest && (
        <RequestViewer
          request={viewingRequest}
          isOwner={isOwner}
          ownerName={ownerName}
          onClose={() => setViewingRequest(null)}
          onEdit={() => { setEditingRequest(viewingRequest); setViewingRequest(null) }}
        />
      )}

      {/* Rediger eksisterende */}
      {editingRequest && (
        <RequestCreator
          existing={editingRequest}
          userId={profileUserId}
          onClose={() => setEditingRequest(null)}
          onSaved={(updated) => {
            setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
            setEditingRequest(null)
          }}
          onDeleted={() => {
            setRequests(prev => prev.filter(r => r.id !== editingRequest.id))
            setEditingRequest(null)
          }}
        />
      )}

      {/* Opprett ny */}
      {showNewCreator && (
        <RequestCreator
          existing={null}
          userId={profileUserId}
          onClose={() => setShowNewCreator(false)}
          onSaved={(newReq) => {
            setRequests(prev => [newReq, ...prev])
            setShowNewCreator(false)
          }}
        />
      )}
    </>
  )
}
