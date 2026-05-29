// Path: src/app/popular/page.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const CATEGORY_LABELS: Record<string, string> = {
  'baby-og-barn': 'Baby & barn',
  'klar-og-mote': 'Antrekk',
  boker: 'Bøker',
  annet: 'Annet',
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'baby-og-barn': '👶',
  'klar-og-mote': '👗',
  boker: '📚',
  annet: '🔧',
}

const ALL_CATS = ['alle', 'baby-og-barn', 'klar-og-mote', 'boker', 'annet']

type PublicItem = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  category: string
  available: boolean
  location: string | null
  created_at: string
  profiles: { name: string | null; city: string | null } | null
}

// Emoji fallbacks per category when no image
function categoryEmoji(cat: string) {
  return CATEGORY_EMOJIS[cat] ?? '📦'
}

export default function PopularPage() {
  const [items, setItems] = useState<PublicItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('alle')
  const [stats, setStats] = useState({ itemCount: 0, cityCount: 0, loanCount: 0 })

  useEffect(() => {
    loadItems()
    loadStats()
  }, [])

  async function loadItems() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('items')
      .select('id, name, description, image_url, category, available, location, created_at, profiles(name, city)')
      .eq('available', true)
      .order('created_at', { ascending: false })
      .limit(60)
    setItems((data as PublicItem[]) ?? [])
    setLoading(false)
  }

  async function loadStats() {
    const supabase = createClient()
    const [{ count: itemCount }, { count: loanCount }] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('available', true),
      supabase.from('loans').select('*', { count: 'exact', head: true }).in('status', ['active', 'confirmed', 'returned']),
    ])
    // rough city count from profiles
    const { data: cities } = await supabase.from('profiles').select('city').not('city', 'is', null)
    const uniqueCities = new Set((cities ?? []).map((p: any) => p.city?.trim().toLowerCase()).filter(Boolean))
    setStats({ itemCount: itemCount ?? 0, cityCount: uniqueCities.size, loanCount: loanCount ?? 0 })
  }

  const filtered = activeCategory === 'alle'
    ? items
    : items.filter((i) => i.category === activeCategory)

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0D1E25 0%, #1A3542 60%, #1e4a58 100%)' }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(13, 30, 37, 0.72)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link href="/login" className="flex items-center gap-2.5">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: '#E1F5EE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--terra)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              V
            </span>
          </div>
          <span
            className="font-display text-white"
            style={{ fontSize: 22, letterSpacing: '-0.03em' }}
          >
            Village
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/about"
            className="text-sm text-white/60 hover:text-white/90 transition-colors px-3 py-1.5"
          >
            Om Village
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-2 rounded-xl transition-all"
            style={{
              background: 'rgba(46,98,113,0.40)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
            }}
          >
            Logg inn
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-12 pb-8 text-center max-w-xl mx-auto">
        <p
          className="text-sm font-medium mb-4 tracking-widest uppercase"
          style={{ color: 'rgba(94,154,120,0.9)', letterSpacing: '0.12em' }}
        >
          Tilgjengelig akkurat nå
        </p>
        <h1
          className="font-display text-white mb-3"
          style={{
            fontSize: 'clamp(32px, 8vw, 52px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
          }}
        >
          Populært i Village
        </h1>
        <p className="text-base mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Alt dette er tilgjengelig for lån — fra folk som allerede bruker Village.
          <br />
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Logg inn for å se hvem som eier det og sende forespørsel.
          </span>
        </p>

        {/* Live stats */}
        <div className="flex justify-center gap-6 flex-wrap">
          {[
            { n: stats.itemCount || '—', label: 'gjenstander tilgjengelig' },
            { n: stats.loanCount || '—', label: 'vellykkede lån' },
            { n: stats.cityCount || '—', label: 'byer og steder' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="font-display"
                style={{ fontSize: 28, color: '#5E9A78', letterSpacing: '-0.03em', lineHeight: 1 }}
              >
                {s.n}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category pills */}
      <div
        className="px-6 pb-4 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex gap-2 w-max mx-auto">
          {ALL_CATS.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeCategory === cat
                  ? 'rgba(46,98,113,0.70)'
                  : 'rgba(255,255,255,0.08)',
                border: activeCategory === cat
                  ? '1.5px solid rgba(46,98,113,0.70)'
                  : '1px solid rgba(255,255,255,0.12)',
                color: activeCategory === cat ? 'white' : 'rgba(255,255,255,0.60)',
              }}
            >
              {cat === 'alle'
                ? 'Alle kategorier'
                : `${CATEGORY_EMOJIS[cat]} ${CATEGORY_LABELS[cat]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <section className="px-4 pb-16 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.30)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Ingen gjenstander i denne kategorien ennå.
          </p>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {filtered.map((item) => (
              <Link
                key={item.id}
                href="/login"
                className="block rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(252,254,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  textDecoration: 'none',
                }}
              >
                {/* Image area */}
                <div
                  className="w-full flex items-center justify-center"
                  style={{
                    height: 140,
                    background: item.image_url
                      ? undefined
                      : 'rgba(46,98,113,0.25)',
                    backgroundImage: item.image_url ? `url(${item.image_url})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    fontSize: 48,
                  }}
                >
                  {!item.image_url && categoryEmoji(item.category)}
                </div>

                {/* Card body */}
                <div className="p-3">
                  <p
                    className="font-display leading-tight mb-1"
                    style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.90)',
                      letterSpacing: '-0.02em',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </p>
                  {(item.profiles?.city || item.profiles?.name) && (
                    <p className="mt-1" style={{ fontSize: 11, color: 'rgba(94,154,120,0.75)' }}>
                      {item.profiles.city ?? item.profiles.name}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#5E9A78' }}
                    />
                    <span style={{ fontSize: 11, color: 'rgba(94,154,120,0.85)' }}>Tilgjengelig</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA banner */}
      <div
        className="mx-4 mb-10 rounded-3xl p-8 text-center"
        style={{
          background: 'rgba(46,98,113,0.25)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <p
          className="font-display text-white mb-2"
          style={{ fontSize: 'clamp(20px, 5vw, 28px)', letterSpacing: '-0.025em' }}
        >
          Har du noe andre kan bruke?
        </p>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Legg det ut på Village — gratis, uten provisjon, kun for folk du stoler på.
        </p>
        <Link
          href="/register"
          className="inline-block px-8 py-3 rounded-2xl font-semibold text-white"
          style={{ background: 'var(--terra)' }}
        >
          Kom i gang
        </Link>
      </div>

      {/* Footer */}
      <footer
        className="px-6 py-8 text-center text-xs border-t"
        style={{
          borderColor: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.30)',
        }}
      >
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <Link href="/about" style={{ color: 'rgba(255,255,255,0.45)' }}>Om Village</Link>
          <Link href="/popular" style={{ color: 'rgba(255,255,255,0.45)' }}>Populært nå</Link>
          <Link href="/terms" style={{ color: 'rgba(255,255,255,0.45)' }}>Vilkår</Link>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.45)' }}>Personvern</Link>
        </div>
        © 2025 Village · Laget i Norge 🇳🇴
      </footer>
    </div>
  )
}
