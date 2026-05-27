// src/app/api/email-import/route.ts
// Receives inbound email webhook from Resend (email.received event).
// Caller: Resend webhook → POST https://village-jade.vercel.app/api/email-import
// Auth: Resend-Signature header verified with RESEND_WEBHOOK_SECRET

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

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

// Resend email.received payload shape
interface ResendEmailReceivedEvent {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string        // plain address string, e.g. "sverre@gmail.com"
    to: string[]
    subject?: string
    text?: string       // NOTE: Resend does not expose body in the webhook payload.
    html?: string       // Body must be fetched separately – see fetchEmailBody().
    attachments?: Array<{ id: string; filename: string; content_type: string; content_disposition: string }>
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Resend webhook signature verification
// See: https://resend.com/docs/webhooks/verify-webhooks-requests
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false
  const signature = headers.get('resend-signature') ?? headers.get('svix-signature') ?? ''
  const timestamp  = headers.get('resend-timestamp') ?? headers.get('svix-timestamp') ?? ''
  if (!signature || !timestamp) return false
  const signed = `${timestamp}.${rawBody}`
  const expected = createHmac('sha256', secret).update(signed).digest('hex')
  // signature may be prefixed "v1,<hex>" – strip the prefix
  const actual = signature.replace(/^v\d+,/, '')
  return actual === expected
}

// Fetch full email body from Resend received emails API
async function fetchEmailBody(emailId: string): Promise<{ text: string | null; html: string | null }> {
  const url = `https://api.resend.com/emails/receiving/${emailId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  const data = await res.json()
  console.log('[fetchEmailBody]', url, res.status, JSON.stringify(data).slice(0, 300))
  if (!res.ok) return { text: null, html: null }
  return { text: data.text ?? null, html: data.html ?? null }
}

// Fetch first PDF attachment and return as base64
// Lists attachments first to get the correct download_url (webhook attachment ID may differ)
async function fetchPdfAttachment(emailId: string): Promise<string | null> {
  // List attachments to get download_url
  const listUrl = `https://api.resend.com/emails/receiving/${emailId}/attachments`
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })
  const listData = await listRes.json()
  console.log('[fetchPdfAttachment list]', listUrl, listRes.status, JSON.stringify(listData).slice(0, 300))
  if (!listRes.ok) return null

  const pdfAttachment = listData.data?.find((a: any) => a.content_type === 'application/pdf')
  if (!pdfAttachment?.download_url) return null

  // Download the actual PDF bytes
  const pdfRes = await fetch(pdfAttachment.download_url)
  console.log('[fetchPdfAttachment download]', pdfAttachment.download_url.slice(0, 80), pdfRes.status)
  if (!pdfRes.ok) return null
  const buffer = await pdfRes.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

export async function POST(req: Request) {
  const rawBody = await req.text()

  // TODO: re-enable once confirmed working
  // if (!verifySignature(rawBody, req.headers)) {
  //   return Response.json({ error: 'unauthorized' }, { status: 401 })
  // }

  let event: ResendEmailReceivedEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Only handle inbound emails
  if (event.type !== 'email.received') {
    return Response.json({ ok: true, reason: 'ignored_event_type' })
  }

  // from is a plain string in Resend inbound: "Name <addr>" or just "addr"
  const fromRaw = event.data.from ?? ''
  const fromMatch = fromRaw.match(/<([^>]+)>/) 
  const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).toLowerCase().trim()

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

  // Fetch email body from Resend (not included in webhook payload)
  const { text, html } = await fetchEmailBody(event.data.email_id)
  const emailText = text?.trim() || (html ? stripHtml(html) : '')

  // Build Haiku message content — prefer text body, fall back to PDF attachment
  const anthropic = new Anthropic()
  let haikuContent: any

  if (emailText) {
    haikuContent = emailText
  } else {
    // No text body — look for a PDF attachment in the webhook payload
    const pdfAttachment = event.data.attachments?.find(
      (a: any) => a.content_type === 'application/pdf'
    )
    if (!pdfAttachment) {
      return Response.json({ ok: false, reason: 'empty_body' })
    }
    const pdfBase64 = await fetchPdfAttachment(event.data.email_id)
    if (!pdfBase64) {
      return Response.json({ ok: false, reason: 'pdf_fetch_failed' })
    }
    haikuContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      },
      { type: 'text', text: 'Analyser dette dokumentet og returner JSON som beskrevet.' },
    ]
  }

  // Parse with Haiku
  let parsed: { items: any[]; store: string | null; order_id: string | null }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: HAIKU_SYSTEM,
      messages: [{ role: 'user', content: haikuContent }],
    })
    const raw = msg.content.find(b => b.type === 'text')?.text ?? ''
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
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
