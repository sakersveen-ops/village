// Path: src/app/p/item/[id]/page.tsx
// Public preview – no auth required. Linked from share sheet.
// New users: see item + CTA to download/register
// Existing users: CTA deep-links to /items/[id] inside app
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ─── Server-side data fetch (RSC) ─────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await paramsPromise;
  const { data: item } = await supabaseAdmin
    .from('items')
    .select('name, description, image_url, profiles(name)')
    .eq('id', resolvedParams.id)
    .single()
  if (!item) return { title: 'Village' }
  const owner = (item.profiles as any)?.name || 'noen'
  return {
    metadataBase: new URL('https://www.villageapp.no'),
    title: `${item.name} — lån av ${owner} på Village`,
    description: item.description || `${owner} deler ${item.name} på Village, appen for nabodeling.`,
    openGraph: {
      title: `${item.name} — lån av ${owner}`,
      description: item.description || `Lån ${item.name} av ${owner} på Village.`,
      images: [`/api/og/item/${resolvedParams.id}`],
    },
    twitter: { card: 'summary_large_image' },
  }
}

function initials(name?: string, email?: string) {
  const src = name || email || ''
  return src.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

const CATEGORY_LABELS: Record<string, string> = {
  'baby-og-barn': 'Baby & barn',
  'klar-og-mote': 'Antrekk',
  'boker': 'Bøker',
  'annet': 'Annet',
}

// SMS fallback text – used in share sheet
export function buildSmsText(item: any, ownerName: string) {
  const available = item.available ? 'Tilgjengelig nå' : 'Opptatt akkurat nå'
  return `${ownerName} deler ${item.name} på Village (${available}). Se her: https://villageapp.no/p/item/${item.id}`
}

export default async function PublicItemPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await paramsPromise
  const { data: item } = await supabaseAdmin
    .from('items')
    .select(`
      id, name, description, image_url, category, available, price,
      location, color, size, age_group,
      profiles(id, name, email, avatar_url, city)
    `)
    .eq('id', resolvedParams.id)
    .single()

  if (!item) notFound()

  const owner = item.profiles as any
  const ownerName = owner?.name || owner?.email?.split('@')[0] || 'Eier'
  const ownerInitials = initials(owner?.name, owner?.email)
  const hue = (owner?.name || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category
  const appDeepLink = `https://villageapp.no/items/${item.id}`

  // Build a short SMS/plain-text fallback line for WhatsApp/iMessage previews
  // (used server-side in og:description)
  const shareText = `${ownerName} deler ${item.name} på Village${item.available ? ' — tilgjengelig nå' : ''}.`

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #d6edf2 0%, #b8dce4 55%, #8ec5d0 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px' }}>

      {/* ── Top bar ── */}
      <header style={{ width: '100%', maxWidth: 480, padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.03em' }}>Village</span>
        <span style={{ fontSize: 12, color: '#4a6b77', fontWeight: 500 }}>Nabolags&shy;deling</span>
      </header>

      {/* ── Item card ── */}
      <main style={{ width: '100%', maxWidth: 480, padding: '16px 16px 0' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(46,98,113,0.16)', boxShadow: '0 4px 24px rgba(26,37,48,0.10)' }}>

          {/* Image area */}
          <div style={{ height: 280, background: 'linear-gradient(140deg, #9fcfd9 0%, #6db5c3 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {item.image_url
              ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 80 }}>📦</span>
            }
            {/* Status pill */}
            <div style={{
              position: 'absolute', top: 14, left: 14,
              background: item.available ? 'rgba(94,154,120,0.92)' : 'rgba(185,28,28,0.82)',
              color: '#fff', fontSize: 12, fontWeight: 600,
              padding: '5px 12px', borderRadius: 20,
            }}>
              {item.available ? '● Tilgjengelig' : '● Opptatt nå'}
            </div>
          </div>

          {/* Body */}
          <div style={{ background: 'rgba(252,254,255,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(46,98,113,0.14)', padding: '18px 20px 20px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: '#1A2530', letterSpacing: '-0.03em', margin: '0 0 6px' }}>
              {item.name}
            </h1>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#6B7A82', background: 'rgba(46,98,113,0.07)', padding: '3px 8px', borderRadius: 10 }}>{categoryLabel}</span>
              {item.location && <span style={{ fontSize: 12, color: '#6B7A82', background: 'rgba(46,98,113,0.07)', padding: '3px 8px', borderRadius: 10 }}>📍 {item.location}</span>}
              {item.size && <span style={{ fontSize: 12, color: '#6B7A82', background: 'rgba(46,98,113,0.07)', padding: '3px 8px', borderRadius: 10 }}>{item.size}</span>}
              {item.price ? <span style={{ fontSize: 12, color: '#6B7A82', background: 'rgba(46,98,113,0.07)', padding: '3px 8px', borderRadius: 10 }}>{item.price} kr/dag</span> : <span style={{ fontSize: 12, color: 'rgba(94,154,120,0.9)', background: 'rgba(94,154,120,0.1)', padding: '3px 8px', borderRadius: 10 }}>Gratis</span>}
            </div>

            {item.description && (
              <p style={{ fontSize: 14, color: '#4a6472', lineHeight: 1.55, margin: '0 0 16px' }}>
                {item.description}
              </p>
            )}

            {/* Owner row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(46,98,113,0.06)', borderRadius: 14, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(46,98,113,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: owner?.avatar_url ? undefined : `hsl(${hue},24%,82%)`, color: `hsl(${hue},28%,30%)`, fontSize: 14, fontWeight: 700 }}>
                {owner?.avatar_url
                  ? <img src={owner.avatar_url} alt={ownerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : ownerInitials
                }
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A2530' }}>{ownerName}</p>
                {owner?.city && <p style={{ margin: 0, fontSize: 12, color: '#6B7A82' }}>📍 {owner.city}</p>}
              </div>
            </div>

            {/* CTA */}
            <a href={appDeepLink} style={{ display: 'block', background: '#2E6271', color: '#fff', borderRadius: 16, padding: '14px 0', textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', textDecoration: 'none' }}>
              {item.available ? 'Lån denne på Village' : 'Se på Village'}
            </a>
          </div>
        </div>

        {/* ── New user nudge ── */}
        <div style={{ marginTop: 16, background: 'rgba(252,254,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 18, border: '1px solid rgba(46,98,113,0.14)', padding: '16px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1A2530' }}>Ny på Village?</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7A82', lineHeight: 1.5 }}>
            Village er appen for deling mellom naboer og venner. Del det du har, lån det du trenger.
          </p>
          <a href="https://villageapp.no/register" style={{ display: 'block', background: 'rgba(46,98,113,0.10)', color: '#2E6271', borderRadius: 12, padding: '11px 0', textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1.5px solid rgba(46,98,113,0.22)' }}>
            Opprett konto gratis →
          </a>
        </div>
      </main>
    </div>
  )
}
