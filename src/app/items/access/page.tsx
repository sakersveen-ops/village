'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { track } from '@/lib/track'
import FirstTimeAddItemModal from '@/components/FirstTimeAddItemModal'

// ─── Nøkkel for draft — må matche add/page.tsx ────────────────────────────────
const DRAFT_KEY = 'village_add_draft'

const ACCESS_LEVELS = [
  { id: 'close_friends',      label: 'Nære venner',       emoji: '❤️',  description: 'Kun de du har merket som nære venner' },
  { id: 'friends',            label: 'Venner',             emoji: '👥',  description: 'Alle du er venner med' },
  { id: 'friends_of_friends', label: 'Venners venner',     emoji: '🌐',  description: 'Venner og deres venner' },
  { id: 'community',          label: 'Spesifikke kretser', emoji: '🏘️', description: 'Velg hvilke kretser som kan låne' },
  { id: 'public',             label: 'Alle',               emoji: '🌍',  description: 'Synlig for alle på Village' },
]

const PRICE_TYPES = [
  { id: 'per_day',  label: 'per dag' },
  { id: 'per_week', label: 'per uke' },
  { id: 'flat',     label: 'engangsbeløp' },
]

const LEVEL_ORDER = ['close_friends', 'friends', 'friends_of_friends', 'community', 'public']

const INCLUDED_BY: Record<string, string> = {
  close_friends: 'Venner',
  friends: 'Venners venner',
  friends_of_friends: 'Alle',
}

type AccessEntry = {
  access_type: string
  community_id?: string
  price?: number
  price_type: string
}

function PriceRow({ price, priceType, onPriceChange, onTypeChange, placeholder }: {
  price?: number
  priceType: string
  onPriceChange: (val: string) => void
  onTypeChange: (val: string) => void
  placeholder?: string
}) {
  return (
    <div className="pt-3 mt-3" style={{ borderTop: '1px solid rgba(46,98,113,0.12)' }}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder={placeholder || '0'}
          value={price || ''}
          onChange={e => onPriceChange(e.target.value)}
          className="glass flex-1 outline-none text-sm"
          style={{ borderRadius: 10, padding: '8px 12px', color: 'var(--terra-dark)' }}
        />
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--terra-mid)' }}>kr</span>
        <select
          value={priceType}
          onChange={e => onTypeChange(e.target.value)}
          className="glass outline-none text-xs flex-shrink-0"
          style={{ borderRadius: 10, padding: '8px 10px', color: 'var(--terra-dark)' }}
        >
          {PRICE_TYPES.map(pt => (
            <option key={pt.id} value={pt.id}>{pt.label}</option>
          ))}
        </select>
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--terra-mid)', opacity: 0.7 }}>
        La stå tom for gratis
      </p>
    </div>
  )
}

