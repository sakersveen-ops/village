'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoanThread from '@/components/LoanThread'
import { track } from '@/lib/track'

export default function LoanPage() {
  const router  = useRouter()
  const params  = useParams()
  const loanId  = params?.loanId as string

  const [user,     setUser]     = useState<any>(null)
  const [loan,     setLoan]     = useState<any>(null)
  const [item,     setItem]     = useState<any>(null)
  const [owner,    setOwner]    = useState<any>(null)
  const [borrower, setBorrower] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [openProposal, setOpenProposal] = useState(false)

  useEffect(() => {
    if (!loanId || loanId === 'undefined') { router.push('/messages'); return }
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

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

  if (loading || !loan || !user) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--terra-mid)' }}>Laster…</div>
  )

  const isOwner     = loan.owner_id === user.id
  const counterpart = isOwner ? borrower : owner
  const cpName      = counterpart?.name ?? counterpart?.email?.split('@')[0] ?? 'Ukjent'
  const cpInitials  = cpName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <style>{`.bottom-nav { display: none !important; }`}</style>
      <div className="max-w-lg mx-auto" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

        {/* Header — bare navn/avatar + tilbake */}
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

        {/* LoanThread — avtalekort + meldinger */}
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
