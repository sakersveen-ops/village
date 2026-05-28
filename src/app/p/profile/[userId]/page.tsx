// Path: src/app/p/profile/[userId]/page.tsx
// Public profile preview – no auth required.
// Shows: avatar, name, city, friend count, top items (by loan count desc)
// CTA: "Bli venner på Village" → deep-link to /profile/[userId] inside app

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ userId: string }> }) {
  const resolvedParams = await paramsPromise;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, email, city, avatar_url')
    .eq('id', resolvedParams.userId)
    .single()
  if (!profile) return { title: 'Village' }
  const name = profile.name || profile.email?.split('@')[0] || 'Bruker'
  return {
    metadataBase: new URL('https://village-jade.vercel.app'),
    title: `${name} deler på Village`,
    description: `Se hva ${name} deler på Village — appen for nabodeling.`,
    openGraph: {
      title: `${name} deler på Village`,
      description: `Se hva ${name} deler i nabolaget ditt.`,
      images: [`/api/og/profile/${resolvedParams.userId}`],
    },
    twitter: { card: 'summary_large_image' },
  }
}

function initials(name?: string, email?: string) {
  const src = name || email || ''
  return src.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

export default async function PublicProfilePage({ params: paramsPromise }: { params: Promise<{ userId: string }> }) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, avatar_url, city, bio')
    .eq('id', resolvedParams.userId)
    .single()

  if (!profile) notFound()

  // Items sorted by loan count (most lent first)
  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, image_url, category, available')
    .eq('owner_id', resolvedParams.userId)
    .eq('available', true)
    .limit(12)

  // Loan counts per item to sort by popularity
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

  // Friend count
  const { count: friendCount } = await supabaseAdmin
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('user_a', resolvedParams.userId)

  const name = profile.name || profile.email?.split('@')[0] || 'Bruker'
  const ownerInitials = initials(profile.name, profile.email)
  const hue = (profile.name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
  const appDeepLink = `https://village-jade.vercel.app/profile/${resolvedParams.userId}`

  const CATEGORY_EMOJI: Record<string, string> = {
    'baby-og-barn': '🍼', 'klar-og-mote': '👗', 'boker': '📚', 'annet': '📦'
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #c8e5ec 0%, #a8d4dd 55%, #7fbdca 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px' }}>

      {/* ── Top bar ── */}
      <header style={{ width: '100%', maxWidth: 480, padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.03em' }}>Village</span>
        <span style={{ fontSize: 12, color: '#4a6b77', fontWeight: 500 }}>Nabolags&shy;deling</span>
      </header>

      <main style={{ width: '100%', maxWidth: 480, padding: '16px 16px 0' }}>

        {/* ── Profile hero card ── */}
        <div style={{ background: 'rgba(252,254,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 24, border: '1px solid rgba(46,98,113,0.16)', boxShadow: '0 4px 24px rgba(26,37,48,0.10)', padding: '24px 20px 20px', marginBottom: 12 }}>

          {/* Avatar + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '3px solid rgba(46,98,113,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: profile.avatar_url ? undefined : `hsl(${hue},24%,82%)`, color: `hsl(${hue},28%,30%)`, fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : ownerInitials
              }
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.03em', margin: '0 0 4px', textAlign: 'center' }}>{name}</h1>
            {profile.city && <p style={{ margin: 0, fontSize: 13, color: '#6B7A82' }}>📍 {profile.city}</p>}
            {profile.bio && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4a6472', textAlign: 'center', lineHeight: 1.5, maxWidth: 300 }}>{profile.bio}</p>}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', background: 'rgba(46,98,113,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRight: '1px solid rgba(46,98,113,0.10)' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.02em' }}>{sortedItems.length}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#6B7A82', marginTop: 1 }}>gjenstander</span>
            </div>
            <div style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRight: '1px solid rgba(46,98,113,0.10)' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.02em' }}>{Object.values(loanCounts).reduce((a, b) => a + b, 0)}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#6B7A82', marginTop: 1 }}>lån totalt</span>
            </div>
            <div style={{ flex: 1, padding: '10px 0', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.02em' }}>{friendCount || 0}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#6B7A82', marginTop: 1 }}>venner</span>
            </div>
          </div>

          {/* CTA */}
          <a href={appDeepLink} style={{ display: 'block', background: '#2E6271', color: '#fff', borderRadius: 16, padding: '14px 0', textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            Bli venner med {name.split(' ')[0]} →
          </a>
        </div>

        {/* ── Items grid ── */}
        {sortedItems.length > 0 && (
          <div style={{ background: 'rgba(252,254,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(46,98,113,0.14)', padding: '16px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.02em', margin: 0 }}>Deler nå</h2>
              <span style={{ fontSize: 11, color: '#6B7A82', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mest utlånt først</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {sortedItems.slice(0, 9).map((item: any) => (
                <a key={item.id} href={`https://village-jade.vercel.app/p/item/${item.id}`}
                  style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(46,98,113,0.12)', textDecoration: 'none', background: 'rgba(252,254,255,0.6)', display: 'block' }}>
                  <div style={{ height: 80, background: 'linear-gradient(135deg, #b8dce4 0%, #8ec5d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, position: 'relative' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span>{CATEGORY_EMOJI[item.category] || '📦'}</span>
                    }
                    {loanCounts[item.id] > 0 && (
                      <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(26,37,48,0.65)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 6 }}>
                        {loanCounts[item.id]}× lent
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#1A2530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── New user nudge ── */}
        <div style={{ background: 'rgba(252,254,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 18, border: '1px solid rgba(46,98,113,0.14)', padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1A2530' }}>Ny på Village?</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7A82', lineHeight: 1.5 }}>Del det du har, lån det du trenger — fra folk du kjenner og stoler på.</p>
          <a href="https://village-jade.vercel.app/register" style={{ display: 'block', background: 'rgba(46,98,113,0.10)', color: '#2E6271', borderRadius: 12, padding: '11px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1.5px solid rgba(46,98,113,0.22)' }}>
            Opprett konto gratis →
          </a>
        </div>

      </main>
    </div>
  )
}
