'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

// ── Types ──
type ItemRequest = {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  post_to_friends: boolean
  friends_can_repost: boolean
  created_at: string
}

const CAT_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

// ── Fullskjerm overlay ──
function RequestViewer({
  request,
  isOwner,
  viewerId,
  ownerName,
  onClose,
  onEdit,
}: {
  request: ItemRequest
  isOwner: boolean
  viewerId: string
  ownerName: string
  onClose: () => void
  onEdit?: () => void
}) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const offerLoan = async () => {
    setSending(true)
    const supabase = createClient()
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'loan_offer',
      title: '🎉 Noen kan låne deg dette!',
      body: `En venn tilbyr å låne deg: ${request.name}`,
    })
    setSent(true)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(44,26,14,0.92)' }}
      onClick={onClose}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full"
        onClick={e => e.stopPropagation()}>

        {/* Bilde eller emoji-placeholder */}
        {request.image_url ? (
          <img src={request.image_url} alt={request.name}
            className="rounded-3xl object-cover mb-6 shadow-xl"
            style={{ width: '100%', maxHeight: 320 }} />
        ) : (
          <div className="rounded-3xl flex items-center justify-center text-6xl mb-6 shadow-xl"
            style={{ width: '100%', height: 220, background: 'rgba(196,103,58,0.15)', border: '1px solid rgba(196,103,58,0.3)' }}>
            {CAT_EMOJI[request.category ?? ''] ?? '🔍'}
          </div>
        )}

        {/* Innhold */}
        <div className="w-full text-center">
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,248,243,0.6)' }}>
            {isOwner ? 'Din ønskeliste' : `${ownerName} ønsker å låne`}
          </p>
          <h2 className="font-display text-2xl font-bold text-white mb-2">{request.name}</h2>
          {request.description && (
            <p className="text-sm mb-4" style={{ color: 'rgba(255,248,243,0.75)' }}>{request.description}</p>
          )}
        </div>

        {/* Handlinger */}
        {isOwner ? (
          <div className="flex gap-3 w-full mt-2">
            <button onClick={onEdit}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,248,243,0.15)', color: '#fff', border: '1px solid rgba(255,248,243,0.2)' }}>
              ✏️ Rediger
            </button>
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,248,243,0.1)', color: 'rgba(255,248,243,0.7)' }}>
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
            className="w-full py-3 rounded-2xl text-sm font-semibold mt-2"
            style={{ background: 'var(--terra, #C4673A)', color: '#fff' }}>
            {sending ? '…' : '🤝 Du kan låne min!'}
          </button>
        )}
      </div>

      {/* Lukk-knapp */}
      <button onClick={onClose} className="absolute top-12 right-4 text-white text-2xl opacity-70">✕</button>
    </div>
  )
}

// ── Creator/Editor ──
function RequestCreator({
  existing,
  userId,
  onClose,
  onSaved,
}: {
  existing: ItemRequest | null
  userId: string
  onClose: () => void
  onSaved: (req: ItemRequest) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
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
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(44,26,14,0.6)' }}
      onClick={onClose}>
      <div className="glass-heavy w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '24px 24px 0 0' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-8 flex flex-col gap-4">

          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>
              {existing ? 'Rediger ønskeliste' : 'Ny ønskeliste'}
            </h2>
            <button onClick={onClose} style={{ color: 'var(--terra-mid)' }}>✕</button>
          </div>

          {/* Bilde */}
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

          {/* Navn */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>Hva leter du etter?</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="f.eks. Sykkel, Drill, Kjole til bryllup…"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          {/* Beskrivelse */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>Beskrivelse (valgfritt)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Når trenger du det? Hvilken størrelse? Andre detaljer…"
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ background: '#FAF7F2', border: '1px solid #E8DDD0' }}>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Post til mine venner</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Vises i venners feed</p>
              </div>
              <div onClick={() => setPostToFriends(v => !v)}
                className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
                style={{ background: postToFriends ? 'var(--terra)' : '#E8DDD0' }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: postToFriends ? 26 : 4 }} />
              </div>
            </label>

            {postToFriends && (
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Venner kan reposte</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Sprer ønsket videre i nettverket</p>
                </div>
                <div onClick={() => setFriendsCanRepost(v => !v)}
                  className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
                  style={{ background: friendsCanRepost ? 'var(--terra)' : '#E8DDD0' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: friendsCanRepost ? 26 : 4 }} />
                </div>
              </label>
            )}
          </div>

          {/* Lagre */}
          <button onClick={save} disabled={saving || !name.trim()}
            className="btn-primary w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ opacity: !name.trim() ? 0.5 : 1 }}>
            {saving ? 'Lagrer…' : existing ? 'Oppdater ønskeliste' : 'Legg ut ønskeliste'}
          </button>

          {/* Slett */}
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
  profileUserId,
  viewerId,
  isOwner,
  ownerName,
}: {
  profileUserId: string
  viewerId: string
  isOwner: boolean
  ownerName: string
}) {
  const [request, setRequest] = useState<ItemRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [showViewer, setShowViewer] = useState(false)
  const [showCreator, setShowCreator] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('item_requests')
        .select('*')
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setRequest(data)
      setLoading(false)
    }
    load()
  }, [profileUserId])

  if (loading) return null

  // Andres profil — vis kun hvis post_to_friends og request finnes
  if (!isOwner && (!request || !request.post_to_friends)) return null

  return (
    <>
      {/* Kortet */}
      <button
        onClick={() => request ? setShowViewer(true) : setShowCreator(true)}
        className="w-full text-left"
      >
        <div className="mx-4 my-3 rounded-2xl overflow-hidden shadow-sm"
          style={{ border: '1.5px solid rgba(196,103,58,0.25)' }}>
          <div className="flex items-center gap-3 px-4 py-3"
            style={{ background: 'linear-gradient(135deg, rgba(196,103,58,0.08) 0%, rgba(74,124,89,0.06) 100%)' }}>

            {/* Ikon/bilde */}
            {request?.image_url ? (
              <img src={request.image_url} alt={request.name}
                className="rounded-xl object-cover flex-shrink-0"
                style={{ width: 48, height: 48 }} />
            ) : (
              <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ width: 48, height: 48, background: 'rgba(196,103,58,0.12)' }}>
                {request ? (CAT_EMOJI[request.category ?? ''] ?? '🔍') : '✨'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--terra)' }}>
                {isOwner ? 'Min ønskeliste' : `${ownerName} ønsker å låne`}
              </p>
              {request ? (
                <>
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                    {request.name}
                  </p>
                  {request.description && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                      {request.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
                  Legg til en gjenstand du ønsker å låne
                </p>
              )}
            </div>

            <div className="flex-shrink-0 text-lg">
              {isOwner ? (request ? '✏️' : '+') : '→'}
            </div>
          </div>
        </div>
      </button>

      {/* Viewer */}
      {showViewer && request && (
        <RequestViewer
          request={request}
          isOwner={isOwner}
          viewerId={viewerId}
          ownerName={ownerName}
          onClose={() => setShowViewer(false)}
          onEdit={() => { setShowViewer(false); setShowCreator(true) }}
        />
      )}

      {/* Creator/Editor */}
      {showCreator && (
        <RequestCreator
          existing={request}
          userId={profileUserId}
          onClose={() => setShowCreator(false)}
          onSaved={(req) => { setRequest(req); setShowCreator(false) }}
        />
      )}
    </>
  )
}
