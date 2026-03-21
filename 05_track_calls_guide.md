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

## src/app/connections/page.tsx — ConnectionsPage (ny)

### sendInvite(targetId)
```ts
track(Events.CONNECTION_INVITE_SENT, { target_id: targetId })
```

### disconnect()
```ts
track(Events.CONNECTION_DISCONNECTED)
```

---

## Events-konstanter som må legges til i src/lib/track.ts

```ts
// Tilkoblede profiler
CONNECTION_INVITE_SENT:    'connection_invite_sent',
CONNECTION_ACCEPTED:       'connection_accepted',
CONNECTION_DECLINED:       'connection_declined',
CONNECTION_DISCONNECTED:   'connection_disconnected',
MIRROR_ITEM_VIEWED:        'mirror_item_viewed',   // når bruker ser et item med 🔗-badge
```

---

## Fremtidige filer (item-opplasting)
Når item-opplastingsskjema bygges:
```ts
track(Events.ITEM_FORM_OPENED)
// ... ved bildeopplasting:
track(Events.ITEM_IMAGE_ADDED)
// ... ved publisering:
const t = startTimer()
// ... etter vellykket insert:
track(Events.ITEM_PUBLISHED, { category: item.category, duration_ms: t() })
```
