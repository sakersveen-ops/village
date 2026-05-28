// Path: src/app/api/og/[...slug]/route.tsx
// Handles:  /api/og/item/[id]
//           /api/og/profile/[userId]
//           /api/og/community/[id]
//
// Renders a 1200×630 OG image using @vercel/og (Edge runtime).
// Used by the three /p/* public preview pages as og:image.
// Falls back gracefully if DB record not found.

import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TERRA = '#2E6271'
const TERRA_DARK = '#1A2530'
const TERRA_MID = '#6B7A82'
const TERRA_GREEN = '#5E9A78'
const BG_GRAD_FROM = '#c8e5ec'
const BG_GRAD_TO = '#7fbdca'

// ─── Shared layout wrapper ─────────────────────────────────────────────────────
function OGWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: `linear-gradient(150deg, ${BG_GRAD_FROM} 0%, ${BG_GRAD_TO} 100%)`,
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {/* Village wordmark top-right */}
      <div style={{ position: 'absolute', top: 36, right: 48, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: TERRA, letterSpacing: '-0.03em' }}>
          Village
        </div>
        <div style={{ display: 'flex', fontSize: 13, color: TERRA_MID, fontWeight: 500 }}>
          nabodeling
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(252,254,255,0.88)',
      border: '1px solid rgba(46,98,113,0.18)',
      borderRadius: 28,
      padding: '36px 40px',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Avatar circle ─────────────────────────────────────────────────────────────
