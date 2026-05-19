// .github/scripts/daily-digest.mjs
// Kjøres av GitHub Actions kl 07:00 hver morgen.
// Henter statistikk fra Supabase og sender e-post via Resend.
//
// Secrets som må settes i GitHub repo → Settings → Secrets:
//   SUPABASE_URL              — f.eks. https://xyzxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — service_role nøkkel (ikke anon!) fra Supabase dashboard
//   RESEND_API_KEY            — fra resend.com (gratis plan holder)
//   REPORT_EMAIL_TO           — din e-post (kan være kommaseparert liste)
//   REPORT_EMAIL_FROM         — f.eks. rapport@village.no (må være verifisert domene i Resend)

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service_role omgår RLS
)

const resend = new Resend(process.env.RESEND_API_KEY)

// -------------------------------------------------------------------
// Hjelpefunksjoner
// -------------------------------------------------------------------

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

async function count(table, filter = {}) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filter)) {
    query = query.eq(col, val)
  }
  const { count: n, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return n ?? 0
}

async function countSince(table, since, extra = {}) {
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)
  for (const [col, val] of Object.entries(extra)) {
    query = query.eq(col, val)
  }
  const { count: n, error } = await query
  if (error) throw new Error(`${table} since: ${error.message}`)
  return n ?? 0
}

// -------------------------------------------------------------------
// Hent all statistikk
// -------------------------------------------------------------------

async function fetchStats() {
  const since24h = yesterday()

  const [
    // Totaltall
    totalUsers,
    totalItems,
    totalLoans,
    totalActiveLoans,
    totalReturnedLoans,
    totalCommunities,
    totalFriendships,

    // Siste 24 timer
    newUsers24h,
    newItems24h,
    newLoans24h,
    newMessages24h,
    newNotifications24h,
    newFriendRequests24h,
    newConnectionRequests24h,
  ] = await Promise.all([
    count('profiles'),
    count('items'),
    count('loans'),
    count('loans', { status: 'active' }),
    count('loans', { status: 'returned' }),
    count('communities'),
    // friendships lagres begge veier — del på 2
    supabase.from('friendships').select('*', { count: 'exact', head: true }).then(r => Math.floor((r.count ?? 0) / 2)),

    countSince('profiles', since24h),
    countSince('items', since24h),
    countSince('loans', since24h),
    countSince('loan_messages', since24h),
    countSince('notifications', since24h),
    countSince('friend_requests', since24h),
    countSince('profile_connections', since24h),
  ])

  // Lån per status siste 24t
  const loanStatusCounts = await Promise.all(
    ['pending', 'active', 'returned', 'declined', 'change_proposed'].map(async status => {
      const n = await countSince('loans', since24h, { status })
      return { status, n }
    })
  )

  // Analytics events siste 24t (topp 5 events)
  const { data: topEvents } = await supabase
    .from('analytics_events')
    .select('event')
    .gte('created_at', since24h)

  const eventCounts = {}
  for (const row of topEvents ?? []) {
    eventCounts[row.event] = (eventCounts[row.event] ?? 0) + 1
  }
  const topEventsSorted = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return {
    totalUsers, totalItems, totalLoans,
    totalActiveLoans, totalReturnedLoans,
    totalCommunities, totalFriendships,
    newUsers24h, newItems24h, newLoans24h,
    newMessages24h, newNotifications24h,
    newFriendRequests24h, newConnectionRequests24h,
    loanStatusCounts,
    topEventsSorted,
  }
}

// -------------------------------------------------------------------
// Bygg HTML-e-post
// -------------------------------------------------------------------

