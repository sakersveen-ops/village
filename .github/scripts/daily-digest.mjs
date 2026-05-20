// .github/scripts/daily-digest.mjs
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
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

async function fetchStats() {
  const since24h = yesterday()

  const [
    totalUsers,
    totalItems,
    totalLoans,
    totalActiveLoans,
    totalReturnedLoans,
    totalCommunities,
    totalFriendships,
    newUsers24h,
    newItems24h,
    newLoans24h,
    newMessages24h,
    newNotifications24h,
    newFriendRequests24h,
    newConnectionRequests24h,
    newFeedback24h,
    newBetaFeedback24h,
    totalFeedback,
    totalBetaFeedback,
    recentFeedback,
    recentBetaFeedback,
  ] = await Promise.all([
    count('profiles'),
    count('items'),
    count('loans'),
    count('loans', { status: 'active' }),
    count('loans', { status: 'returned' }),
    count('communities'),
    supabase.from('friendships').select('*', { count: 'exact', head: true }).then(r => Math.floor((r.count ?? 0) / 2)),
    countSince('profiles', since24h),
    countSince('items', since24h),
    countSince('loans', since24h),
    countSince('loan_messages', since24h),
    countSince('notifications', since24h),
    countSince('friend_requests', since24h),
    countSince('profile_connections', since24h),
    countSince('feedback', since24h),
    countSince('beta_feedback', since24h),
    count('feedback'),
    count('beta_feedback'),
    supabase.from('feedback').select('type, message, page_title, created_at').order('created_at', { ascending: false }).limit(5).then(r => r.data ?? []),
    supabase.from('beta_feedback').select('type, message, page_title, created_at').order('created_at', { ascending: false }).limit(5).then(r => r.data ?? []),
  ])

  const loanStatusCounts = await Promise.all(
    ['pending', 'active', 'returned', 'declined', 'change_proposed'].map(async status => {
      const n = await countSince('loans', since24h, { status })
      return { status, n }
    })
  )

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
    newFeedback24h, newBetaFeedback24h,
    totalFeedback, totalBetaFeedback,
    recentFeedback, recentBetaFeedback,
    loanStatusCounts, topEventsSorted,
  }
}

function metricCard(emoji, label, value, bg = '#FEF9F5') {
  return `
    <div style="background:${bg};border-radius:10px;padding:14px 16px;">
      <div style="font-size:20px;margin-bottom:6px;">${emoji}</div>
      <div style="font-size:22px;font-weight:700;color:#2C1A0E;line-height:1;">${value}</div>
      <div style="font-size:12px;color:#9C7B65;margin-top:4px;">${label}</div>
    </div>`
}