function AccessPageInner() {
  const [communities, setCommunities]       = useState<any[]>([])
  const [selectedLevels, setSelectedLevels] = useState<AccessEntry[]>([
    { access_type: 'close_friends', price_type: 'per_day' },
    { access_type: 'friends',       price_type: 'per_day' },
  ])
  const [allCommunities, setAllCommunities] = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saveError, setSaveError]           = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [draftName, setDraftName]           = useState<string | null>(null)
  const [showFollowUp, setShowFollowUp]     = useState(false)
  const [savedItemId, setSavedItemId]       = useState<string | null>(null)
  const [ownedItems, setOwnedItems]         = useState<string[]>([])
  const [listedItems, setListedItems]       = useState<string[]>([])

  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) { router.push('/add'); return }

      let draft: any = null
      try { draft = JSON.parse(raw) } catch { router.push('/add'); return }
      if (!draft?.name) { router.push('/add'); return }

      setDraftName(draft.name)

      const { data: memberships } = await supabase
        .from('community_members')
        .select('communities(id, name, avatar_emoji)')
        .eq('user_id', user.id)
        .eq('status', 'active')
      setCommunities((memberships || []).map((m: any) => m.communities))

      const { data: myItems } = await supabase
        .from('items').select('name').eq('owner_id', user.id)
      setListedItems((myItems || []).map((i: any) => i.name))

      try {
        const raw = localStorage.getItem('village_owned_items')
        if (raw) setOwnedItems(JSON.parse(raw))
      } catch { /* ignore */ }

      track('access_page_viewed', { mode: 'new' })
      setLoading(false)
    }
    load()
  }, [])

  const suggestedPrice = (() => {
    for (const id of ['close_friends', 'friends', 'friends_of_friends']) {
      const e = selectedLevels.find(l => l.access_type === id && !l.community_id)
      if (e?.price) return { price: e.price, price_type: e.price_type }
    }
    return null
  })()

  const toggleNamedLevel = (levelId: string) => {
    const idx = LEVEL_ORDER.indexOf(levelId)
    if (idx === -1) return
    const isSelected = selectedLevels.some(l => l.access_type === levelId && !l.community_id)
    if (isSelected) {
      const toRemove = LEVEL_ORDER.slice(0, idx + 1)
      setSelectedLevels(prev => prev.filter(l => l.community_id || !toRemove.includes(l.access_type)))
    } else {
      const toAdd = LEVEL_ORDER.slice(0, idx + 1)
      setSelectedLevels(prev => {
        const existing      = prev.filter(l => l.community_id)
        const namedExisting = prev.filter(l => !l.community_id)
        const newEntries    = toAdd
          .filter(id => !namedExisting.some(l => l.access_type === id))
          .map(id => ({ access_type: id, price_type: 'per_day' as const }))
        return [...namedExisting, ...newEntries, ...existing]
      })
    }
  }

  const toggleCommunity = (communityId: string) => {
    const exists = selectedLevels.find(l => l.community_id === communityId)
    if (exists) {
      setSelectedLevels(prev => prev.filter(l => l.community_id !== communityId))
    } else {
      setSelectedLevels(prev => [...prev, {
        access_type: 'community',
        community_id: communityId,
        price_type: 'per_day',
      }])
    }
  }

  const updatePrice = (levelId: string, communityId: string | undefined, val: string) => {
    setSelectedLevels(prev => prev.map(l => {
      const match = communityId ? l.community_id === communityId : l.access_type === levelId && !l.community_id
      return match ? { ...l, price: val ? parseInt(val) : undefined } : l
    }))
  }

  const updatePriceType = (levelId: string, communityId: string | undefined, val: string) => {
    setSelectedLevels(prev => prev.map(l => {
      const match = communityId ? l.community_id === communityId : l.access_type === levelId && !l.community_id
      return match ? { ...l, price_type: val } : l
    }))
  }

  const updateAllCommunitiesPrice     = (val: string) =>
    setSelectedLevels(prev => prev.map(l => l.community_id ? { ...l, price: val ? parseInt(val) : undefined } : l))
  const updateAllCommunitiesPriceType = (val: string) =>
    setSelectedLevels(prev => prev.map(l => l.community_id ? { ...l, price_type: val } : l))

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ikke innlogget')

      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) throw new Error('Ingen draft funnet')
      const draft = JSON.parse(raw)

      let image_url = ''
      if (draft.selectedImageSrc === 'suggested' && draft.suggestedImageUrl) {
        image_url = draft.suggestedImageUrl
      } else if (draft.imagePreviews?.[0]) {
        image_url = draft.imagePreviews[0]
      }

      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
          owner_id:      user.id,
          name:          draft.name,
          description:   draft.description || null,
          category:      draft.categoryId,
          subcategories: draft.subcategoryIds || [],
          image_url:     image_url || null,
          available:     true,
          location:      draft.location || null,
          color:         draft.color || null,
          size:          draft.size || null,
          gender:        draft.gender || null,
          age_ranges:    draft.ageRanges || [],
        })
        .select()
        .single()

      if (itemError || !item?.id) {
        console.error('Item insert failed:', JSON.stringify(itemError))
        throw new Error('Kunne ikke lagre gjenstanden')
      }

      const communitySelected = selectedLevels.some(l => l.access_type === 'community' && !l.community_id)
      const rows: any[] = selectedLevels
        .filter(l => !(l.access_type === 'community' && !l.community_id && allCommunities))
        .map(l => ({
          item_id:      item.id,
          access_type:  l.access_type,
          community_id: l.community_id || null,
          price:        l.price || null,
          price_type:   l.price_type,
        }))

      if (rows.length > 0) {
        const { error: accessError } = await supabase.from('item_access').insert(rows)
        if (accessError) throw accessError
      }

      track('item_published', {
        item_id:      item.id,
        category:     draft.categoryId,
        access_types: selectedLevels.map(l => l.access_type),
        has_price:    selectedLevels.some(l => !!l.price),
      })

      sessionStorage.removeItem(DRAFT_KEY)
      setSavedItemId(item.id)

      const remaining = ownedItems.filter(i => !listedItems.includes(i))
      if (remaining.length > 0 || ownedItems.length > 0) {
        setSaving(false)
        setShowFollowUp(true)
      } else {
        router.push(`/items/${item.id}`)
      }
    } catch (err: any) {
      console.error('Save error:', err)
      setSaveError(err.message || 'Noe gikk galt. Prøv igjen.')
      setSaving(false)
    }
  }

  const skip = () => { save() }

  const goBack = () => { router.push('/add') }

  if (loading) return (
    <div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>
  )

  const communitySelected  = selectedLevels.some(l => l.access_type === 'community' && !l.community_id)
  const highestSelectedIdx = LEVEL_ORDER.reduce((max, id, i) =>
    selectedLevels.some(l => l.access_type === id && !l.community_id) ? i : max, -1)
  const namedLevels = ACCESS_LEVELS.filter(l => l.id !== 'community' && l.id !== 'public')

  return (
    <div className="max-w-lg mx-auto pb-48">

      <div className="page-header glass sticky top-0 z-40 px-4 pt-3 pb-4"
        style={{ borderRadius: '0 0 20px 20px', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button
          onClick={goBack}
          className="btn-glass flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--terra)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Tilbake
        </button>
        <h1 className="font-display font-bold mt-2"
          style={{ fontSize: 20, color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
          {draftName ? `Hvem kan låne ${draftName}?` : 'Hvem kan låne dette?'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--terra-mid)' }}>
          Velg én eller flere grupper og sett pris per gruppe
        </p>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-3">

        {namedLevels.map((level) => {
          const entry              = selectedLevels.find(l => l.access_type === level.id && !l.community_id)
          const selected           = !!entry
          const levelOrderIdx      = LEVEL_ORDER.indexOf(level.id)
          const implicitlySelected = !selected && highestSelectedIdx > levelOrderIdx

          return (
            <div key={level.id} className="glass" style={{ borderRadius: 16, padding: 16, opacity: implicitlySelected ? 0.6 : 1 }}>
              <button onClick={() => toggleNamedLevel(level.id)} className="w-full flex items-center gap-3 text-left">
                <span style={{ fontSize: 22 }}>{level.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{level.label}</p>
                  {implicitlySelected && INCLUDED_BY[level.id] ? (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                      Inkludert fordi du valgte {INCLUDED_BY[level.id]}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{level.description}</p>
                  )}
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    background: selected || implicitlySelected ? 'var(--terra)' : 'transparent',
                    border: selected || implicitlySelected ? 'none' : '2px solid rgba(46,98,113,0.25)',
                    opacity: implicitlySelected ? 0.5 : 1,
                  }}>
                  {(selected || implicitlySelected) && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
              {selected && (
                <PriceRow
                  price={entry?.price}
                  priceType={entry?.price_type || 'per_day'}
                  onPriceChange={val => updatePrice(level.id, undefined, val)}
                  onTypeChange={val => updatePriceType(level.id, undefined, val)}
                  placeholder={suggestedPrice && !entry?.price ? `${suggestedPrice.price}` : undefined}
                />
              )}
            </div>
          )
        })}

        {/* Spesifikke kretser */}
        <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
          <button onClick={() => toggleNamedLevel('community')} className="w-full flex items-center gap-3 text-left">
            <span style={{ fontSize: 22 }}>🏘️</span>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>Spesifikke kretser</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>Velg hvilke kretser som kan låne</p>
            </div>
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: communitySelected ? 'var(--terra)' : 'transparent', border: communitySelected ? 'none' : '2px solid rgba(46,98,113,0.25)' }}>
              {communitySelected && <span className="text-white text-xs">✓</span>}
            </div>
          </button>

          {communitySelected && communities.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              <button onClick={() => setAllCommunities(prev => !prev)} className="flex items-center gap-3 w-full">
                <div className="w-10 rounded-full flex-shrink-0 transition-colors"
                  style={{ height: 24, background: allCommunities ? 'var(--terra)' : 'rgba(46,98,113,0.15)', padding: 2, display: 'flex', alignItems: 'center' }}>
                  <div className="rounded-full bg-white transition-transform"
                    style={{ width: 20, height: 20, transform: allCommunities ? 'translateX(16px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Alle kretser</span>
              </button>

              {allCommunities && (
                <PriceRow
                  price={selectedLevels.find(l => l.community_id)?.price}
                  priceType={selectedLevels.find(l => l.community_id)?.price_type || 'per_day'}
                  onPriceChange={val => updateAllCommunitiesPrice(val)}
                  onTypeChange={val => updateAllCommunitiesPriceType(val)}
                  placeholder={suggestedPrice ? `${suggestedPrice.price}` : undefined}
                />
              )}

              {!allCommunities && (
                <div className="flex flex-col gap-2">
                  {communities.map((c: any) => {
                    const cEntry    = selectedLevels.find(l => l.community_id === c.id)
                    const cSelected = !!cEntry
                    return (
                      <div key={c.id} className="glass" style={{ borderRadius: 12, padding: 12 }}>
                        <button onClick={() => toggleCommunity(c.id)} className="w-full flex items-center gap-3 text-left">
                          <span style={{ fontSize: 18 }}>{c.avatar_emoji}</span>
                          <p className="flex-1 font-medium text-sm" style={{ color: 'var(--terra-dark)' }}>{c.name}</p>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: cSelected ? 'var(--terra)' : 'transparent', border: cSelected ? 'none' : '2px solid rgba(46,98,113,0.25)' }}>
                            {cSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </button>
                        {cSelected && (
                          <PriceRow
                            price={cEntry?.price}
                            priceType={cEntry?.price_type || 'per_day'}
                            onPriceChange={val => updatePrice('community', c.id, val)}
                            onTypeChange={val => updatePriceType('community', c.id, val)}
                            placeholder={suggestedPrice ? `${suggestedPrice.price}` : undefined}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {communitySelected && communities.length === 0 && (
            <p className="text-xs mt-3" style={{ color: 'var(--terra-mid)' }}>Du er ikke med i noen kretser ennå</p>
          )}
        </div>

        {/* Alle */}
        {(() => {
          const level    = ACCESS_LEVELS.find(l => l.id === 'public')!
          const entry    = selectedLevels.find(l => l.access_type === 'public' && !l.community_id)
          const selected = !!entry
          return (
            <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
              <button onClick={() => toggleNamedLevel('public')} className="w-full flex items-center gap-3 text-left">
                <span style={{ fontSize: 22 }}>{level.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{level.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{level.description}</p>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: selected ? 'var(--terra)' : 'transparent', border: selected ? 'none' : '2px solid rgba(46,98,113,0.25)' }}>
                  {selected && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
              {selected && (
                <PriceRow
                  price={entry?.price}
                  priceType={entry?.price_type || 'per_day'}
                  onPriceChange={val => updatePrice('public', undefined, val)}
                  onTypeChange={val => updatePriceType('public', undefined, val)}
                  placeholder={suggestedPrice ? `${suggestedPrice.price}` : undefined}
                />
              )}
            </div>
          )
        })()}

        {saveError && (
          <div className="glass" style={{ borderRadius: 12, padding: '12px 16px' }}>
            <p className="text-sm" style={{ color: '#ef4444' }}>{saveError}</p>
          </div>
        )}
      </div>

      {/* Bunn-CTA */}
      <div className="fixed bottom-16 left-0 right-0 px-4 py-4 flex gap-3"
        style={{
          background: 'rgba(250,247,242,0.85)',
          borderTop: '1px solid rgba(46,98,113,0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        <button onClick={skip} disabled={saving} className="btn-glass flex-1 disabled:opacity-50">
          Hopp over
        </button>
        <button onClick={save} disabled={saving} className="btn-primary flex-grow disabled:opacity-50">
          {saving ? 'Lagrer…' : 'Lagre tilgang'}
        </button>
      </div>

      {/* Follow-up modal */}
      {showFollowUp && savedItemId && (
        <FirstTimeAddItemModal
          ownedItems={ownedItems}
          listedItems={listedItems}
          isFollowUp
          onDismiss={() => {
            setShowFollowUp(false)
            router.push(`/items/${savedItemId}`)
          }}
          onSelectItems={(items) => {
            setShowFollowUp(false)
            router.push(`/add?name=${encodeURIComponent(items[0]?.name ?? '')}`)
          }}
        />
      )}
    </div>
  )
}

export default function AccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--terra-mid)' }}>Laster…</div>}>
      <AccessPageInner />
    </Suspense>
  )
}
