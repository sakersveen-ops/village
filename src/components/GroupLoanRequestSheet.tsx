'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

interface SlideItem {
  id: string
  name: string
  image_url: string | null
  category: string
  available: boolean
  price: number | null
}

interface GroupLoanRequestSheetProps {
  ownerId: string
  storyId: string
  heartedItems: SlideItem[]
  onClose: () => void
  onSent: () => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

type ItemStatus = 'included' | 'unavailable' | 'excluded'

export default function GroupLoanRequestSheet({
  ownerId, storyId, heartedItems, onClose, onSent,
}: GroupLoanRequestSheetProps) {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [step, setStep] = useState<'dates' | 'review' | 'sending'>('dates')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState(tomorrow)
  const [message, setMessage] = useState('')
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({})
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const checkAvailability = async () => {
    if (!startDate || !dueDate || startDate >= dueDate) {
      setError('Velg gyldige datoer')
      return
    }
    setChecking(true)
    setError('')
    const supabase = createClient()

    // For each item, check if there's a conflicting active/pending loan
    const statuses: Record<string, ItemStatus> = {}
    for (const item of heartedItems) {
      const { data: conflicting } = await supabase
        .from('loans')
        .select('id')
        .eq('item_id', item.id)
        .in('status', ['active', 'pending', 'change_proposed'])
        .or(`start_date.lte.${dueDate},due_date.gte.${startDate}`)
        .limit(1)

      // Also check blocked dates
      const { data: blocked } = await supabase
        .from('item_blocked_dates')
        .select('date')
        .eq('item_id', item.id)
        .gte('date', startDate)
        .lte('date', dueDate)
        .limit(1)

      const hasConflict = (conflicting && conflicting.length > 0) || (blocked && blocked.length > 0)
      statuses[item.id] = hasConflict ? 'unavailable' : 'included'
    }

    setItemStatuses(statuses)
    setStep('review')
    setChecking(false)
  }

  const toggleItem = (itemId: string) => {
    setItemStatuses(prev => {
      const curr = prev[itemId]
      if (curr === 'unavailable') return prev // can't toggle unavailable, only date change can fix
      return { ...prev, [itemId]: curr === 'included' ? 'excluded' : 'included' }
    })
  }

  const includedItems = heartedItems.filter(i => itemStatuses[i.id] === 'included')
  const unavailableItems = heartedItems.filter(i => itemStatuses[i.id] === 'unavailable')
  const excludedItems = heartedItems.filter(i => itemStatuses[i.id] === 'excluded')
  const hasUnavailable = unavailableItems.length > 0

  const sendRequest = async () => {
    if (includedItems.length === 0) {
      setError('Ingen gjenstander er valgt')
      return
    }
    setStep('sending')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Insert group request
    const { data: req, error: reqErr } = await supabase
      .from('group_loan_requests')
      .insert({
        borrower_id: user.id,
        owner_id: ownerId,
        story_id: storyId,
        start_date: startDate,
        due_date: dueDate,
        message: message || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (reqErr || !req) {
      setError('Noe gikk galt. Prøv igjen.')
      setStep('review')
      return
    }

    // Insert items (included + unavailable marked)
    const itemRows = heartedItems
      .filter(i => itemStatuses[i.id] !== 'excluded')
      .map(i => ({
        request_id: req.id,
        item_id: i.id,
        status: itemStatuses[i.id] as ItemStatus,
      }))

    await supabase.from('group_loan_request_items').insert(itemRows)

    // Notify owner
    const { data: borrowerProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user.id).single()
    const borrowerName = borrowerProfile?.name || borrowerProfile?.email?.split('@')[0] || 'Noen'

    await supabase.from('notifications').insert({
      user_id: ownerId,
      type: 'group_loan_request',
      title: 'Ny gruppeforespørsel',
      body: `${borrowerName} vil låne ${includedItems.length} ${includedItems.length === 1 ? 'gjenstand' : 'gjenstander'} (${startDate} – ${dueDate})`,
      action_url: `/schedule`,
    })

    track('group_loan_request_sent', {
      owner_id: ownerId,
      story_id: storyId,
      items_count: includedItems.length,
      unavailable_count: unavailableItems.length,
      excluded_count: excludedItems.length,
    })

    onSent()
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="glass-heavy w-full flex flex-col"
        style={{
          borderRadius: '24px 24px 0 0',
          maxHeight: '90vh',
          overflowY: 'auto',
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="rounded-full" style={{ width: 36, height: 4, background: '#E8DDD0' }} />
        </div>

        {/* ── Step: Dates ── */}
        {step === 'dates' && (
          <div className="px-5 pb-8">
            <h2 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--terra-dark)' }}>
              Velg datoer
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--terra-mid)' }}>
              For {heartedItems.length} {heartedItems.length === 1 ? 'gjenstand' : 'gjenstander'}
            </p>

            {/* Hearted items preview */}
            <div className="flex flex-wrap gap-2 mb-6">
              {heartedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: '#FAF7F2', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
                >
                  <span>{CATEGORY_EMOJI[item.category] ?? '📦'}</span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>

            {/* Date inputs */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--terra-mid)' }}>Fra</label>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid #E8DDD0', color: 'var(--terra-dark)' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--terra-mid)' }}>Til</label>
                <input
                  type="date"
                  value={dueDate}
                  min={startDate || today}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid #E8DDD0', color: 'var(--terra-dark)' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--terra-mid)' }}>Melding (valgfri)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Hei! Kan jeg låne disse…"
                rows={2}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: '#fff', border: '1.5px solid #E8DDD0', color: 'var(--terra-dark)' }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
              />
            </div>

            {error && <p className="text-sm mb-3" style={{ color: 'var(--terra)' }}>{error}</p>}

            <button
              onClick={checkAvailability}
              disabled={checking}
              className="w-full py-4 rounded-2xl font-semibold text-base"
              style={{ background: 'var(--terra)', color: '#fff', opacity: checking ? 0.7 : 1 }}
            >
              {checking ? 'Sjekker tilgjengelighet…' : 'Sjekk tilgjengelighet →'}
            </button>
            <button onClick={onClose} className="w-full py-3 mt-2 text-sm" style={{ color: 'var(--terra-mid)' }}>
              Avbryt
            </button>
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === 'review' && (
          <div className="px-5 pb-8">
            <h2 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--terra-dark)' }}>
              Gjennomgå forespørsel
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--terra-mid)' }}>
              {formatDate(startDate)} – {formatDate(dueDate)}
            </p>

            {/* Unavailability warning */}
            {hasUnavailable && (
              <div
                className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3"
                style={{ background: '#FFF7ED', border: '1.5px solid #F5C28A' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
                    {unavailableItems.length} {unavailableItems.length === 1 ? 'gjenstand' : 'gjenstander'} er ikke tilgjengelig
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                    Endre datoer eller fjern gjenstander fra forespørselen.
                  </p>
                  <button
                    onClick={() => setStep('dates')}
                    className="text-xs font-semibold mt-2 underline"
                    style={{ color: 'var(--terra)' }}
                  >
                    Endre datoer
                  </button>
                </div>
              </div>
            )}

            {/* Items list */}
            <div className="flex flex-col gap-2 mb-5">
              {heartedItems.map(item => {
                const status = itemStatuses[item.id] ?? 'included'
                const isUnavailable = status === 'unavailable'
                const isExcluded = status === 'excluded'

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: isUnavailable ? '#FFF7ED' : isExcluded ? '#F5F5F5' : '#fff',
                      border: isUnavailable ? '1.5px solid #F5C28A' : '1px solid #E8DDD0',
                      opacity: isExcluded ? 0.5 : 1,
                    }}
                  >
                    {/* Thumbnail */}
                    {item.image_url
                      ? <img src={item.image_url} className="rounded-xl object-cover flex-shrink-0"
                          style={{ width: 44, height: 44 }} alt={item.name} />
                      : <div className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ width: 44, height: 44, background: '#E8DDD0' }}>
                          {CATEGORY_EMOJI[item.category] ?? '📦'}
                        </div>
                    }

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                        {item.name}
                      </p>
                      {isUnavailable && (
                        <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                          ⚠️ Ikke tilgjengelig
                        </p>
                      )}
                    </div>

                    {/* Toggle */}
                    {!isUnavailable && (
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: 28, height: 28,
                          background: isExcluded ? '#E8DDD0' : 'var(--terra)',
                          transition: 'background 200ms',
                        }}
                        aria-label={isExcluded ? 'Legg til' : 'Fjern'}
                      >
                        {isExcluded
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9C7B65" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        }
                      </button>
                    )}

                    {isUnavailable && (
                      <div
                        className="rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ width: 28, height: 28, background: '#F5C28A' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div
              className="rounded-2xl px-4 py-3 mb-5 flex items-center justify-between"
              style={{ background: '#FAF7F2', border: '1px solid #E8DDD0' }}
            >
              <span className="text-sm" style={{ color: 'var(--terra-mid)' }}>Gjenstander i forespørsel</span>
              <span className="font-bold text-sm" style={{ color: 'var(--terra-dark)' }}>
                {includedItems.length} / {heartedItems.length}
              </span>
            </div>

            {error && <p className="text-sm mb-3" style={{ color: 'var(--terra)' }}>{error}</p>}

            <button
              onClick={sendRequest}
              disabled={includedItems.length === 0}
              className="w-full py-4 rounded-2xl font-semibold text-base mb-2"
              style={{
                background: includedItems.length === 0 ? '#E8DDD0' : 'var(--terra)',
                color: includedItems.length === 0 ? 'var(--terra-mid)' : '#fff',
              }}
            >
              Send forespørsel ({includedItems.length} {includedItems.length === 1 ? 'gjenstand' : 'gjenstander'})
            </button>
            <button onClick={() => setStep('dates')} className="w-full py-2 text-sm" style={{ color: 'var(--terra-mid)' }}>
              ← Endre datoer
            </button>
          </div>
        )}

        {/* ── Step: Sending ── */}
        {step === 'sending' && (
          <div className="px-5 pb-10 flex flex-col items-center justify-center" style={{ minHeight: 240 }}>
            <div className="text-4xl mb-3">📨</div>
            <p className="font-display text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>Sender forespørsel…</p>
          </div>
        )}
      </div>
    </div>
  )
}
