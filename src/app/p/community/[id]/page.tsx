// Path: src/app/p/community/[id]/page.tsx
// Public community preview – no auth required.
// Shows: name, emoji/image, member count + avatars, items sorted by loan count
// CTA: "Bli med i kretsen" → deep-link into app

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('name, description, avatar_emoji')
    .eq('id', params.id)
    .single()
  if (!community) return { title: 'Village' }
  return {
    title: `${community.avatar_emoji || '🏘️'} ${community.name} — Village`,
    description: community.description || `Bli med i ${community.name} på Village — appen for nabodeling.`,
    openGraph: {
      title: `${community.name} på Village`,
      description: community.description || `Del og lån i ${community.name}.`,
      images: [`/api/og/community/${params.id}`],
    },
    twitter: { card: 'summary_large_image' },
  }
}

function initials(name?: string, email?: string) {
  const src = name || email || ''
  return src.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

const CATEGORY_EMOJI: Record<string, string> = {
  'baby-og-barn': '🍼', 'klar-og-mote': '👗', 'boker': '📚', 'annet': '📦',
}

export default async function PublicCommunityPage({ params }: { params: { id: string } }) {
  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('id, name, description, avatar_emoji, avatar_url, is_public, invite_code')
    .eq('id', params.id)
    .single()

  if (!community) notFound()

  // Members (active only, with avatar)
  const { data: membersRaw } = await supabaseAdmin
    .from('community_members')
    .select('user_id, profiles(name, email, avatar_url)')
    .eq('community_id', params.id)
    .eq('status', 'active')
    .limit(50)

  const members = (membersRaw || []).map((m: any) => m.profiles).filter(Boolean)

  // Items for this community, available only
  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, image_url, category, available, owner_id, profiles(name, avatar_url)')
    .eq('community_id', params.id)
    .eq('available', true)
    .limit(20)

  // Sort items by loan count
  const itemIds = (items || []).map((i: any) => i.id)
  let loanCounts: Record<string, number> = {}
  if (itemIds.length > 0) {
    const { data: loans } = await supabaseAdmin
      .from('loans')
      .select('item_id')
      .in('item_id', itemIds)
      .in('status', ['returned', 'active', 'confirmed'])
    ;(loans || []).forEach((l: any) => {
      loanCounts[l.item_id] = (loanCounts[l.item_id] || 0) + 1
    })
  }

  const sortedItems = [...(items || [])].sort((a: any, b: any) => (loanCounts[b.id] || 0) - (loanCounts[a.id] || 0))

  const appDeepLink = `https://village-jade.vercel.app/community/${params.id}`
  const registerDeepLink = `https://village-jade.vercel.app/register?redirect=/community/${params.id}`

  // Show up to 5 member avatars
  const previewMembers = members.slice(0, 5)
  const extraMembers = Math.max(0, members.length - 5)

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(150deg, #b9dfe8 0%, #8ec5d2 55%, #6aafbf 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px' }}>

      {/* ── Top bar ── */}
      <header style={{ width: '100%', maxWidth: 480, padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.03em' }}>Village</span>
        <span style={{ fontSize: 12, color: '#4a6b77', fontWeight: 500 }}>Nabolags&shy;deling</span>
      </header>

      <main style={{ width: '100%', maxWidth: 480, padding: '16px 16px 0' }}>

        {/* ── Community hero ── */}
        <div style={{ background: 'rgba(252,254,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 24, border: '1px solid rgba(46,98,113,0.16)', boxShadow: '0 4px 24px rgba(26,37,48,0.10)', padding: '24px 20px 20px', marginBottom: 12 }}>

          {/* Emoji / image + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, flexShrink: 0, overflow: 'hidden', background: 'rgba(46,98,113,0.08)', border: '1px solid rgba(46,98,113,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
              {community.avatar_url
                ? <img src={community.avatar_url} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (community.avatar_emoji || '🏘️')
              }
            </div>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.025em', margin: '0 0 4px' }}>{community.name}</h1>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6B7A82' }}>{members.length} medlemmer</span>
                <span style={{ fontSize: 12, color: 'rgba(46,98,113,0.3)' }}>·</span>
                <span style={{ fontSize: 12, color: community.is_public ? '#5E9A78' : '#6B7A82', fontWeight: 500 }}>{community.is_public ? '● Åpen krets' : '● Lukket krets'}</span>
              </div>
            </div>
          </div>

          {community.description && (
            <p style={{ fontSize: 14, color: '#4a6472', lineHeight: 1.55, margin: '0 0 16px' }}>{community.description}</p>
          )}

          {/* Member avatar stack */}
          {previewMembers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18 }}>
              <div style={{ display: 'flex' }}>
                {previewMembers.map((m: any, i: number) => {
                  const ini = initials(m.name, m.email)
                  const hue = (m.name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
                  return (
                    <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.9)', marginLeft: i === 0 ? 0 : -8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.avatar_url ? undefined : `hsl(${hue},24%,82%)`, color: `hsl(${hue},28%,30%)`, fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: previewMembers.length - i }}>
                      {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
                    </div>
                  )
                })}
              </div>
              <span style={{ fontSize: 13, color: '#1A2530', fontWeight: 500, marginLeft: 6 }}>
                {previewMembers[0]?.name?.split(' ')[0]}{previewMembers.length > 1 && ` og ${previewMembers.length - 1} andre`}{extraMembers > 0 && ` + ${extraMembers} til`}
              </span>
            </div>
          )}

          {/* CTA */}
          <a href={appDeepLink} style={{ display: 'block', background: '#2E6271', color: '#fff', borderRadius: 16, padding: '14px 0', textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            {community.is_public ? 'Bli med i kretsen' : 'Søk om å bli med'}
          </a>
        </div>

        {/* ── Items grid sorted by loan count ── */}
        {sortedItems.length > 0 && (
          <div style={{ background: 'rgba(252,254,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(46,98,113,0.14)', padding: '16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.02em', margin: 0 }}>Tilgjengelig nå</h2>
              <span style={{ fontSize: 11, color: '#6B7A82', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mest populære først</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedItems.slice(0, 6).map((item: any, i: number) => {
                const ownerProfile = item.profiles as any
                const ownerName = ownerProfile?.name || 'Ukjent'
                const ownerIni = initials(ownerProfile?.name, ownerProfile?.email)
                const hue = (ownerProfile?.name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
                const loans = loanCounts[item.id] || 0
                return (
                  <a key={item.id} href={`https://village-jade.vercel.app/p/item/${item.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(252,254,255,0.6)', borderRadius: 14, border: '1px solid rgba(46,98,113,0.10)', textDecoration: 'none' }}>
                    {/* Item image or emoji */}
                    <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #b8dce4 0%, #8ec5d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span>{CATEGORY_EMOJI[item.category] || '📦'}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#1A2530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                      {/* Owner avatar + name inline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ownerProfile?.avatar_url ? undefined : `hsl(${hue},24%,82%)`, color: `hsl(${hue},28%,30%)`, fontSize: 8, fontWeight: 700 }}>
                          {ownerProfile?.avatar_url ? <img src={ownerProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ownerIni}
                        </div>
                        <span style={{ fontSize: 12, color: '#6B7A82' }}>{ownerName}</span>
                      </div>
                    </div>
                    {/* Loan count badge */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {loans > 0
                        ? <span style={{ fontSize: 11, color: '#5E9A78', fontWeight: 600, background: 'rgba(94,154,120,0.12)', padding: '3px 7px', borderRadius: 8 }}>{loans}× lent</span>
                        : <span style={{ fontSize: 11, color: '#6B7A82', background: 'rgba(46,98,113,0.07)', padding: '3px 7px', borderRadius: 8 }}>Ny</span>
                      }
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* ── New user nudge ── */}
        <div style={{ background: 'rgba(252,254,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 18, border: '1px solid rgba(46,98,113,0.14)', padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1A2530' }}>Ny på Village?</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7A82', lineHeight: 1.5 }}>
            Registrer deg gratis og bli med i {community.name} direkte.
          </p>
          <a href={registerDeepLink} style={{ display: 'block', background: 'rgba(46,98,113,0.10)', color: '#2E6271', borderRadius: 12, padding: '11px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1.5px solid rgba(46,98,113,0.22)' }}>
            Opprett konto og bli med →
          </a>
        </div>

      </main>
    </div>
  )
}
