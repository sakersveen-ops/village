import { NextRequest, NextResponse } from 'next/server'

// Proxy for Open Food Facts (gratis, ingen nøkkel nødvendig)
// + UPC Item DB fallback (krever UPCITEMDB_KEY i .env.local)
// Brukes av /items/new for å søke opp barneprodukt via navn eller strekkode

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()
  const barcode = searchParams.get('barcode')?.trim()

  if (!query && !barcode) {
    return NextResponse.json({ error: 'Missing q or barcode param' }, { status: 400 })
  }

  try {
    if (barcode) {
      return await lookupBarcode(barcode)
    }
    return await searchByName(query!)
  } catch (err) {
    console.error('[product-search]', err)
    return NextResponse.json({ error: 'Søk feilet' }, { status: 500 })
  }
}

// ── Strekkode-oppslag ─────────────────────────────────────────────────────────

async function lookupBarcode(barcode: string) {
  // 1. Prøv Open Food Facts / Open Products (gratis)
  const offRes = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    { next: { revalidate: 86400 } }
  )
  if (offRes.ok) {
    const data = await offRes.json()
    if (data.status === 1 && data.product) {
      const p = data.product
      return NextResponse.json({
        source: 'openfoodfacts',
        results: [normalizeOFF(p)],
      })
    }
  }

  // 2. Fallback: UPC Item DB
  const upcKey = process.env.UPCITEMDB_KEY
  if (upcKey) {
    const upcRes = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      {
        headers: { 'user_key': upcKey, 'key_type': '3scale' },
        next: { revalidate: 86400 },
      }
    )
    if (upcRes.ok) {
      const data = await upcRes.json()
      const items: UPCItem[] = data.items ?? []
      if (items.length > 0) {
        return NextResponse.json({
          source: 'upcitemdb',
          results: items.map(normalizeUPC),
        })
      }
    }
  }

  return NextResponse.json({ results: [] })
}

// ── Navnesøk via Open Food Facts ─────────────────────────────────────────────

async function searchByName(query: string) {
  const encoded = encodeURIComponent(query)
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,image_front_small_url,categories_tags,quantity,_id`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return NextResponse.json({ results: [] })

  const data = await res.json()
  const products: OFFProduct[] = (data.products ?? []).filter(
    (p: OFFProduct) => p.product_name && p.product_name.trim().length > 0
  )

  return NextResponse.json({
    source: 'openfoodfacts',
    results: products.map(normalizeOFF),
  })
}

// ── Normalisering ─────────────────────────────────────────────────────────────

export interface ProductResult {
  id: string
  name: string
  brand: string
  description: string
  imageUrl: string | null
  category: string
  barcode: string | null
}

interface OFFProduct {
  _id?: string
  product_name?: string
  brands?: string
  image_front_small_url?: string
  categories_tags?: string[]
  quantity?: string
}

interface UPCItem {
  ean?: string
  title?: string
  brand?: string
  description?: string
  images?: string[]
  category?: string
  color?: string
}

function normalizeOFF(p: OFFProduct): ProductResult {
  const cats = (p.categories_tags ?? [])
    .filter((c: string) => !c.startsWith('en:'))
    .map((c: string) => c.replace(/^[a-z]{2}:/, ''))
    .slice(0, 2)
    .join(', ')

  return {
    id: p._id ?? Math.random().toString(36).slice(2),
    name: p.product_name ?? '',
    brand: p.brands ?? '',
    description: p.quantity ? `Innhold: ${p.quantity}` : '',
    imageUrl: p.image_front_small_url ?? null,
    category: cats,
    barcode: p._id ?? null,
  }
}

function normalizeUPC(p: UPCItem): ProductResult {
  return {
    id: p.ean ?? Math.random().toString(36).slice(2),
    name: p.title ?? '',
    brand: p.brand ?? '',
    description: p.description ?? '',
    imageUrl: p.images?.[0] ?? null,
    category: p.category ?? '',
    barcode: p.ean ?? null,
  }
}