function buildEmailHtml(stats, reportDate) {
  const {
    totalUsers, totalItems, totalLoans,
    totalActiveLoans, totalReturnedLoans,
    totalCommunities, totalFriendships,
    newUsers24h, newItems24h, newLoans24h,
    newMessages24h, newFriendRequests24h, newConnectionRequests24h,
    loanStatusCounts, topEventsSorted,
  } = stats

  const loanStatusRows = loanStatusCounts
    .filter(r => r.n > 0)
    .map(r => `<tr><td style="padding:4px 12px 4px 0;color:#9C7B65;">${r.status}</td><td style="padding:4px 0;font-weight:600;">${r.n}</td></tr>`)
    .join('')

  const topEventsRows = topEventsSorted.length > 0
    ? topEventsSorted.map(([e, n]) => `<tr><td style="padding:4px 12px 4px 0;color:#9C7B65;font-family:monospace;font-size:13px;">${e}</td><td style="padding:4px 0;font-weight:600;">${n}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#9C7B65;">Ingen events i går</td></tr>'

  return `
<!DOCTYPE html>
<html lang="nb">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FDF6EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2C1A0E;">

<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(44,26,14,0.08);">

  <!-- Header -->
  <div style="background:#C4673A;padding:28px 32px;">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px;">🏘️ Village</div>
    <div style="color:rgba(255,255,255,0.85);margin-top:4px;font-size:15px;">Morgenrapport – ${reportDate}</div>
  </div>

  <!-- Siste 24 timer -->
  <div style="padding:28px 32px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9C7B65;text-transform:uppercase;margin-bottom:16px;">Siste 24 timer</div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      ${metricCard('👤', 'Nye brukere', newUsers24h)}
      ${metricCard('📦', 'Nye gjenstander', newItems24h)}
      ${metricCard('🤝', 'Nye lån', newLoans24h)}
      ${metricCard('💬', 'Meldinger', newMessages24h)}
      ${metricCard('👥', 'Venneforespørsler', newFriendRequests24h)}
      ${metricCard('🔗', 'Tilkoblinger', newConnectionRequests24h)}
    </div>
  </div>

  <!-- Lån per status -->
  ${loanStatusRows ? `
  <div style="padding:24px 32px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9C7B65;text-transform:uppercase;margin-bottom:12px;">Lån opprettet i går – per status</div>
    <table style="border-collapse:collapse;">
      ${loanStatusRows}
    </table>
  </div>` : ''}

  <!-- Divider -->
  <div style="margin:28px 32px 0;border-top:1px solid #F0E8DF;"></div>

  <!-- Totaltall -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9C7B65;text-transform:uppercase;margin-bottom:16px;">Totalt i databasen</div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      ${metricCard('👥', 'Brukere totalt', totalUsers, '#F7F0EA')}
      ${metricCard('📦', 'Gjenstander totalt', totalItems, '#F7F0EA')}
      ${metricCard('🤝', 'Lån totalt', totalLoans, '#F7F0EA')}
      ${metricCard('✅', 'Aktive lån nå', totalActiveLoans, '#F7F0EA')}
      ${metricCard('↩️', 'Returnerte lån', totalReturnedLoans, '#F7F0EA')}
      ${metricCard('👫', 'Vennskap', totalFriendships, '#F7F0EA')}
      ${metricCard('🏘️', 'Communities', totalCommunities, '#F7F0EA')}
    </div>
  </div>

  <!-- Analytics events -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9C7B65;text-transform:uppercase;margin-bottom:12px;">Topp analytics-events i går</div>
    <table style="border-collapse:collapse;">
      ${topEventsRows}
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:28px 32px;margin-top:28px;border-top:1px solid #F0E8DF;">
    <div style="font-size:12px;color:#9C7B65;">
      Generert automatisk av GitHub Actions · ${new Date().toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}
    </div>
  </div>

</div>
</body>
</html>`
}

function metricCard(emoji, label, value, bg = '#FEF9F5') {
  return `
    <div style="background:${bg};border-radius:10px;padding:14px 16px;">
      <div style="font-size:20px;margin-bottom:6px;">${emoji}</div>
      <div style="font-size:22px;font-weight:700;color:#2C1A0E;line-height:1;">${value}</div>
      <div style="font-size:12px;color:#9C7B65;margin-top:4px;">${label}</div>
    </div>`
}

function buildEmailText(stats, reportDate) {
  const s = stats
  return `Village – Morgenrapport ${reportDate}

SISTE 24 TIMER
──────────────
Nye brukere:       ${s.newUsers24h}
Nye gjenstander:   ${s.newItems24h}
Nye lån:           ${s.newLoans24h}
Meldinger:         ${s.newMessages24h}
Venneforespørsler: ${s.newFriendRequests24h}
Tilkoblinger:      ${s.newConnectionRequests24h}

TOTALT I DATABASEN
──────────────────
Brukere:           ${s.totalUsers}
Gjenstander:       ${s.totalItems}
Lån totalt:        ${s.totalLoans}
  – aktive nå:     ${s.totalActiveLoans}
  – returnerte:    ${s.totalReturnedLoans}
Vennskap:          ${s.totalFriendships}
Communities:       ${s.totalCommunities}

TOPP EVENTS I GÅR
─────────────────
${s.topEventsSorted.length > 0
  ? s.topEventsSorted.map(([e, n]) => `${e}: ${n}`).join('\n')
  : 'Ingen events'}
`
}

// -------------------------------------------------------------------
// Hovedlogikk
// -------------------------------------------------------------------

async function main() {
  console.log('📊 Henter Village-statistikk...')

  const stats = await fetchStats()
  const reportDate = formatDate(new Date().toISOString())

  console.log('Stats hentet:', JSON.stringify(stats, null, 2))

  const to = process.env.REPORT_EMAIL_TO?.split(',').map(s => s.trim()) ?? []
  const from = process.env.REPORT_EMAIL_FROM ?? 'Village <rapport@village.no>'

  if (to.length === 0) {
    console.warn('⚠️  Ingen mottaker satt (REPORT_EMAIL_TO). Printer rapport til console.')
    console.log(buildEmailText(stats, reportDate))
    return
  }

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `🏘️ Village – ${reportDate}`,
    html: buildEmailHtml(stats, reportDate),
    text: buildEmailText(stats, reportDate),
  })

  if (error) {
    console.error('❌ Klarte ikke sende e-post:', error)
    process.exit(1)
  }

  console.log(`✅ Rapport sendt til ${to.join(', ')} (id: ${data?.id})`)
}

main().catch(err => {
  console.error('❌ Feil:', err)
  process.exit(1)
})