function feedbackRows(items) {
  if (!items || items.length === 0) {
    return '<tr><td colspan="3" style="color:#9C7B65;padding:4px 0;">Ingen feedback</td></tr>'
  }
  return items.map(f => {
    const date = new Date(f.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
    const type = f.type ?? '–'
    const msg = (f.message ?? '').slice(0, 120) + (f.message?.length > 120 ? '…' : '')
    const page = f.page_title ? `<span style="color:#9C7B65;font-size:11px;"> · ${f.page_title}</span>` : ''
    return `<tr>
      <td style="padding:6px 10px 6px 0;font-size:12px;color:#9C7B65;white-space:nowrap;">${date}</td>
      <td style="padding:6px 10px 6px 0;font-size:12px;font-weight:600;white-space:nowrap;">${type}</td>
      <td style="padding:6px 0;font-size:13px;">${msg}${page}</td>
    </tr>`
  }).join('')
}

function buildEmailHtml(stats, reportDate) {
  const {
    totalUsers, totalItems, totalLoans,
    totalActiveLoans, totalReturnedLoans,
    totalCommunities, totalFriendships,
    newUsers24h, newItems24h, newLoans24h,
    newMessages24h, newFriendRequests24h, newConnectionRequests24h,
    newFeedback24h, newBetaFeedback24h,
    totalFeedback, totalBetaFeedback,
    recentFeedback, recentBetaFeedback,
    loanStatusCounts, topEventsSorted,
  } = stats

  const loanStatusRows = loanStatusCounts
    .filter(r => r.n > 0)
    .map(r => `<tr><td style="padding:4px 12px 4px 0;color:#9C7B65;">${r.status}</td><td style="padding:4px 0;font-weight:600;">${r.n}</td></tr>`)
    .join('')

  const topEventsRows = topEventsSorted.length > 0
    ? topEventsSorted.map(([e, n]) => `<tr><td style="padding:4px 12px 4px 0;color:#9C7B65;font-family:monospace;font-size:13px;">${e}</td><td style="padding:4px 0;font-weight:600;">${n}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#9C7B65;">Ingen events i går</td></tr>'

  const allRecentFeedback = [
    ...recentFeedback.map(f => ({ ...f, _source: 'feedback' })),
    ...recentBetaFeedback.map(f => ({ ...f, _source: 'beta' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)

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
      ${metricCard('📝', 'Ny feedback', newFeedback24h + newBetaFeedback24h)}
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
      ${metricCard('📝', 'Feedback totalt', totalFeedback + totalBetaFeedback, '#F7F0EA')}
    </div>
  </div>

  <!-- Feedback -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9C7B65;text-transform:uppercase;margin-bottom:12px;">Siste feedback (begge tabeller)</div>
    <table style="border-collapse:collapse;width:100%;">
      ${feedbackRows(allRecentFeedback)}
    </table>
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

function buildEmailText(stats, reportDate) {
  const s = stats
  const allFeedback = [...s.recentFeedback, ...s.recentBetaFeedback]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)

  const feedbackLines = allFeedback.length > 0
    ? allFeedback.map(f => {
        const date = new Date(f.created_at).toLocaleDateString('nb-NO')
        return `[${date}] (${f.type ?? '–'}) ${f.message ?? ''}`
      }).join('\n')
    : 'Ingen feedback'

  return `Village – Morgenrapport ${reportDate}

SISTE 24 TIMER
──────────────
Nye brukere:       ${s.newUsers24h}
Nye gjenstander:   ${s.newItems24h}
Nye lån:           ${s.newLoans24h}
Meldinger:         ${s.newMessages24h}
Venneforespørsler: ${s.newFriendRequests24h}
Tilkoblinger:      ${s.newConnectionRequests24h}
Ny feedback:       ${s.newFeedback24h + s.newBetaFeedback24h}

TOTALT I DATABASEN
──────────────────
Brukere:           ${s.totalUsers}
Gjenstander:       ${s.totalItems}
Lån totalt:        ${s.totalLoans}
  – aktive nå:     ${s.totalActiveLoans}
  – returnerte:    ${s.totalReturnedLoans}
Vennskap:          ${s.totalFriendships}
Communities:       ${s.totalCommunities}
Feedback totalt:   ${s.totalFeedback + s.totalBetaFeedback}

SISTE FEEDBACK
──────────────
${feedbackLines}

TOPP EVENTS I GÅR
─────────────────
${s.topEventsSorted.length > 0
  ? s.topEventsSorted.map(([e, n]) => `${e}: ${n}`).join('\n')
  : 'Ingen events'}
`
}

async function main() {
  console.log('📊 Henter Village-statistikk...')

  const stats = await fetchStats()
  const reportDate = formatDate(new Date().toISOString())

  console.log('Stats hentet:', JSON.stringify(stats, null, 2))

  const to = process.env.REPORT_EMAIL_TO?.split(',').map(s => s.trim()) ?? []
  const from = process.env.REPORT_EMAIL_FROM ?? 'Village <rapport@village.no>'

  if (to.length === 0) {
    console.warn('⚠️  Ingen mottaker satt. Printer til console.')
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
