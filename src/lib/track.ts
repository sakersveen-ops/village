/**
 * Village Analytics — track()
 *
 * Fire-and-forget event logger. Blokkerer aldri UI.
 * Kall dette ved brukerhandlinger — ikke ved siderender.
 *
 * Konvensjon for event-navn: snake_case, verb_substantiv
 * Eksempel: 'loan_request_sent', 'item_published', 'calendar_opened'
 *
 * Ikke logg personidentifiserbar info i properties (navn, e-post, adresse).
 */

import { createClient } from '@/lib/supabase'

// ----------------------------------------------------------------
// Session ID — genereres én gang per nettleser-sesjon
// Ny fane = ny sesjon (sessionStorage, ikke localStorage)
// ----------------------------------------------------------------
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = sessionStorage.getItem('v_sid')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('v_sid', id)
  }
  return id
}



// ----------------------------------------------------------------
// Timing-hjelper — bruk for å måle tid i en flyt
//
// Eksempel:
//   const t = startTimer()
//   // ... bruker gjør noe ...
//   track('loan_request_sent', { ...props, duration_ms: t() })
// ----------------------------------------------------------------
export function startTimer(): () => number {
  const start = Date.now()
  return () => Date.now() - start
}

// ----------------------------------------------------------------
// Hoved-funksjon
// ----------------------------------------------------------------
export async function track(
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  // Hent innlogget bruker — ikke blokker hvis ikke tilgjengelig
  let userId: string | null = null
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    userId = data?.user?.id ?? null
  } catch {
    // Ikke innlogget eller auth feil — logg likevel med null user_id
  }

  const payload = {
    user_id:    userId,
    session_id: getSessionId(),
    event,
    properties,
  }

  // Fire-and-forget — ingen await, ingen error-handling som stopper appen
  try {
    const supabase = createClient()
    supabase.from('analytics_events').insert(payload).then(() => {
      // stille — vi bryr oss ikke om resultatet
    })
  } catch {
    // Stille feil — tracking skal aldri påvirke brukeropplevelsen
  }
}

// ----------------------------------------------------------------
// Forhåndsdefinerte events — bruk disse for konsistens
// Legg til nye her etter hvert som flyten utvides
// ----------------------------------------------------------------
export const Events = {
  // Låneforespørsel-flyt
  CALENDAR_OPENED:        'calendar_opened',
  DATE_RANGE_SELECTED:    'date_range_selected',
  LOAN_MESSAGE_TYPED:     'loan_message_typed',
  LOAN_REQUEST_SENT:      'loan_request_sent',
  LOAN_ACCEPTED:          'loan_accepted',
  LOAN_DECLINED:          'loan_declined',

  // Forhandling
  PROPOSAL_SENT:          'proposal_sent',
  PROPOSAL_ACCEPTED:      'proposal_accepted',
  PROPOSAL_DECLINED:      'proposal_declined',

  // Item-flyt
  ITEM_FORM_OPENED:       'item_form_opened',
  ITEM_IMAGE_ADDED:       'item_image_added',
  ITEM_PUBLISHED:         'item_published',

  // Sosiale flyter
  PROFILE_VIEWED:         'profile_viewed',
  FRIEND_REQUEST_SENT:    'friend_request_sent',
  FRIEND_REQUEST_HANDLED: 'friend_request_handled',

  // Tilkoblede profiler
  CONNECTION_INVITE_SENT:  'connection_invite_sent',
  CONNECTION_ACCEPTED:     'connection_accepted',
  CONNECTION_DECLINED:     'connection_declined',
  CONNECTION_DISCONNECTED: 'connection_disconnected',

  // Sesjon
  SESSION_START:          'session_start',

  // Feed
  FEED_VIEWED:            'feed_viewed',
  CATEGORY_FILTERED:      'category_filtered',

  // VillagePoints
  POINTS_EARNED: 'points_earned',           // { user_id, delta, reason }
  POINTS_SPENT: 'points_spent',             // { user_id, delta, item_id }

  // Bodega browsing
  BODEGA_OPENED: 'bodega_opened',
  BODEGA_ITEM_VIEWED: 'bodega_item_viewed', // { item_id }
  BODEGA_LOAN_STARTED: 'bodega_loan_started', // { item_id, points_cost, days }
  BODEGA_LOAN_COMPLETED: 'bodega_loan_completed', // { item_id, loan_id }

  // Item requests
  BODEGA_REQUEST_SUBMITTED: 'bodega_request_submitted', // { item_name }
  BODEGA_REQUEST_VOTED: 'bodega_request_voted',          // { request_id }

  // Premium
  PREMIUM_UPGRADE_TAPPED: 'premium_upgrade_tapped',
  PREMIUM_UPGRADED: 'premium_upgraded',

  ITEM_REQUEST_RESPONSE: 'item_request_response',
  ITEM_REQUEST_POSTED: 'item_request_posted',

} as const

export type EventName = typeof Events[keyof typeof Events]
