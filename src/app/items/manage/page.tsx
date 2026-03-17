'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SortKey = 'newest' | 'oldest' | 'name' | 'status'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Nyeste' },
  { id: 'oldest', label: 'Eldste' },
  { id: 'name', label: 'Navn A–Å' },
  { id: 'status', label: 'Ledig først' },
]

const CAT_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function ManageItemsPage() {
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data } = await supabase
        .from('items').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const deleteItem = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeletingId(null)
    setConfirmDelete(null)
  }

  const sorted = [...items].sort((a, b) => {
    if (sortKey === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortKey === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortKey === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'no')
    if (sortKey === 'status') return (b.available ? 1 : 0) - (a.available ? 1 : 0)
    return 0
  })

  const lentOut = items.filter(i => !i.available).length

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>

  return (
    <div className="max-w-lg mx-auto pb-24">

      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px' }}>
        <Link href="/profile" aria-label="Tilbake">
          <span className="w-9 h-9 flex items-center justify-center rounded-full shadow-sm"
            style={{ background: '#fff', border: '1px solid #E8DDD0', color: '#6B4226' }}>
            ←
          </span>
        </Link>
        <h1 className="page-header-title font-display" style={{ flex: 1, textAlign: 'center' }}>
          Mine gjenstander
        </h1>
        <Link href="/add" aria-label="Legg ut ny gjenstand">
          <span className="flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'var(--terra)', color: '#fff' }}>
            + Ny
          </span>
        </Link>
      </header>

      <div className="px-4 pt-4">

        {/* Stats-linje */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--terra-mid)' }}>
            {items.length} gjenstander
            {lentOut > 0 && <span style={{ color: 'var(--terra)' }}> · {lentOut} utlånt</span>}
          </p>
          {/* Sortering */}
          <div className="flex gap-1.5 overflow-x-auto">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setSortKey(opt.id)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-colors"
                style={sortKey === opt.id
                  ? { background: 'var(--terra)', color: '#fff', border: '1.5px solid transparent' }
                  : { background: '#fff', color: '#6B4226', border: '1px solid #E8DDD0' }
                }>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', color: 'var(--terra-mid)' }}>
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm mb-4">Du har ikke lagt ut noe ennå</p>
            <Link href="/add" className="btn-primary px-6 py-2 rounded-xl text-sm">
              Legg ut din første gjenstand
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map(item => (
              <div key={item.id}>
                <div className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: '#fff' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name}
                        className="rounded-xl object-cover flex-shrink-0" style={{ width: 48, height: 48 }} />
                    : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ width: 48, height: 48, background: '#E8DDD0' }}>
                        {CAT_EMOJI[item.category] ?? '📦'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--terra-mid)' }}>{item.category}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={item.available
                      ? { background: '#EEF4F0', color: 'var(--terra-green)' }
                      : { background: '#FFF0E6', color: 'var(--terra)' }
                    }>
                    {item.available ? 'Ledig' : 'Utlånt'}
                  </span>
                  {/* Rediger */}
                  <Link href={`/items/${item.id}/edit`} aria-label="Rediger"
                    className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 text-sm"
                    style={{ background: '#FAF7F2', border: '1px solid #E8DDD0', color: '#6B4226' }}>
                    ✏️
                  </Link>
                  {/* Slett */}
                  <button onClick={() => setConfirmDelete(item.id)} aria-label="Slett"
                    className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 text-sm"
                    style={{ background: '#FFF0E6', border: '1px solid rgba(196,103,58,0.2)', color: 'var(--terra)' }}>
                    🗑
                  </button>
                </div>

                {/* Bekreft-sletting — inline under kortet */}
                {confirmDelete === item.id && (
                  <div className="rounded-2xl px-4 py-3 mt-1 flex items-center justify-between gap-3"
                    style={{ background: '#FFF0E6', border: '1px solid rgba(196,103,58,0.2)' }}>
                    <p className="text-sm flex-1" style={{ color: 'var(--terra-dark)' }}>
                      Slette «{item.name}»?
                    </p>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ border: '1px solid #E8DDD0', color: 'var(--terra-mid)', background: '#fff' }}>
                      Avbryt
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{ background: 'var(--terra)', color: '#fff' }}>
                      {deletingId === item.id ? '…' : 'Slett'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="nav-spacer" />
    </div>
  )
}
