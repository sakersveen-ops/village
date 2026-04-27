import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kjøres daglig kl 19:00 via Vercel cron (vercel.json)
// Gjør tre ting:
//   1. Sender pickup-varsel til begge parter for lån som starter i morgen
//   2. Sender return-varsel til låntaker for lån som forfaller i morgen
//   3. Setter status = 'overdue' for aktive lån som er forfalt uten bekreftelse

export const runtime = 'edge'

// Beskytter ruten — Vercel sender CRON_SECRET som Bearer-token
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // utvikling uten secret
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — omgår RLS
  )

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const results = { pickup: 0, return: 0, overdue: 0, errors: [] as string[] }

  // ── 1. Pickup-varsler (lån som starter i morgen) ─────────────────────────

  const { data: pickupLoans, error: pickupErr } = await supabase
    .from('loans')
    .select('id, owner_id, borrower_id, start_date, due_date, items(name)')
    .eq('start_date', tomorrowStr)
    .eq('pickup_reminder_sent', false)
    .in('status', ['confirmed', 'pending'])

  if (pickupErr) {
    results.errors.push(`pickup fetch: ${pickupErr.message}`)
  } else {
    for (const loan of pickupLoans ?? []) {
      const itemName = (loan.items as any)?.name ?? 'gjenstanden'
      const notifs = [
        {
          user_id: loan.owner_id,
          type: 'loan_reminder',
          subtype: `pickup_owner_${loan.id}`,
          title: 'Henting i morgen',
          body: `${itemName} hentes i morgen. Husk å bekrefte i appen.`,
          loan_id: loan.id,
          action_url: `/items/${(loan as any).item_id}`,
        },
        {
          user_id: loan.borrower_id,
          type: 'loan_reminder',
          subtype: `pickup_borrower_${loan.id}`,
          title: 'Henting i morgen',
          body: `Du henter ${itemName} i morgen.`,
          loan_id: loan.id,
          action_url: `/items/${(loan as any).item_id}`,
        },
      ]

      const { error: notifErr } = await supabase
        .from('notifications')
        .upsert(notifs, { onConflict: 'subtype', ignoreDuplicates: true })

      if (notifErr) {
        results.errors.push(`pickup notif ${loan.id}: ${notifErr.message}`)
        continue
      }

      await supabase
        .from('loans')
        .update({ pickup_reminder_sent: true })
        .eq('id', loan.id)

      results.pickup++
    }
  }

  // ── 2. Return-varsler (lån som forfaller i morgen) ────────────────────────

  const { data: returnLoans, error: returnErr } = await supabase
    .from('loans')
    .select('id, owner_id, borrower_id, due_date, items(name), item_id')
    .eq('due_date', tomorrowStr)
    .eq('return_reminder_sent', false)
    .in('status', ['active'])

  if (returnErr) {
    results.errors.push(`return fetch: ${returnErr.message}`)
  } else {
    for (const loan of returnLoans ?? []) {
      const itemName = (loan.items as any)?.name ?? 'gjenstanden'

      const { error: notifErr } = await supabase
        .from('notifications')
        .upsert([{
          user_id: loan.borrower_id,
          type: 'loan_reminder',
          subtype: `return_borrower_${loan.id}`,
          title: 'Returner i morgen',
          body: `${itemName} skal returneres i morgen.`,
          loan_id: loan.id,
          action_url: `/items/${loan.item_id}`,
        }], { onConflict: 'subtype', ignoreDuplicates: true })

      if (notifErr) {
        results.errors.push(`return notif ${loan.id}: ${notifErr.message}`)
        continue
      }

      await supabase
        .from('loans')
        .update({ return_reminder_sent: true })
        .eq('id', loan.id)

      results.return++
    }
  }

  // ── 3. Merk forfalt (active lån der due_date < i dag) ────────────────────

  const { data: overdueLoans, error: overdueErr } = await supabase
    .from('loans')
    .update({ status: 'overdue' })
    .eq('status', 'active')
    .lt('due_date', todayStr)
    .select('id')

  if (overdueErr) {
    results.errors.push(`overdue update: ${overdueErr.message}`)
  } else {
    results.overdue = overdueLoans?.length ?? 0
  }

  console.log('[loan-reminders]', results)

  return NextResponse.json({
    ok: true,
    date: todayStr,
    ...results,
  })
}
