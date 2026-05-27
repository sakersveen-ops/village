# Village Analytics — track()-kall i eksisterende filer

Legg til `import { track, Events, startTimer } from '@/lib/track'` øverst i hver fil.

---

## src/app/items/[id]/page.tsx — ItemPage

### sendRequest()
```ts
// Legg til øverst i sendRequest() — før insert
const t = startTimer()

// Legg til etter vellykket insert (etter setLoan, setSent=true):
track(Events.LOAN_REQUEST_SENT, {
  item_id: item.id,
  duration_ms: t(),
  days_requested: Math.ceil(
    (new Date(dueDate).getTime() - new Date(startDate).getTime()) / 86400000
  ),
})
```

### respondToLoan(loanId, accept)
```ts
// Etter vellykket UPDATE (data ikke null):
track(accept ? Events.LOAN_ACCEPTED : Events.LOAN_DECLINED, {
  loan_id: loanId,
  item_id: item.id,
  handled_by: isCoOwner ? 'co_owner' : 'owner',
})
```

### handleSelectRange(start, end)
```ts
// På slutten av funksjonen:
track(Events.DATE_RANGE_SELECTED, {
  item_id: item?.id,
  days: Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  ),
})
```

### Når ItemCalendar vises for borrower — i JSX (eller i load()):
```ts
// I useEffect/load når item er lastet og bruker ikke er eier:
if (!hasOwnerAccess) track(Events.CALENDAR_OPENED, { item_id: item.id })
```

---

## src/components/LoanThread.tsx

### sendProposal()
```ts
// Etter vellykket INSERT:
track(Events.PROPOSAL_SENT, { loan_id: loan.id, item_id: item.id })
```

### respondProposal(messageId, accept)
```ts
// Etter vellykket UPDATE:
track(accept ? Events.PROPOSAL_ACCEPTED : Events.PROPOSAL_DECLINED, {
  loan_id: loan.id,
  item_id: item.id,
})
```

---

## src/app/notifications/page.tsx

### handleFriendRequest(n, accept)
```ts
// Etter vellykket UPDATE:
track(Events.FRIEND_REQUEST_HANDLED, { accepted: accept })
```

### handleConnectionRequest(n, accept)
```ts
// Etter vellykket UPDATE:
track(accept ? Events.CONNECTION_ACCEPTED : Events.CONNECTION_DECLINED, {
  connection_id: n.connection_id,
})
```

---

## src/app/profile/[userId]/page.tsx

### sendFriendRequest()
```ts
// Etter INSERT:
track(Events.FRIEND_REQUEST_SENT)
```

### I useEffect/load — når profil vises:
```ts
// Øverst i load() etter profil er hentet, men kun hvis ikke self:
if (userId !== viewer?.id) track(Events.PROFILE_VIEWED, { profile_id: userId })
```

---

## src/app/connections/page.tsx — ConnectionsPage

### sendInvite(targetId)
```ts
track(Events.CONNECTION_INVITE_SENT, { target_id: targetId })
```

### disconnect()
```ts
track(Events.CONNECTION_DISCONNECTED)
```

---

## src/app/add/page.tsx — AddPage

### Når skjema åpnes:
```ts
track(Events.ITEM_FORM_OPENED)
```

### Ved bildeopplasting:
```ts
track(Events.ITEM_IMAGE_ADDED)
```

### Ved publisering (etter vellykket insert):
```ts
track(Events.ITEM_PUBLISHED, { category: draft.categoryId, duration_ms: t() })
```

---

## src/app/ask/page.tsx — AskPage

### Ved innsending:
```ts
track(Events.ITEM_REQUEST_POSTED, { category, audience })
```

---

## src/app/page.tsx — Feed

### Ved visning:
```ts
track(Events.FEED_VIEWED)
```

### Ved kategorifiltrering:
```ts
track(Events.CATEGORY_FILTERED, { category })
```

---

## Events-konstanter i src/lib/track.ts (komplett liste)

```ts
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
  SESSION_START:           'session_start',

  // Feed
  FEED_VIEWED:             'feed_viewed',
  CATEGORY_FILTERED:       'category_filtered',

  // VillagePoints
  POINTS_EARNED:           'points_earned',   // { delta, reason }
  POINTS_SPENT:            'points_spent',    // { delta, item_id }

  // Bodega browsing
  BODEGA_OPENED:           'bodega_opened',
  BODEGA_ITEM_VIEWED:      'bodega_item_viewed',    // { item_id }
  BODEGA_LOAN_STARTED:     'bodega_loan_started',   // { item_id, points_cost, days }
  BODEGA_LOAN_COMPLETED:   'bodega_loan_completed', // { item_id, loan_id }

  // Etterlysninger (Ask)
  ITEM_REQUEST_POSTED:     'item_request_posted',    // { category, audience }
  ITEM_REQUEST_RESPONSE:   'item_request_response',  // { request_id }
  BODEGA_REQUEST_SUBMITTED:'bodega_request_submitted', // { item_name }
  BODEGA_REQUEST_VOTED:    'bodega_request_voted',   // { request_id }

  // Premium
  PREMIUM_UPGRADE_TAPPED:  'premium_upgrade_tapped',
  PREMIUM_UPGRADED:        'premium_upgraded',

  // Misc
  FEEDBACK_SUBMITTED:           'feedback_submitted',
  SEARCH_DATE_FILTER_APPLIED:   'search_date_filter_applied',
  MIRROR_ITEM_VIEWED:           'mirror_item_viewed', // item med 🔗-badge
} as const
```