function AvatarCircle({ name, email, avatarUrl, size = 60 }: { name?: string; email?: string; avatarUrl?: string; size?: number }) {
  const text = (name || email || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const hue = (name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarUrl ? 'transparent' : `hsl(${hue},24%,82%)`,
      color: `hsl(${hue},28%,30%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700,
      border: '3px solid rgba(255,255,255,0.85)',
      overflow: 'hidden',
    }}>
      {avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatarUrl} width={size} height={size} style={{ objectFit: 'cover' }} alt="" />
        : text
      }
    </div>
  )
}

// ─── ITEM OG ──────────────────────────────────────────────────────────────────
async function renderItem(id: string) {
  const { data: item } = await supabaseAdmin
    .from('items')
    .select('id, name, description, image_url, category, available, price, location, profiles(name, email, avatar_url, city)')
    .eq('id', id)
    .single()

  if (!item) return null

  const owner = item.profiles as any
  const ownerName = owner?.name || owner?.email?.split('@')[0] || 'Eier'

  return (
    <OGWrapper>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 60px', gap: 48 }}>
        {/* Left: image */}
        <div style={{
          width: 340, height: 340, borderRadius: 24, flexShrink: 0, overflow: 'hidden',
          background: 'linear-gradient(140deg, #9fcfd9 0%, #6db5c3 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(46,98,113,0.18)',
        }}>
          {item.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={item.image_url} width={340} height={340} style={{ objectFit: 'cover' }} alt="" />
            : <span style={{ fontSize: 100 }}>📦</span>
          }
        </div>

        {/* Right: card */}
        <Card style={{ flex: 1, gap: 16 }}>
          {/* Status pill */}
          <div style={{
            display: 'flex', alignSelf: 'flex-start',
            background: item.available ? 'rgba(94,154,120,0.15)' : 'rgba(185,28,28,0.10)',
            color: item.available ? TERRA_GREEN : '#B91C1C',
            fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 20,
          }}>
            {item.available ? '● Tilgjengelig' : '● Opptatt nå'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: TERRA_DARK, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              {item.name}
            </div>
            {item.description && (
              <div style={{ display: 'flex', fontSize: 16, color: TERRA_MID, lineHeight: 1.5, overflow: 'hidden' }}>
                {item.description.slice(0, 100)}{item.description.length > 100 ? '…' : ''}
              </div>
            )}
          </div>

          {/* Owner row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <AvatarCircle name={owner?.name} email={owner?.email} avatarUrl={owner?.avatar_url} size={42} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: TERRA_DARK }}>{ownerName}</span>
              {owner?.city && <span style={{ fontSize: 13, color: TERRA_MID }}>📍 {owner.city}</span>}
            </div>
          </div>

          {/* CTA hint */}
          <div style={{ display: 'flex', marginTop: 'auto', background: TERRA, color: '#fff', borderRadius: 14, padding: '12px 20px', fontSize: 15, fontWeight: 700, alignSelf: 'stretch', justifyContent: 'center' }}>
            Lån på Village
          </div>
        </Card>
      </div>
    </OGWrapper>
  )
}

// ─── PROFILE OG ───────────────────────────────────────────────────────────────
async function renderProfile(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, avatar_url, city, bio')
    .eq('id', userId)
    .single()

  if (!profile) return null

  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, image_url, category')
    .eq('owner_id', userId)
    .eq('available', true)
    .limit(6)

  const { count: friendCount } = await supabaseAdmin
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('user_a', userId)

  // Get loan counts for sorting
  const itemIds = (items || []).map((i: any) => i.id)
  let loanCounts: Record<string, number> = {}
  if (itemIds.length > 0) {
    const { data: loans } = await supabaseAdmin
      .from('loans').select('item_id').in('item_id', itemIds).in('status', ['returned', 'active', 'confirmed'])
    ;(loans || []).forEach((l: any) => { loanCounts[l.item_id] = (loanCounts[l.item_id] || 0) + 1 })
  }
  const sortedItems = [...(items || [])].sort((a: any, b: any) => (loanCounts[b.id] || 0) - (loanCounts[a.id] || 0)).slice(0, 3)

  const name = profile.name || profile.email?.split('@')[0] || 'Bruker'
  const CATEGORY_EMOJI: Record<string, string> = { 'baby-og-barn': '🍼', 'klar-og-mote': '👗', 'boker': '📚', 'annet': '📦' }
  const totalLoans = Object.values(loanCounts).reduce((a, b) => a + b, 0)

  return (
    <OGWrapper>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
        <Card style={{ width: '100%', alignItems: 'center', gap: 20 }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <AvatarCircle name={profile.name} email={profile.email} avatarUrl={profile.avatar_url} size={80} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: TERRA_DARK, letterSpacing: '-0.03em' }}>{name}</span>
              {profile.city && <span style={{ fontSize: 16, color: TERRA_MID }}>📍 {profile.city}</span>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 0, background: 'rgba(46,98,113,0.07)', borderRadius: 18, overflow: 'hidden', width: '100%' }}>
            {[
              { num: items?.length || 0, label: 'gjenstander' },
              { num: totalLoans, label: 'lån totalt' },
              { num: friendCount || 0, label: 'venner' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', borderRight: i < 2 ? '1px solid rgba(46,98,113,0.12)' : 'none' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: TERRA_DARK, letterSpacing: '-0.02em' }}>{s.num}</span>
                <span style={{ fontSize: 12, color: TERRA_MID, marginTop: 2 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Item previews */}
          {sortedItems.length > 0 && (
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              {sortedItems.map((item: any) => (
                <div key={item.id} style={{ flex: 1, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(46,98,113,0.14)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 90, background: 'linear-gradient(135deg, #b8dce4, #8ec5d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                    {item.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.image_url} width={200} height={90} style={{ objectFit: 'cover', width: '100%', height: '100%' }} alt="" />
                      : CATEGORY_EMOJI[item.category] || '📦'
                    }
                  </div>
                  <div style={{ display: 'flex', padding: '6px 8px', background: 'rgba(252,254,255,0.8)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TERRA_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </OGWrapper>
  )
}

// ─── COMMUNITY OG ─────────────────────────────────────────────────────────────
async function renderCommunity(id: string) {
  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('id, name, description, avatar_emoji, avatar_url, is_public')
    .eq('id', id)
    .single()

  if (!community) return null

  const { data: membersRaw } = await supabaseAdmin
    .from('community_members')
    .select('user_id, profiles(name, email, avatar_url)')
    .eq('community_id', id)
    .eq('status', 'active')
    .limit(5)

  const members = (membersRaw || []).map((m: any) => m.profiles).filter(Boolean)

  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, image_url, category, owner_id')
    .eq('community_id', id)
    .eq('available', true)
    .limit(10)

  const itemIds = (items || []).map((i: any) => i.id)
  let loanCounts: Record<string, number> = {}
  if (itemIds.length > 0) {
    const { data: loans } = await supabaseAdmin
      .from('loans').select('item_id').in('item_id', itemIds).in('status', ['returned', 'active', 'confirmed'])
    ;(loans || []).forEach((l: any) => { loanCounts[l.item_id] = (loanCounts[l.item_id] || 0) + 1 })
  }
  const topItems = [...(items || [])].sort((a: any, b: any) => (loanCounts[b.id] || 0) - (loanCounts[a.id] || 0)).slice(0, 4)
  const CATEGORY_EMOJI: Record<string, string> = { 'baby-og-barn': '🍼', 'klar-og-mote': '👗', 'boker': '📚', 'annet': '📦' }

  const { count: totalMembers } = await supabaseAdmin
    .from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', id).eq('status', 'active')

  return (
    <OGWrapper>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 60px', gap: 48 }}>
        {/* Left */}
        <Card style={{ width: 380, flexShrink: 0, gap: 18 }}>
          {/* Community identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 66, height: 66, borderRadius: 20, background: 'rgba(46,98,113,0.10)', border: '1px solid rgba(46,98,113,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, flexShrink: 0 }}>
              {community.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={community.avatar_url} width={66} height={66} style={{ objectFit: 'cover', borderRadius: 20 }} alt="" />
                : (community.avatar_emoji || '🏘️')
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: TERRA_DARK, letterSpacing: '-0.025em', lineHeight: 1.2 }}>{community.name}</span>
              <span style={{ fontSize: 13, color: community.is_public ? TERRA_GREEN : TERRA_MID, fontWeight: 500 }}>
                {community.is_public ? '● Åpen krets' : '● Lukket krets'} · {totalMembers || 0} medlemmer
              </span>
            </div>
          </div>

          {community.description && (
            <span style={{ display: 'flex', fontSize: 15, color: TERRA_MID, lineHeight: 1.5 }}>
              {community.description.slice(0, 120)}{community.description.length > 120 ? '…' : ''}
            </span>
          )}

          {/* Member stack */}
          {members.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex' }}>
                {members.slice(0, 4).map((m: any, i: number) => {
                  const hue = (m.name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
                  const ini = (m.name || m.email || '?').split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')
                  return (
                    <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid white', marginLeft: i === 0 ? 0 : -10, background: m.avatar_url ? 'transparent' : `hsl(${hue},24%,82%)`, color: `hsl(${hue},28%,30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, overflow: 'hidden' }}>
                      {m.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.avatar_url} width={32} height={32} style={{ objectFit: 'cover' }} alt="" />
                        : ini
                      }
                    </div>
                  )
                })}
              </div>
              <span style={{ fontSize: 13, color: TERRA_DARK, fontWeight: 500, marginLeft: 4 }}>
                {members[0]?.name?.split(' ')[0]} og {(totalMembers || 1) - 1} andre
              </span>
            </div>
          )}

          <div style={{ display: 'flex', background: TERRA, color: '#fff', borderRadius: 14, padding: '12px 20px', fontSize: 15, fontWeight: 700, alignSelf: 'stretch', justifyContent: 'center', marginTop: 'auto' }}>
            {community.is_public ? 'Bli med' : 'Søk om å bli med'}
          </div>
        </Card>

        {/* Right: top items */}
        {topItems.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 13, color: TERRA_MID, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mest populært nå</span>
            {topItems.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(252,254,255,0.78)', borderRadius: 16, padding: '10px 14px', border: '1px solid rgba(46,98,113,0.12)' }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #b8dce4, #8ec5d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, overflow: 'hidden' }}>
                  {item.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.image_url} width={50} height={50} style={{ objectFit: 'cover' }} alt="" />
                    : CATEGORY_EMOJI[item.category] || '📦'
                  }
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: TERRA_DARK }}>{item.name}</span>
                {loanCounts[item.id] > 0 && (
                  <span style={{ fontSize: 12, color: TERRA_GREEN, fontWeight: 600, background: 'rgba(94,154,120,0.12)', padding: '3px 8px', borderRadius: 8 }}>
                    {loanCounts[item.id]}× lent
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </OGWrapper>
  )
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params; const [type, id] = slug   // ['item', id] | ['profile', id] | ['community', id]

  try {
    let element: React.ReactElement | null = null
    if (type === 'item')      element = await renderItem(id)
    if (type === 'profile')   element = await renderProfile(id)
    if (type === 'community') element = await renderCommunity(id)

    if (!element) {
      // Fallback: plain Village card
      element = (
        <OGWrapper>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: TERRA_DARK }}>Village</div>
          </div>
        </OGWrapper>
      )
    }

    return new ImageResponse(element, { width: 1200, height: 630 })
  } catch (err) {
    console.error('OG render error:', err)
    return new Response('OG image error', { status: 500 })
  }
}
