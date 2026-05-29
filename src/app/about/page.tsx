// Path: src/app/about/page.tsx
import Link from 'next/link'

const stories = [
  {
    emoji: '👗',
    headline: 'Kjolen som ble delt tre ganger',
    body: 'Silje kjøpte en brudepikekjole til 2 400 kr. Den har siden vært på tre bryllup – ingen av dem hennes egne. Hun har tjent inn hele summen tilbake, og tre venninner dansa hele natten i den.',
    name: 'Silje, Oslo',
  },
  {
    emoji: '🏕️',
    headline: 'Campingutstyret som aldri samler støv',
    body: 'Martin og familien bruker teltet tre helger i året. Resten av sommeren brukes det av syv andre familier. "Det er jo litt sprøtt at vi alle skulle eid hvert vårt telt," sier han.',
    name: 'Martin, Bergen',
  },
  {
    emoji: '🔧',
    headline: 'Verktøykassa til hele blokka',
    body: 'Åtte naboer deler én verktøykasse. En av dem holdt oversikten i et Excel-ark i to år. Nå gjør Village det automatisk – og alle vet hvem som har vinkelsliperen.',
    name: 'Nabokretsen på Grünerløkka',
  },
  {
    emoji: '👶',
    headline: 'Barnevogna som har båret 14 barn',
    body: '"Vi beregnet at vognen er brukt av seks familier så langt. Det er elleve barn, snart tolv." Line holder regnskap fordi hun er glad i tall. Village holder regnskap fordi det er det den gjør.',
    name: 'Line, Stavanger',
  },
]

const whys = [
  {
    stat: '80%',
    label: 'av tingene vi eier brukes sjeldnere enn én gang i måneden',
    sub: 'Kilde: Ellen MacArthur Foundation',
  },
  {
    stat: '12×',
    label: 'mer sannsynlig at du låner av noen du kjenner enn en fremmed',
    sub: 'Tillit er infrastruktur',
  },
  {
    stat: '0 kr',
    label: 'koster det å låne noe av en venn',
    sub: 'Og det føles mye bedre enn å leie',
  },
]

export default function AboutPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)' }}
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
            href="/popular"
            className="text-sm text-white/60 hover:text-white/90 transition-colors px-3 py-1.5"
          >
            Populært nå
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
      <section className="px-6 pt-20 pb-16 text-center max-w-2xl mx-auto">
        <p
          className="text-sm font-medium mb-5 tracking-widest uppercase"
          style={{ color: 'rgba(94,154,120,0.9)', letterSpacing: '0.12em' }}
        >
          Norsk deleøkonomi
        </p>
        <h1
          className="font-display text-white mb-6"
          style={{
            fontSize: 'clamp(40px, 9vw, 68px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
          }}
        >
          Tingene dine kan glede andre
        </h1>
        <p
          className="text-lg leading-relaxed mb-8 max-w-lg mx-auto"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          Village er appen der du deler det du eier med folk du stoler på — familie, venner og naboer. Ikke som en butikk. Som et fellesskap.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="px-8 py-3.5 rounded-2xl font-semibold text-white transition-all"
            style={{ background: 'var(--terra)', fontSize: 16 }}
          >
            Kom i gang gratis
          </Link>
          <Link
            href="/popular"
            className="px-8 py-3.5 rounded-2xl font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 16,
            }}
          >
            Se hva som deles nå →
          </Link>
        </div>
      </section>

      {/* Why numbers */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {whys.map((w) => (
            <div
              key={w.stat}
              className="rounded-2xl p-6 text-center"
              style={{
                background: 'rgba(252,254,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <p
                className="font-display mb-2"
                style={{
                  fontSize: 44,
                  color: '#5E9A78',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {w.stat}
              </p>
              <p className="text-sm leading-snug mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {w.label}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {w.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Origin story */}
      <section
        className="px-6 py-14 max-w-xl mx-auto text-center"
      >
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(252,254,255,0.07)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <p
            className="text-2xl leading-relaxed font-display mb-5"
            style={{ color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em' }}
          >
            "For oss småbarnsforeldre er det helt nødvendig å kunne låne utstyr av venner og bekjente."
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            — Anne Marit
          </p>
        </div>
      </section>

      {/* Stories */}
      <section className="px-6 pb-16 max-w-2xl mx-auto">
        <h2
          className="font-display text-center mb-10"
          style={{ fontSize: 'clamp(26px, 6vw, 36px)', color: 'white', letterSpacing: '-0.025em' }}
        >
          Ekte historier fra Village
        </h2>
        <div className="flex flex-col gap-5">
          {stories.map((s) => (
            <div
              key={s.name}
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(252,254,255,0.07)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl"
                  style={{ background: 'rgba(46,98,113,0.40)' }}
                >
                  {s.emoji}
                </div>
                <div>
                  <p
                    className="font-semibold mb-2"
                    style={{ color: 'rgba(255,255,255,0.90)', fontSize: 16 }}
                  >
                    {s.headline}
                  </p>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.60)' }}>
                    {s.body}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(94,154,120,0.80)' }}>
                    {s.name}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 max-w-2xl mx-auto">
        <h2
          className="font-display text-center mb-10"
          style={{ fontSize: 'clamp(26px, 6vw, 36px)', color: 'white', letterSpacing: '-0.025em' }}
        >
          Slik fungerer det
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Legg ut det du eier', body: 'Ta bilde, velg kategori, sett tilgjengelighet. Det tar to minutter.' },
            { step: '2', title: 'Del med de du stoler på', body: 'Venner, familie, naboer — eller hele kretsen din. Du bestemmer hvem som ser hva.' },
            { step: '3', title: 'Lån og bli lånt', body: 'Send forespørsel, avtal henting, bekreft retur. Alt skjer i appen.' },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(252,254,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-4"
                style={{ background: 'var(--terra)', color: 'white' }}
              >
                {item.step}
              </div>
              <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.90)' }}>
                {item.title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-6 py-16 text-center">
        <h2
          className="font-display text-white mb-4"
          style={{ fontSize: 'clamp(28px, 7vw, 44px)', letterSpacing: '-0.025em' }}
        >
          Hva har du som noen trenger?
        </h2>
        <p className="mb-8 text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Bli med gratis. Ingen abonnement, ingen provisjon.
        </p>
        <Link
          href="/register"
          className="inline-block px-10 py-4 rounded-2xl font-semibold text-white text-lg"
          style={{ background: 'var(--terra)' }}
        >
          Opprett konto
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Allerede bruker?{' '}
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'underline' }}>
            Logg inn her
          </Link>
        </p>
      </section>

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
