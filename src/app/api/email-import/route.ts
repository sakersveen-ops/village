// src/app/api/email-import/route.ts
// Receives inbound email webhook from Resend (or Postmark).
// Caller: Resend inbound rule → POST https://village-jade.vercel.app/api/email-import
// Auth: verified via INBOUND_WEBHOOK_SECRET header

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const HAIKU_SYSTEM = `Du er en assistent som hjelper folk legge ut ting de ikke lenger trenger på en delingapp kalt Village.

Analyser e-postteksten og returner KUN gyldig JSON – ingen markdown, ingen forklaring, ingen kommentarer.

Returner dette formatet:
{
  "items": [
    {
      "name": "Kortfattet produktnavn på norsk (maks 55 tegn, ikke inkluder butikknavn eller ordrenummer)",
      "description": "2-3 setninger egnet for deling mellom naboer og venner. Ikke nevn ordrenummer, pris eller personinfo. På norsk.",
      "category": "baby-og-barn" | "klar-og-mote" | "boker" | "annet",
      "subcategory": "spise"|"leke"|"stelle"|"sove"|"bade"|"ha-pa"|"reise"|"gravid" (kun hvis category=baby-og-barn, ellers null),
      "price_nok": nummer (kun tallet, ingen kr-tegn) eller null,
      "color": "farge på norsk" eller null,
      "size": "størrelse" eller null,
      "age_range": "aldersgruppe" eller null,
      "brand": "merkenavn" eller null,
      "confidence": 0-100
    }
  ],
  "store": "butikknavn" eller null,
  "order_id": "ordrenummer" eller null
}

Regler:
- Inkluder ALLE produkter som separate items
- Tilbehør med selvstendig verdi (regntrekk, terrenghjul, tilleggsmoduler) = egne items
- Utelat verdiløse vedlegg (instruksjonshefter, garantikort, poser)
- Aldri inkluder navn, adresse, e-post eller annen personinfo i output`

// Resend inbound payload shape (subset we use)
interface ResendInboundPayload {
  from: { address: string; name?: string }
  subject?: string
  text?: string
  html?: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(req: Request) {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: ResendInboundPayload = await req.json()
  const fromEmail = body.from?.address?.toLowerCase()?.trim()

  if (!fromEmail) {
    return Response.json({ ok: false, reason: 'no_from_address' })
  }

  // Service-role client – bypasses RLS for server-side ops
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up sender in profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('email', fromEmail)
    .single()

  if (!profile) {
    await sendUnknownSenderReply(fromEmail)
    return Response.json({ ok: false, reason: 'unknown_sender' })
  }

  // Prefer plain text; fall back to stripped HTML
  const emailText = body.text?.trim() ||
    (body.html ? stripHtml(body.html) : '')

  if (!emailText) {
    return Response.json({ ok: false, reason: 'empty_body' })
  }

  // Parse with Haiku
  const anthropic = new Anthropic()
  let parsed: { items: any[]; store: string | null; order_id: string | null }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: HAIKU_SYSTEM,
      messages: [{ role: 'user', content: emailText }],
    })
    const raw = msg.content.find(b => b.type === 'text')?.text ?? ''
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    // Haiku couldn't parse – silently drop, no notification
    return Response.json({ ok: false, reason: 'parse_failed' })
  }

  if (!parsed.items?.length) {
    return Response.json({ ok: false, reason: 'no_items_found' })
  }

  // Duplicate check: same order_id + user within last 30 days
  if (parsed.order_id) {
    const { data: existing } = await supabase
      .from('item_import_drafts')
      .select('id')
      .eq('user_id', profile.id)
      .eq('order_id', parsed.order_id)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(1)
      .single()

    if (existing) {
      return Response.json({ ok: false, reason: 'duplicate_order' })
    }
  }

  // Save draft
  const { data: draft } = await supabase
    .from('item_import_drafts')
    .insert({
      user_id: profile.id,
      source: 'email',
      raw_text: emailText,
      parsed_items: parsed.items,
      store: parsed.store,
      order_id: parsed.order_id,
    })
    .select('id')
    .single()

  if (!draft) {
    return Response.json({ ok: false, reason: 'db_error' }, { status: 500 })
  }

  // Notify user in app
  const itemCount = parsed.items.length
  const storeLabel = parsed.store ? ` fra ${parsed.store}` : ''
  await supabase.from('notifications').insert({
    user_id: profile.id,
    type: 'import_ready',
    title: `${itemCount} ${itemCount === 1 ? 'gjenstand' : 'gjenstander'} klar til å legges ut`,
    body: `Vi leste ordrebekreftelsen${storeLabel} og fylte ut skjemaet. Trykk for å se over og publisere.`,
    action_url: `/add?import=${draft.id}`,
    metadata: { draft_id: draft.id, item_count: itemCount, store: parsed.store },
  })

  return Response.json({ ok: true, draft_id: draft.id, item_count: itemCount })
}

async function sendUnknownSenderReply(to: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Village <leggut@villageapp.no>',
      to,
      subject: 'Vi gjenkjenner ikke e-postadressen din',
      text: [
        'Hei!',
        '',
        `Vi mottok e-posten din fra ${to}, men denne adressen er ikke registrert på Village.`,
        '',
        'Videresend gjerne ordrebekreftelsen på nytt fra e-postadressen du brukte da du registrerte deg på Village.',
        '',
        'Hilsen Village-teamet',
      ].join('\n'),
    }),
  })
}
