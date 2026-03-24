'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import LoanThread from '@/components/LoanThread'
import { track, Events } from '@/lib/track'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function statusInfo(status: string, role: 'lender' | 'borrower'): { label: string; color: string; bg: string } {
  if (status === 'active')          return { label: 'Aktivt lån',              color: 'var(--terra-green)', bg: 'rgba(74,124,89,0.1)'   }
  if (status === 'pending' && role === 'lender')
                                    return { label: 'Venter på din godkjenning', color: 'var(--terra)',       bg: 'rgba(196,103,58,0.1)'  }
  if (status === 'pending')         return { label: 'Venter på godkjenning',   color: 'var(--terra)',       bg: 'rgba(196,103,58,0.1)'  }
  if (status === 'change_proposed') return { label: 'Endringsforslag',         color: 'var(--terra-mid)',   bg: 'rgba(156,123,101,0.12)'}
  if (status === 'returned')        return { label: 'Returnert',               color: 'var(--terra-mid)',   bg: 'rgba(156,123,101,0.08)'}
  if (status === 'declined')        return { label: 'Avslått',                 color: 'var(--terra-mid)',   bg: 'rgba(156,123,101,0.08)'}
  return { label: status, color: 'var(--terra-mid)', bg: 'rgba(156,123,101,0.08)' }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoanPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params?.loanId as string

  const [user, setUser]       = useState<any>(null)
  const [loan, setLoan]       = useState<any>(null)
  const [item, setItem]       = useState<any>(null)
  const [owner, setOwner]     = useState<any>(null)
  const [borrower, setBorrower] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: loanData, error } = await supabase
        .from('loans')
        .select(`
          *,
          items ( id, name, image_url, category, price, vipps_number, owner_id, connected_profile_id, available ),
          owner:profiles!loans_owner_id_fkey ( id, name, email, avatar_url ),
          borrower:profiles!loans_borrower_id_fkey ( id, name, email, avatar_url )
        `)
        .eq('id', loanId)
        .single()

      if (error || !loanData) {
        router.push('/messages')
        return
      }

      setLoan(loanData)
      setItem(loanData.items)
      setOwner(loanData.owner)
      setBorrower(loanData.borrower)
      setLoading(false)

      track('loan_thread_page_viewed', { loan_id: loanId })
    }
    load()
  }, [loanId])

  // -------------------------------------------------------------------------
  // Quick actions
  // -------------------------------------------------------------------------

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleAccept() {
    setActionLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loans').update({ status: 'active' })
      .eq('id', loanId).eq('status', 'pending').select().single()
    if (data) {
      await supabase.from('items').update({ available: false }).eq('id', item.id)
      await supabase.from('loan_messages').insert({
        loan_id: loanId, sender_id: user.id, type: 'system',
        body: 'Forespørselen ble godtatt — lånet er aktivt.',
      })
      await supabase.from('notifications').insert({
        user_id: loan.borrower_id, type: 'loan_accepted',
        title: 'Forespørsel godtatt!', body: `${owner?.name ?? 'Eier'} godtok låneforespørselen`,
        loan_id: loanId,
      })
      track(Events.LOAN_ACCEPTED, { loan_id: loanId, item_id: item.id, handled_by: 'owner' })
      setLoan((prev: any) => ({ ...prev, status: 'active' }))
      showToast('Forespørsel godtatt ✓')
    } else {
      showToast('Allerede behandlet')
    }
    setActionLoading(false)
  }

  async function handleDecline() {
    setActionLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loans').update({ status: 'declined' })
      .eq('id', loanId).eq('status', 'pending').select().single()
    if (data) {
      await supabase.from('loan_messages').insert({
        loan_id: loanId, sender_id: user.id, type: 'system',
        body: 'Forespørselen ble avslått.',
      })
      await supabase.from('notifications').insert({
        user_id: loan.borrower_id, type: 'loan_declined',
        title: 'Forespørsel avslått', body: `${owner?.name ?? 'Eier'} avslo forespørselen`,
        loan_id: loanId,
      })
      track(Events.LOAN_DECLINED, { loan_id: loanId, item_id: item.id, handled_by: 'owner' })
      setLoan((prev: any) => ({ ...prev, status: 'declined' }))
      showToast('Forespørsel avslått')
    }
    setActionLoading(false)
  }

  async function handleMarkReturned() {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    await supabase.from('items').update({ available: true }).eq('id', item.id)
    await supabase.from('loan_messages').insert({
      loan_id: loanId, sender_id: user.id, type: 'system',
      body: 'Gjenstanden er markert som returnert.',
    })
    track('loan_marked_returned', { loan_id: loanId, item_id: item.id })
    setLoan((prev: any) => ({ ...prev, status: 'returned' }))
    showToast('Markert som returnert ✓')
    setActionLoading(false)
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)' }}>Laster…</div>
  )

  const role: 'lender' | 'borrower' = loan.owner_id === user.id ? 'lender' : 'borrower'
  const isOwner = role === 'lender'
  const counterpart = isOwner ? borrower : owner
  const cpName = counterpart?.name ?? counterpart?.email?.split('@')[0] ?? 'Ukjent'
  const cpInitials = cpName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
  const si = statusInfo(loan.status, role)

  // Show quick actions bar?
  const showAcceptDecline = isOwner && loan.status === 'pending'
  const showMarkReturned  = isOwner && loan.status === 'active'
  const showActions = showAcceptDecline || showMarkReturned

  return (
    <div className="max-w-lg mx-auto" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back to messages */}
          <button
            onClick={() => router.push('/messages')}
            className="btn-glass"
            style={{ padding: '7px 10px', borderRadius: 12, fontSize: 18, lineHeight: 1, flexShrink: 0 }}
            aria-label="Tilbake til meldinger"
          >
            ←
          </button>

          {/* Counterpart avatar */}
          <div style={{ flexShrink: 0 }}>
            {counterpart?.avatar_url
              ? <img src={counterpart.avatar_url} alt={cpName} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>
                  {cpInitials}
                </div>
            }
          </div>

          {/* Name + item */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/profile/${counterpart?.id}`} style={{ textDecoration: 'none' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--terra-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cpName}
              </p>
            </Link>
            <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item?.name ?? ''}
            </p>
          </div>

          {/* Link to item page */}
          <button
            onClick={() => router.push(`/items/${item?.id}`)}
            className="btn-glass"
            style={{ padding: '7px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            Gjenstand
          </button>
        </div>
      </header>

      {/* ── Item info card ────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <div className="glass" style={{ borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Thumbnail */}
          <button onClick={() => router.push(`/items/${item?.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
            {item?.image_url
              ? <img src={item.image_url} alt={item.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(196,103,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>
            }
          </button>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={() => router.push(`/items/${item?.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <p className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item?.name}
              </p>
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--terra-mid)', margin: '0 0 5px' }}>
              {isOwner
                ? `Lånt ut til ${cpName}`
                : `Eies av ${owner?.name ?? 'ukjent'}`}
              {loan.start_date && loan.due_date
                ? ` · ${fmtDate(loan.start_date)} → ${fmtDate(loan.due_date)}`
                : ''}
            </p>
            <span style={{ display: 'inline-block', borderRadius: 99, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, background: si.bg, color: si.color }}>
              {si.label}
            </span>
          </div>

          {/* Price if set */}
          {item?.price > 0 && (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--terra-dark)', margin: 0 }}>{item.price} kr</p>
              {item.vipps_number && (
                <p style={{ fontSize: 10.5, color: 'var(--terra-mid)', margin: '2px 0 0' }}>Vipps {item.vipps_number}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick action bar ──────────────────────────────────────── */}
      {showActions && (
        <div style={{ padding: '10px 14px 0', flexShrink: 0, display: 'flex', gap: 8 }}>
          {showAcceptDecline && (
            <>
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="btn-primary"
                style={{ flex: 1, opacity: actionLoading ? 0.6 : 1 }}
              >
                ✓ Godta forespørsel
              </button>
              <button
                onClick={handleDecline}
                disabled={actionLoading}
                className="btn-glass"
                style={{ flex: 1, opacity: actionLoading ? 0.6 : 1 }}
              >
                Avslå
              </button>
            </>
          )}
          {showMarkReturned && (
            <button
              onClick={handleMarkReturned}
              disabled={actionLoading}
              className="btn-glass"
              style={{ flex: 1, opacity: actionLoading ? 0.6 : 1, color: 'var(--terra-green)', borderColor: 'rgba(74,124,89,0.3)' }}
            >
              ✓ Marker som returnert
            </button>
          )}
        </div>
      )}

      {/* ── Thread ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LoanThread
          loan={loan}
          item={item}
          user={user}
          isOwner={isOwner}
          onLoanUpdated={(updatedLoan) => setLoan((prev: any) => ({ ...prev, ...updatedLoan }))}
        />
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--terra-dark)', color: 'white',
          padding: '10px 20px', borderRadius: 99, fontSize: 13, fontWeight: 600,
          zIndex: 99, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(44,26,14,0.2)',
        }}>
          {toast}
        </div>
      )}

      <div className="nav-spacer" />
    </div>
  )
}
