import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  if (!userId || !/^\d+$/.test(userId)) {
    return NextResponse.json({ error: 'Ugyldig bruker-ID' }, { status: 400 })
  }

  // Fetch the public finn.no profile ads page
  const finnUrl = `https://www.finn.no/profile/ads?userId=${userId}`
  let html: string
  try {
    const res = await fetch(finnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Village/1.0)',
        'Accept-Language': 'no,nb;q=0.9',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Kunne ikke hente finn.no-profil. Sjekk at bruker-ID er riktig.' }, { status: 400 })
    }
    html = await res.text()
  } catch {
    return NextResponse.json({ error: 'Nettverksfeil ved henting av finn.no-profil.' }, { status: 500 })
  }

  // Truncate HTML to avoid token limits — keep first 80k chars (plenty for listings)
  const truncated = html.slice(0, 80000)

  // Ask Claude to extract items
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Du er en assistent som hjelper med å importere annonser fra finn.no til en delingsplattform.

Her er HTML fra finn.no-brukerprofilen. Ekstraher alle annonser/gjenstander som er oppført.

For hver annonse, returner:
- name: tittel på annonsen
- category: én av disse kategoriene basert på hva gjenstanden er: verktøy, sport, fritid, elektronikk, kjøkken, hjem, transport, klær, barn, annet
- description: kort beskrivelse (maks 100 tegn) basert på annonseteksten
- image_url: første bilde-URL hvis tilgjengelig (finn.no CDN URL), ellers null
- finn_url: direkte URL til annonsen
- is_rental_candidate: true hvis gjenstanden egner seg for utlån/leie (verktøy, utstyr, kjøretøy, fritidsutstyr osv.), false for forbruksvarer, mat, tjenester o.l.
- price: pris som nummer hvis det er en leiepris (NOK/dag eller NOK/uke), ellers null

Svar KUN med et JSON-objekt på formen:
{"items": [...], "profile_name": "navn på profilen hvis synlig"}

Ingen forklaring, ingen markdown-fencing.

HTML:
${truncated}`,
        },
      ],
    }),
  })

  if (!anthropicRes.ok) {
    return NextResponse.json({ error: 'AI-parsing feilet.' }, { status: 500 })
  }

  const aiData = await anthropicRes.json()
  const raw = aiData.content?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch {
    // Try to extract JSON from the response if there's surrounding text
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]))
      } catch {
        // fall through
      }
    }
    return NextResponse.json({ error: 'Kunne ikke tolke resultatet fra AI.', raw }, { status: 500 })
  }
}
