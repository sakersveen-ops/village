// Path of this file: src/app/api/product-search/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Produktsøk for barn-kategorien.
// Bruker Claude + web_search for å finne babyutstyr — gir god dekning for
// Stokke, BABYBJÖRN, Chicco, Graco, norske merker osv.
// Barcode-oppslag bruker Open Food Facts som før (gratis, ingen nøkkel).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query   = searchParams.get('q')?.trim()
  const barcode = searchParams.get('barcode')?.trim()

  if (!query && !barcode) {
    return NextResponse.json({ error: 'Missing q or barcode param' }, { status: 400 })
  }

  try {
    if (barcode) return await lookupBarcode(barcode)
    return await searchByName(query!)
  } catch (err) {
    console.error('[product-search]', err)
    return NextResponse.json({ error: 'Søk feilet' }, { status: 500 })
  }
}

// ── Navnesøk via Claude + web search ─────────────────────────────────────────

async function searchByName(query: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY ikke satt' }, { status: 500 })
  }

  const prompt = `Søk etter babyprodukt eller barneprodukt: "${query}"

Finn de 4 mest relevante produktene. Returner KUN et JSON-array — ingen annen tekst, ingen markdown:
[
  {
    "name": "Fullt produktnavn",
    "brand": "Merkenavn",
    "description": "1 setning om produktet på norsk",
    "imageUrl": "https://... (direkte bilde-URL til produktet, helst hvit bakgrunn)"
  }
]

Prioriter kjente babymerker: Stokke, BABYBJÖRN, Chicco, Graco, Maxi-Cosi, Bugaboo, UPPAbaby, Phil&Teds, BabyTrend, Nuna, norske og skandinaviske merker. Om query er på norsk, svar med norske produktnavn.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[product-search] Claude API error:', err)
    return NextResponse.json({ error: 'Claude API feilet' }, { status: 500 })
  }

  const data = await res.json()

  // Finn tekst-blokken i responsen (kan komme etter tool_use-blokker)
  const textBlock = data.content?.find((b: ContentBlock) => b.type === 'text')
  if (!textBlock?.text) {
    return NextResponse.json({ results: [] })
  }

  try {
    const clean = textBlock.text.replace(/```json|```/g, '').trim()
    // Finn JSON-array i teksten selv om Claude la til litt tekst rundt
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ results: [] })

    const raw: RawProduct[] = JSON.parse(match[0])
    const results: ProductResult[] = raw
      .filter(p => p.name && p.name.trim().length > 0)
      .slice(0, 5)
      .map((p, i) => ({
        id: `claude-${Date.now()}-${i}`,
        name: p.name?.trim() ?? '',
        brand: p.brand?.trim() ?? '',
        description: p.description?.trim() ?? '',
        imageUrl: isValidImageUrl(p.imageUrl) ? p.imageUrl : null,
        category: 'barn',
        barcode: null,
      }))

    return NextResponse.json({ source: 'claude', results })
  } catch (e) {
    console.error('[product-search] JSON parse error:', e, textBlock.text)
    return NextResponse.json({ results: [] })
  }
}

// ── Barcode-oppslag via Open Food Facts ───────────────────────────────────────
// Beholdes for strekkode-scan — gratis og rask for produkter med EAN

async function lookupBarcode(barcode: string) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    { next: { revalidate: 86400 } }
  )

  if (res.ok) {
    const data = await res.json()
    if (data.status === 1 && data.product) {
      const p = data.product
      const result: ProductResult = {
        id: p._id ?? barcode,
        name: p.product_name ?? '',
        brand: p.brands ?? '',
        description: p.quantity ? `Innhold: ${p.quantity}` : '',
        imageUrl: p.image_front_small_url ?? null,
        category: 'barn',
        barcode,
      }
      if (result.name) {
        return NextResponse.json({ source: 'openfoodfacts', results: [result] })
      }
    }
  }

  // Barcode ikke funnet i Open Food Facts — fall tilbake til Claude-søk med EAN
  return searchByName(barcode)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('http')) return false
  return /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(url) || url.includes('cdn') || url.includes('image')
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductResult {
  id: string
  name: string
  brand: string
  description: string
  imageUrl: string | null
  category: string
  barcode: string | null
}

interface RawProduct {
  name?: string
  brand?: string
  description?: string
  imageUrl?: string
}

interface ContentBlock {
  type: string
  text?: string
}
