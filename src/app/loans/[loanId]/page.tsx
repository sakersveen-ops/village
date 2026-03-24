'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoanThread from '@/components/LoanThread'
import { track, Events } from '@/lib/track'

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function statusInfo(status: string, role: 'lender' | 'borrower') {
  if (status === 'active')
    return { label: 'Aktivt lån', color: 'var(--terra-green)', bg: 'rgba(74,124,89,0.1)' }
  if (status === 'pending' && role === 'lender')
    return { label: 'Venter på din godkjenning', color: 'var(--terra)', bg: 'rgba(196,103,58,0.1)' }
  if (status === 'pending')
    return { label: 'Venter på godkjenning', color: 'var(--terra)', bg: 'rgba(196,103,58,0.1)' }
  if (status === 'change_proposed')
    return { label: 'Endringsforslag', color: 'var(--terra-mid)', bg: 'rgba(156,123,101,0.12)' }
  if (status === 'returned')
    return { label: 'Returnert', color: 'var(--terra-mid)', bg: 'rgba(156,123,101,0.08)' }
  return { label: status, color: 'var(--terra-mid)', bg: 'rgba(156,123,101,0.08)' }
}

export default function LoanPage() {
  const router   = useRouter()
  const params   = useParams()
  const loanId   = params?.loanId as string

  const [user,     setUser]     = useState<any>(null)
  const [loan,     setLoan]     = useState<any>(null)
  const [item,     setItem]     = useState<any>(null)
  const [owner,    setOwner]    = useState<any>(null)
  const [borrower, setBorrower] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [openProposal,  setOpenProposal]  = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!loanId || loanId === 'undefined') { router.push('/messages'); return }
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Fetch loan — NO items join here to avoid RLS issues
      const { data: loanData, error } = await supabase
        .from('loans')
        .select(`
          id, status, start_date, due_date, message, created_at,
          item_id, owner_id, borrower_id, community_id,
          owner:profiles!loans_owner_id_fkey ( id, name, email, avatar_url ),
          borrower:profiles!loans_borrower_id_fkey ( id, name, email, avatar_url )
        `)
        .eq('id', loanId)
        .single()

      if (error || !loanData) { router.push('/messages'); return }

      // Fetch item separately — RLS on items can block the join above
      const { data: itemData } = await supabase
        .from('items')
        .select('id, name, image_url, category, price, vipps_number, owner_id, connected_profile_id, available')
        .eq('id', loanData.item_id)
        .maybeSingle()

      setLoan(loanData)
      // Safe fallback: if item RLS blocks, we still have item_id for navigation
      setItem(itemData ?? { id: loanData.item_id, name: null, image_url: null })
      setOwner(loanData.owner)
      setBorrower(loanData.borrower)
      setLoading(false)
      track('loan_thread_page_viewed', { loan_id: loanId })
        await supabase
            .from('loan_message_reads')
            .upsert(
                { loan_id: loanId, user_id: user.id, read_at: new Date().toISOString() },
                { onConflict: 'loan_id,user_id' }
            )
    }
    load()
  }, [loanId])

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
      if (item?.id) await supabase.from('items').update({ available: false }).eq('id', item.id)
      await supabase.from('loan_messages').insert({ loan_id: loanId, sender_id: user.id, type: 'system', body: 'Forespørselen ble godtatt — lånet er aktivt.' })
      await supabase.from('notifications').insert({ user_id: loan.borrower_id, type: 'loan_accepted', title: 'Forespørsel godtatt!', body: `${owner?.name ?? 'Eier'} godtok forespørselen din`, loan_id: loanId })
      track(Events.LOAN_ACCEPTED, { loan_id: loanId, item_id: item?.id, handled_by: 'owner' })
      setLoan((p: any) => ({ ...p, status: 'active' }))
      showToast('Forespørsel godtatt ✓')
    } else { showToast('Allerede behandlet') }
    setActionLoading(false)
  }

  async function handleDecline() {
    setActionLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('loans').update({ status: 'declined' })
      .eq('id', loanId).eq('status', 'pending').select().single()
    if (data) {
      await supabase.from('loan_messages').insert({ loan_id: loanId, sender_id: user.id, type: 'system', body: 'Forespørselen ble avslått.' })
      await supabase.from('notifications').insert({ user_id: loan.borrower_id, type: 'loan_declined', title: 'Forespørsel avslått', body: `${owner?.name ?? 'Eier'} avslo forespørselen din`, loan_id: loanId })
      track(Events.LOAN_DECLINED, { loan_id: loanId, item_id: item?.id, handled_by: 'owner' })
      setLoan((p: any) => ({ ...p, status: 'declined' }))
      showToast('Avslått')
    }
    setActionLoading(false)
  }

  async function handleMarkReturned() {
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('loans').update({ status: 'returned' }).eq('id', loanId)
    if (item?.id) await supabase.from('items').update({ available: true }).eq('id', item.id)
    await supabase.from('loan_messages').insert({ loan_id: loanId, sender_id: user.id, type: 'system', body: 'Gjenstanden er markert som returnert.' })
    track('loan_marked_returned', { loan_id: loanId, item_id: item?.id })
    setLoan((p: any) => ({ ...p, status: 'returned' }))
    showToast('Markert som returnert ✓')
    setActionLoading(false)
  }

  // Guard — render nothing until we have loan + user
  if (loading || !loan || !user) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)' }}>Laster…</div>
  )

  const role        = loan.owner_id === user.id ? 'lender' : 'borrower' as 'lender'|'borrower'
  const isOwner     = role === 'lender'
  const counterpart = isOwner ? borrower : owner
  const cpName      = counterpart?.name ?? counterpart?.email?.split('@')[0] ?? 'Ukjent'
  const cpInitials  = cpName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
  const si          = statusInfo(loan.status, role)
  const isLive      = ['pending','active','change_proposed'].includes(loan.status)

  return (
    <div className="max-w-lg mx-auto" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

      {/* Header */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          <button onClick={() => router.push('/messages')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 7px', fontSize: 20, color: 'var(--terra-dark)', lineHeight: 1, flexShrink: 0 }}>
            ←
          </button>

          {/* Avatar — links to profile */}
          <button onClick={() => counterpart?.id && router.push(`/profile/${counterpart.id}`)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: counterpart?.id ? 'pointer' : 'default', flexShrink: 0 }}>
            {counterpart?.avatar_url
              ? <img src={counterpart.avatar_url} alt={cpName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--terra)', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cpInitials}</div>
            }
          </button>

          {/* Name + item subtitle — name links to profile */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={() => counterpart?.id && router.push(`/profile/${counterpart.id}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: counterpart?.id ? 'pointer' : 'default', textAlign: 'left', width: '100%' }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--terra-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cpName}
              </p>
            </button>
            {item?.name && (
              <p style={{ fontSize: 11, color: 'var(--terra-mid)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </p>
            )}
          </div>

          {/* Open item — always use loan.item_id, never item?.id which may be undefined */}
          <button onClick={() => router.push(`/items/${loan.item_id}`)}
            className="btn-glass"
            style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 10, flexShrink: 0 }}>
            Se gjenstand
          </button>
        </div>
      </header>

      {/* Item info card — entire card navigates to item */}
      <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        <button onClick={() => router.push(`/items/${loan.item_id}`)}
          style={{ background: 'none', border: 'none', padding: 0, width: '100%', cursor: 'pointer', textAlign: 'left' }}>
          <div className="glass" style={{ borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 11, alignItems: 'center' }}>
            {item?.image_url
              ? <img src={item.image_url} alt="" style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 50, height: 50, borderRadius: 10, background: 'rgba(196,103,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📦</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              {item?.name && (
                <p className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--terra-mid)', margin: '0 0 5px' }}>
                {isOwner ? `Lånt ut til ${cpName}` : `Eies av ${owner?.name ?? '…'}`}
                {loan.start_date && loan.due_date ? ` · ${fmtDate(loan.start_date)} → ${fmtDate(loan.due_date)}` : ''}
              </p>
              <span style={{ display: 'inline-block', borderRadius: 99, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, background: si.bg, color: si.color }}>
                {si.label}
              </span>
            </div>
            {(item?.price ?? 0) > 0 && (
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--terra-dark)', margin: 0 }}>{item.price} kr</p>
                {item.vipps_number && <p style={{ fontSize: 10, color: 'var(--terra-mid)', margin: '2px 0 0' }}>Vipps {item.vipps_number}</p>}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Action bar — context-sensitive */}
      {isLive && (
        <div style={{ padding: '8px 14px 0', flexShrink: 0, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {isOwner && loan.status === 'pending' && (
            <>
              <button onClick={handleAccept} disabled={actionLoading} className="btn-primary"
                style={{ flex: 1, minWidth: 120, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}>
                ✓ Godta forespørsel
              </button>
              <button onClick={handleDecline} disabled={actionLoading} className="btn-glass"
                style={{ flex: 1, minWidth: 80, fontSize: 13, opacity: actionLoading ? 0.6 : 1 }}>
                Avslå
              </button>
            </>
          )}
          {isOwner && loan.status === 'active' && (
            <button onClick={handleMarkReturned} disabled={actionLoading} className="btn-glass"
              style={{ flex: 1, fontSize: 13, color: 'var(--terra-green)', opacity: actionLoading ? 0.6 : 1 }}>
              ✓ Marker som returnert
            </button>
          )}
          {/* Proposal button — not shown when accept/decline is visible */}
          {!(isOwner && loan.status === 'pending') && (
            <button onClick={() => setOpenProposal(true)} className="btn-glass"
              style={{ flex: 1, fontSize: 13 }}>
              📅 {role === 'borrower' ? 'Endre datoer' : 'Foreslå datoendring'}
            </button>
          )}
        </div>
      )}

      {/* Thread — only render when item is ready to avoid null.owner_id in LoanThread */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <LoanThread
          loan={loan}
          item={item}
          user={user}
          isOwner={isOwner}
          onLoanUpdated={(updated: any) => setLoan((p: any) => ({ ...p, ...updated }))}
          openProposal={openProposal}
          onProposalOpened={() => setOpenProposal(false)}
        />
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'var(--terra-dark)', color: 'white', padding: '10px 20px', borderRadius: 99, fontSize: 13, fontWeight: 600, zIndex: 99, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}

      <div className="nav-spacer" />
    </div>
  )
}
