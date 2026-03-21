'use client'
// GroupLoanRequestCard.tsx
// Drop into /schedule page to render group loan requests in the owner's view.
// Fetch alongside normal loans:
//   SELECT group_loan_requests + group_loan_request_items + items + profiles(borrower)
//   WHERE owner_id=$me AND status='pending'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/track'

interface RequestItem {
  id: string
  item_id: string
  status: 'included' | 'unavailable' | 'excluded' | 'accepted' | 'declined'
  items: {
    id: string
    name: string
    image_url: string | null
    category: string
  }
}

interface GroupRequest {
  id: string
  borrower_id: string
  start_date: string
  due_date: string
  message: string | null
  status: string
  profiles: { name: string | null; email: string | null; avatar_url: string | null }
  group_loan_request_items: RequestItem[]
}

interface GroupLoanRequestCardProps {
  request: GroupRequest
  onUpdated: () => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  barn: '🧸', kjole: '👗', verktøy: '🔧', bok: '📚', annet: '📦',
}

export default function GroupLoanRequestCard({ request, onUpdated }: GroupLoanRequestCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [responding, setResponding] = useState(false)
  // Per-item toggle for partial accept
  const [itemDecisions, setItemDecisions] = useState<Record<string, 'accepted' | 'declined'>>(
    Object.fromEntries(
      request.group_loan_request_items
        .filter(i => i.status === 'included')
        .map(i => [i.item_id, 'accepted' as const])
    )
  )

  const borrowerName = request.profiles?.name || request.profiles?.email?.split('@')[0] || 'Noen'
  const includedItems = request.group_loan_request_items.filter(i => i.status === 'included')
  const acceptedCount = Object.values(itemDecisions).filter(v => v === 'accepted').length

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  const respond = async () => {
    setResponding(true)
    const supabase = createClient()

    // Update each item
    for (const ri of includedItems) {
      await supabase
        .from('group_loan_request_items')
        .update({ status: itemDecisions[ri.item_id] ?? 'declined' })
        .eq('id', ri.id)
    }

    // Determine overall status
    const acceptedItems = includedItems.filter(i => itemDecisions[i.item_id] === 'accepted')
    const newStatus = acceptedItems.length === 0
      ? 'declined'
      : acceptedItems.length === includedItems.length
        ? 'accepted'
        : 'partial'

    await supabase
      .from('group_loan_requests')
      .update({ status: newStatus })
      .eq('id', request.id)

    // Notify borrower
    const notifType = newStatus === 'accepted'
      ? 'group_loan_accepted'
      : newStatus === 'partial'
        ? 'group_loan_partial'
        : 'group_loan_declined'

    const notifBody = newStatus === 'accepted'
      ? `Alle gjenstander godtatt (${formatDate(request.start_date)} – ${formatDate(request.due_date)})`
      : newStatus === 'partial'
        ? `${acceptedItems.length} av ${includedItems.length} gjenstander godtatt`
        : 'Forespørselen ble avslått'

    await supabase.from('notifications').insert({
      user_id: request.borrower_id,
      type: notifType,
      title: newStatus === 'declined' ? 'Forespørsel avslått' : 'Svar på gruppeforespørsel',
      body: notifBody,
      action_url: '/schedule',
    })

    track('group_loan_request_responded', {
      request_id: request.id,
      status: newStatus,
      accepted_count: acceptedItems.length,
      total_count: includedItems.length,
    })

    setResponding(false)
    onUpdated()
  }

  const declineAll = async () => {
    setItemDecisions(
      Object.fromEntries(includedItems.map(i => [i.item_id, 'declined' as const]))
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: '#fff', border: '1px solid #E8DDD0' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {/* Avatar */}
        <div
          className="flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: '50%', background: '#E8DDD0', color: '#6B4226' }}
        >
          {request.profiles?.avatar_url
            ? <img src={request.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
            : borrowerName[0]?.toUpperCase()
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm" style={{ color: 'var(--terra-dark)' }}>{borrowerName}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ background: '#FFF7ED', color: '#B45309', border: '1px solid #F5C28A' }}
            >
              Gruppe
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>
            {includedItems.length} gjenstander · {formatDate(request.start_date)} – {formatDate(request.due_date)}
          </p>
        </div>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4">
          {request.message && (
            <p className="text-sm mb-3 px-1" style={{ color: 'var(--terra-dark)' }}>
              "{request.message}"
            </p>
          )}

          {/* Items — per-item accept/decline toggle */}
          <div className="flex flex-col gap-2 mb-4">
            {includedItems.map(ri => {
              const decision = itemDecisions[ri.item_id] ?? 'accepted'
              return (
                <div
                  key={ri.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: decision === 'declined' ? '#FAF7F2' : '#F0F7F2',
                    border: `1px solid ${decision === 'declined' ? '#E8DDD0' : '#B8D8C4'}`,
                    opacity: decision === 'declined' ? 0.6 : 1,
                    transition: 'all 150ms',
                  }}
                >
                  {ri.items.image_url
                    ? <img src={ri.items.image_url} className="rounded-lg object-cover flex-shrink-0"
                        style={{ width: 36, height: 36 }} alt={ri.items.name} />
                    : <div className="rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ width: 36, height: 36, background: '#E8DDD0', fontSize: 18 }}>
                        {CATEGORY_EMOJI[ri.items.category] ?? '📦'}
                      </div>
                  }
                  <p className="flex-1 font-medium text-sm truncate" style={{ color: 'var(--terra-dark)' }}>
                    {ri.items.name}
                  </p>
                  {/* Toggle */}
                  <button
                    onClick={() => setItemDecisions(prev => ({
                      ...prev,
                      [ri.item_id]: prev[ri.item_id] === 'accepted' ? 'declined' : 'accepted',
                    }))}
                    className="rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold px-3 py-1"
                    style={decision === 'accepted'
                      ? { background: 'var(--terra-green)', color: '#fff' }
                      : { background: '#E8DDD0', color: 'var(--terra-mid)' }
                    }
                  >
                    {decision === 'accepted' ? '✓ Godta' : 'Avslå'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <p className="text-xs text-center mb-3" style={{ color: 'var(--terra-mid)' }}>
            {acceptedCount} av {includedItems.length} gjenstander vil bli godtatt
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={declineAll}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #E8DDD0', color: 'var(--terra-mid)' }}
            >
              Avslå alle
            </button>
            <button
              onClick={respond}
              disabled={responding}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: acceptedCount > 0 ? 'var(--terra-green)' : '#E8DDD0',
                color: acceptedCount > 0 ? '#fff' : 'var(--terra-mid)',
                opacity: responding ? 0.7 : 1,
              }}
            >
              {responding ? '…' : `Godta ${acceptedCount > 0 ? `(${acceptedCount})` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
