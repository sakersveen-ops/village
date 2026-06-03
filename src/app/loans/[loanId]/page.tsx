// Path of this file: src/app/loans/[loanId]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoanThread from '@/components/LoanThread'
import { track, Events } from '@/lib/track'

export default function LoanPage() {
  const router  = useRouter()
  const params  = useParams()
  const loanId  = params?.loanId as string

  const [user,         setUser]         = useState<any>(null)
  const [loan,         setLoan]         = useState<any>(null)
  const [item,         setItem]         = useState<any>(null)
  const [userProfile,  setUserProfile]  = useState<any>(null)
  const [owner,        setOwner]        = useState<any>(null)
  const [borrower,     setBorrower]     = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [responding,   setResponding]   = useState(false)
  const [openProposal, setOpenProposal] = useState(false)

  useEffect(() => {
    if (!loanId || loanId === 'undefined') { router.push('/messages'); return }
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles').select('id, name').eq('id', user.id).single()
      setUserProfile(prof)

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

      const { data: itemData } = await supabase
        .from('items')
        .select('id, name, image_url, category, price, vipps_number, owner_id, connected_profile_id, available, profiles!items_owner_id_fkey(id, name, email, avatar_url)')
        .eq('id', loanData.item_id)
        .maybeSingle()

      setLoan(loanData)
      setItem(itemData ?? { id: loanData.item_id, name: null, image_url: null })
      setOwner(loanData.owner)
      setBorrower(loanData.borrower)
      setLoading(false)
      track('loan_thread_page_viewed', { loan_id: loanId })
    }
    load()
  }, [loanId])

  const fd = (d: string) => new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })

  const respondToLoan = async (accept: boolean) => {
    if (!loan || responding) return
    setResponding(true)
    const supabase = createClient()

    const { data: updated } = await supabase
      .from('loans')
      .update({ status: accept ? 'confirmed' : 'declined' })
      .eq('id', loan.id)
      .eq('status', 'pending')
      .select().single()

    if (!updated) {
      alert('Denne forespørselen er allerede behandlet.')
      setResponding(false)
      return
    }

    await supabase.from('notifications').update({ read: true })
      .eq('loan_id', loan.id).eq('type', 'loan_request').eq('user_id', user.id)

    const actorName = userProfile?.name || user.email?.split('@')[0]

    await supabase.from('loan_messages').insert({
      loan_id: loan.id, sender_id: user.id, type: 'system',
      body: accept
        ? `✅ Forespørsel godtatt – klar til henting ${loan.start_date ? fd(loan.start_date) : ''}`
        : `❌ Forespørsel avslått`,
    })

    await supabase.from('notifications').insert({
      user_id: loan.borrower_id,
      type: accept ? 'loan_accepted' : 'loan_declined',
      title: accept ? '✓ Forespørsel godtatt!' : 'Forespørsel avslått',
      body: accept
        ? `Lånet av «${item?.name}» er godkjent – klar til henting`
        : `Forespørselen om «${item?.name}» ble avslått`,
      loan_id: loan.id,
    })

    // Notify co-owner if exists
    const isCoOwner = user.id === item?.connected_profile_id
    const nonActorId = isCoOwner ? item?.owner_id : item?.connected_profile_id
    if (nonActorId) {
      await supabase.from('notifications').insert({
        user_id: nonActorId,
        type: accept ? 'loan_accepted_coowner' : 'loan_declined_coowner',
        title: accept ? `🔗 Forespørsel godtatt av ${actorName}` : `🔗 Forespørsel avslått av ${actorName}`,
        body: `«${item?.name}» – ${borrower?.name || 'låntaker'}`,
        loan_id: loan.id,
      })
    }

    setLoan((prev: any) => ({ ...prev, status: accept ? 'confirmed' : 'declined' }))
    track(accept ? Events.LOAN_ACCEPTED : Events.LOAN_DECLINED, {
      loan_id: loan.id, item_id: item?.id,
      handled_by: isCoOwner ? 'co_owner' : 'owner',
    })
    setResponding(false)
  }

  if (loading || !loan || !user) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)' }}>Laster…</div>
  )

  const isOwner     = loan.owner_id === user.id || item?.connected_profile_id === user.id
  const counterpart = isOwner ? borrower : owner
  const cpName      = counterpart?.name ?? counterpart?.email?.split('@')[0] ?? 'Ukjent'
  const cpInitials  = cpName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
  const isPending   = loan.status === 'pending'

  return (
    <>
      <style>{`.bottom-nav { display: none !important; }`}</style>
      <div className="max-w-lg mx-auto" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

        {/* Header */}
        <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/messages')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 7px', fontSize: 20, color: 'var(--terra-dark)', lineHeight: 1, flexShrink: 0 }}>
              ←
            </button>

            <button
              onClick={() => counterpart?.id && router.push(`/profile/${counterpart.id}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: counterpart?.id ? 'pointer' : 'default', flexShrink: 0 }}>
              {counterpart?.avatar_url
                ? <img src={counterpart.avatar_url} alt={cpName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--terra)', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cpInitials}</div>
              }
            </button>

            <button
              onClick={() => counterpart?.id && router.push(`/profile/${counterpart.id}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: counterpart?.id ? 'pointer' : 'default', textAlign: 'left', flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--terra-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cpName}
              </p>
            </button>
          </div>
        </header>

        {/* Godta / Avslå — vises kun for eier når status er pending */}
        {isOwner && isPending && (
          <div style={{
            flexShrink: 0, padding: '10px 14px',
            background: 'rgba(255,248,243,0.95)',
            borderBottom: '1px solid rgba(196,103,58,0.15)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--terra-mid)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Forespørsel fra {borrower?.name ?? 'låntaker'}
              {loan.start_date && loan.due_date ? ` · ${fd(loan.start_date)} → ${fd(loan.due_date)}` : ''}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => respondToLoan(true)}
                disabled={responding}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: '#4A7C59', color: 'white',
                  border: 'none', fontWeight: 600, fontSize: 14,
                  cursor: responding ? 'default' : 'pointer',
                  opacity: responding ? 0.6 : 1,
                }}>
                ✓ Godta
              </button>
              <button
                onClick={() => respondToLoan(false)}
                disabled={responding}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'rgba(196,103,58,0.08)',
                  color: 'var(--terra)',
                  border: '1px solid rgba(196,103,58,0.3)',
                  fontWeight: 500, fontSize: 14,
                  cursor: responding ? 'default' : 'pointer',
                  opacity: responding ? 0.6 : 1,
                }}>
                Avslå
              </button>
            </div>
          </div>
        )}

        {/* LoanThread */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 14px 0' }}>
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

      </div>
    </>
  )
}
