# Village – Granular Architecture Reference

## Supabase client

```ts
// src/lib/supabase.ts
createClient() → BrowserClient  // always called fresh per component, never cached
```

---

## Components

### `LoanThread.tsx`
Per-loan messaging thread with proposals and quick suggestions.

**Props**
```ts
loan: any            // loan record (id, status, start_date, due_date, borrower_id, message, created_at)
item: any            // item record (id, name, owner_id, connected_profile_id)
user: any            // Supabase auth user (id, email, user_metadata.name, user_metadata.avatar_url)
isOwner: boolean     // true if user.id === item.owner_id || item.connected_profile_id
onLoanUpdated: (loan: any) => void
openProposal?: boolean       // triggers proposal form to open externally
onProposalOpened?: () => void
```

**State**
```ts
messages: any[]          // loan_messages rows joined with profiles
newMessage: string
sending: boolean
loading: boolean
showProposal: boolean
propStart: string        // YYYY-MM-DD
propEnd: string
propNote: string
submitting: boolean
borrowerCommunity: string | null   // first shared community name (shown if not friends)
isFriend: boolean
```

**Refs:** `bottomRef` (auto-scroll), `proposalRef` (scroll-to on openProposal), `inputRef` (textarea)

**Key functions**
```ts
loadMessages()
  // SELECT loan_messages + profiles WHERE loan_id = loan.id ORDER BY created_at ASC
  // If empty and loan.message exists → seeds initial message into loan_messages

loadBorrowerContext()
  // Checks friendships (user_a/user_b both directions via .or())
  // If not friends → SELECT community_members.communities(name) WHERE user_id=borrower LIMIT 1

sendChat(body)
  // Optimistic insert → INSERT loan_messages (type:'chat') → replace optimistic or remove on error
  // INSERT notifications (type:'loan_message') to recipient

sendProposal()
  // Optimistic insert → INSERT loan_messages (type:'change_proposal')
  //   metadata: { proposed_start, proposed_end, status:'pending', original_start, original_end }
  // UPDATE loans SET status='change_proposed'
  // INSERT notifications (type:'loan_change_proposal') to recipient

respondProposal(messageId, accept)
  // UPDATE loan_messages SET metadata.status = 'accepted'|'declined'
  // INSERT loan_messages (type:'system') with outcome text (optimistic then replace)
  // UPDATE loans: accept → baseStatus + new dates; decline → baseStatus only
  // baseStatus = loan.status === 'active' ? 'active' : 'pending'
  // INSERT notifications (type:'proposal_accepted'|'proposal_declined') to proposal sender

applySuggestion(s)
  // s.type === 'chat'     → sendChat(s.note(item.name))
  // s.type === 'proposal' → pre-fills propNote + propStart (loan.start_date) + propEnd (due_date + delta)
  //   if computed propEnd <= today → sets propEnd to tomorrow
```

**Message types rendered**
- `system` → centred pill (grey)
- `change_proposal` → card with header, dates, status badge; Godta/Avslå buttons if `!mine && status==='pending'`
- `chat` → iMessage bubbles; mine=right+teal, theirs=left+white; grouped by sender (avatar only on first in group)

**Quick suggestions**
```ts
// Each suggestion: { id, emoji, label, type: 'chat'|'proposal', delta: number, minStatus: 'pending'|'active', note: (name)=>string }
// Filtered: minStatus==='pending' always; minStatus==='active' only if loan.status==='active'
BORROWER_SUGGESTIONS: extend(+3), shorten(-2), pickup(chat), ready_return(chat), thanks(chat)
OWNER_SUGGESTIONS:    need_back(-3), no_rush(+5), confirm_pickup(chat), remind_return(chat), all_good(chat)
```

---

### `ItemCalendar.tsx`
Airbnb-style date range picker with loan/blocked overlays.

**Props**
```ts
loans: { start_date: string; due_date: string; status: string }[]
blockedDates: string[]
requestedRange?: { start: string; end: string } | null   // borrower's own pending request → yellow
onToggleBlock?: (date: string) => void   // owner only
onSelectRange?: (start: string, end: string) => void     // borrower only
isOwner: boolean
```

**State**
```ts
currentMonth: Date
selectStart: string | null   // first click of borrower range selection
hover: string | null         // drives in-range highlight
```

**Day colour priority** (top wins)
1. Past → grey, `cursor-default`
2. `status==='active'` → `bg-red-100`
3. `status==='pending'|'change_proposed'` → `bg-amber-100`
4. `requestedRange` match → `bg-[#FDE68A]`
5. `blockedDates` match → `bg-[#E8DDD0]`
6. `selectStart` match → `bg-[#2E6271] text-white`
7. In hover range → `bg-teal-50`

**Click behaviour**
- Owner + `onToggleBlock` → toggles date in/out of blocked
- Borrower: first click sets `selectStart`; second click calls `onSelectRange(sorted a, b)`, resets state

---

## Pages

### `src/app/items/[id]/page.tsx` — `ItemPage`

**State**
```ts
item: any                                           // items + profiles(id,name,email,avatar_url) + connected_profile_id
user: any                                           // auth user
loan: any | null                                    // current user's loan on this item
allLoans: any[]                                     // all non-terminal loans (for calendar)
pendingLoans: any[]                                 // owner/co-owner only: status pending|change_proposed
proposalLoanId: string | null                       // which loan has external proposal form triggered
blockedDates: string[]
message: string                                     // pre-filled request message
startDate / dueDate: string                         // YYYY-MM-DD
sent: boolean
sentRange: { start: string; end: string } | null    // passed to ItemCalendar as requestedRange
loading: boolean
```

**Owner access**
```ts
const isOwner   = item.owner_id === user.id
const isCoOwner = item.connected_profile_id === user.id
const hasOwnerAccess = isOwner || isCoOwner
// hasOwnerAccess gates: viewing pending loans, accepting/declining, marking returned, toggling blocked dates
// isOwner only gates: editing item metadata (name, description, image, price)
```

**Loan status flow**
```
pending → confirmed (owner accepts) → active (pickup confirmed) → pending_return → returned
pending → declined
active / confirmed → change_proposed (proposal sent) → back to prior status
active → overdue (computed client-side from due_date)
```

**Key functions**
```ts
load()
  // SELECT items + profiles WHERE id=$id
  // SELECT loans + profiles!loans_borrower_id_fkey WHERE item_id=$id AND status IN(pending,confirmed,active,change_proposed,pending_return,overdue) ORDER BY start_date
  // SELECT item_blocked_dates WHERE item_id=$id
  // Sets: item, allLoans, loan (myLoan), pendingLoans (hasOwnerAccess)

toggleBlock(dateStr)
  // DELETE or INSERT item_blocked_dates; updates blockedDates state

handleSelectRange(start, end)
  // Sets startDate, dueDate; pre-fills message with item name + dates

sendRequest()
  // INSERT loans (status:'pending', community_id: item.community_id)
  // INSERT loan_messages (type:'chat', body: message) — seeds thread
  // Routing: notify the owner the borrower is friends with (owner_id preferred if friends with both)
  //   → INSERT notifications (type:'loan_request') to resolved recipient
  // Sets sentRange, loan, sent=true

respondToLoan(loanId, accept)
  // UPDATE loans SET status='confirmed'|'declined' WHERE id=$loanId AND status='pending'
  //   → if data is null: loan already handled → show toast "Denne forespørselen er allerede behandlet"
  // If accept: UPDATE items SET available=false
  // INSERT loan_messages (type:'system') with outcome text
  // INSERT notifications (type:'loan_accepted'|'loan_declined') to borrower
  // If connected_profile_id exists: INSERT notifications (type:'loan_accepted_coowner'|'loan_declined_coowner') to the non-acting co-owner

markReturned(loanId)
  // UPDATE loans SET status='returned'
  // UPDATE items SET available=true
```

**Render decision tree**
```
hasOwnerAccess + available + no pending + no active/confirmed → "Dette er din gjenstand" + access link
hasOwnerAccess + activeLoan/confirmedLoan                    → LoanThread (isOwner=true)
hasOwnerAccess + pendingLoans                                → per-loan: request card + Godta/Foreslå endring/Avslå + LoanThread

borrower + loan.status==='pending'           → waiting banner + LoanThread
borrower + loan.status==='confirmed'         → confirmed banner + LoanThread
borrower + loan.status==='change_proposed'   → proposal banner + LoanThread
borrower + loan.status==='active'            → active banner + Vipps link (if price+vipps_number) + LoanThread
borrower + loan.status==='pending_return'    → pending return banner + LoanThread
borrower + loan.status==='overdue'           → overdue warning + LoanThread
borrower + no loan + available               → date inputs + message textarea + send button
borrower + no loan + unavailable             → "Utlånt akkurat nå"
```

---

### `src/app/messages/page.tsx` — `MessagesPage`

**Purpose:** Inbox-style list of all active loan threads (both directions). Replaces navigating via item page; linked from bottom nav.

**State**
```ts
threads: Thread[]
search: string
unreadOnly: boolean
loading: boolean
```

**Thread type**
```ts
type Thread = {
  loan_id: string
  item_id: string
  item_name: string
  item_image: string | null
  item_category: string
  owner_id: string
  owner_name: string | null
  loan_status: string
  start_date: string | null
  due_date: string | null
  role: 'lender' | 'borrower'
  counterpart_id: string | null
  counterpart_name: string | null
  counterpart_avatar: string | null
  last_message_body: string | null
  last_message_at: string | null
  unread: boolean
  requires_action: boolean
}
```

**Query**
```ts
// SELECT loans WHERE (owner_id=$me OR borrower_id=$me) AND status IN non-terminal
// JOIN items, profiles (both owner and borrower)
// JOIN loan_messages (last per loan), loan_message_reads (read state)
// Unread = last message sender !== $me AND read_at IS NULL
```

**Routing:** `/messages` — in bottom nav. Thread row → `/messages/{loanId}`.

---

### `src/app/messages/[id]/page.tsx` — `MessageThreadPage`

Standalone thread view used when navigating from MessagesPage. Wraps `LoanThread` component with data loading by `loanId`.

---

### `src/app/loans/[loanId]/page.tsx` — `LoanPage`

Direct loan permalink. Loads loan + item + LoanThread. Used from notifications action_url.

---

### `src/app/notifications/page.tsx` — `NotificationsPage`

**State**
```ts
notifications: any[]
tab: 'actions' | 'updates'
handledRequests: Set<string>   // local UI state; marks friend/connection requests handled after click
loading: boolean
```

**Tab split**
```ts
ACTION_TYPES = ['loan_request', 'friend_request', 'join_request', 'loan_change_proposal', 'connection_request']
actions = notifications.filter(n =>  ACTION_TYPES.includes(n.type))
updates = notifications.filter(n => !ACTION_TYPES.includes(n.type))
```

**Query**
```ts
SELECT notifications + loans(item_id, items(name), community_id, communities(name,avatar_emoji))
WHERE user_id=$me ORDER BY created_at DESC
// Immediately after: UPDATE notifications SET read=true WHERE user_id=$me AND read=false
```

**handleFriendRequest(n, accept)**
```ts
// SELECT friend_requests WHERE to_id=$me AND status='pending' ORDER BY created_at DESC LIMIT 1
// UPDATE friend_requests SET status='accepted'|'declined'
// If accept:
//   INSERT friendships x2 (both directions)
//   INSERT notifications (type:'friend_accepted') to requester
// Adds n.id to handledRequests set
```

**handleConnectionRequest(n, accept)**
```ts
// UPDATE profile_connections SET status='active'|'disconnected', accepted_at=now() WHERE id=$connectionId
// If accept:
//   UPDATE items SET connected_profile_id=$partnerId WHERE owner_id=$me
//   UPDATE items SET connected_profile_id=$me WHERE owner_id=$partnerId
//   INSERT notifications (type:'connection_accepted') to inviter
// Adds n.id to handledRequests set
```

---

### `src/app/search/page.tsx` — `SearchPage`

**State**
```ts
tab: 'gjenstander' | 'kretser' | 'personer'
query: string
items: any[]        // items + profiles(id,name,avatar_url)
communities: any[]  // communities rows
people: any[]       // profiles rows
loading: boolean
```

**Search logic**
```ts
// Debounced 280ms on query + tab change
// gjenstander: SELECT items + profiles WHERE available=true, ilike name if query>=2, limit 40
//   → deduplicate: items with connected_profile_id shown once, attributed to owner_id
// kretser:     SELECT communities WHERE is_public=true, ilike name if query>=2, limit 40
// personer:    SELECT profiles WHERE name/username ilike query (only if query>=2), neq self, limit 30
//   → sortProfilesWithConnectionFirst() applied to results
```

**Behaviour**
- Gjenstander pre-loads on mount (empty query = show all available)
- Kretser pre-loads on mount
- Personer requires ≥2 chars before querying
- Back button uses router.back()
- Search input autofocuses on mount

---

### `src/app/profile/[userId]/page.tsx` — `UserProfilePage`

**State**
```ts
viewer: any / viewerProfile: any    // auth user + their profiles row
profile: any                        // target user's profiles row
items: any[]                        // access-filtered items (deduplicated for connected profiles)
accessLevel: 'self'|'friend'|'friend_of_friend'|'community'|'stranger'
isStarred / friendRequestSent / isFriend: boolean
sharedCommunities: any[]    // community_members rows viewer and target share
publicCommunities: any[]    // target's is_public communities viewer is NOT in
mutualFriends: any[]        // profiles of common friends — sortProfilesWithConnectionFirst() applied
itemSearch: string
itemCategory: string
loading: boolean
```

**Access level resolution**
```ts
friend            → isFriend (friendships WHERE user_a=$me AND user_b=$target)
friend_of_friend  → myFriendIds.some(id => theirFriendIds.includes(id))
community         → sharedCommunities.length > 0
stranger          → fallback
```

**Item visibility filter**
```ts
item_access === []              → visible to all
access_type 'public'            → always
access_type 'friends'           → isFriend
access_type 'friends_of_friends'→ isFriend || isFoF
access_type 'community'         → myComIds.has(rule.community_id)
// Items with connected_profile_id: shown on both owners' profile pages with 🔗 badge
// Deduplication in feeds: if viewer is friends with both owner and co-owner, show under owner_id only
```

**Key functions**
```ts
toggleStar()
  // DELETE or INSERT starred_users
  // If starring: INSERT notifications (type:'starred') to target

sendFriendRequest()
  // INSERT friend_requests (from_id=$me, to_id=$target)
  // INSERT notifications (type:'friend_request') to target
  // Sets friendRequestSent=true
```

---

### `src/app/connections/page.tsx` — `ConnectionsPage`

**Purpose:** Manage the single connected profile (Tilkoblet profil). Accessible from settings or own profile.

**State**
```ts
connection: any | null   // profile_connections row + partner profile
loading: boolean
searchQuery: string
searchResults: any[]     // profiles for invite search
inviteSent: boolean
```

**Key functions**
```ts
loadConnection()
  // SELECT profile_connections WHERE (user_a=$me OR user_b=$me) AND status='active' LIMIT 1
  // Joins partner profile

sendInvite(targetId)
  // INSERT profile_connections (user_a=min(me,target), user_b=max(me,target), initiated_by=$me, status='pending')
  // INSERT notifications (type:'connection_request') to target
  // Sets inviteSent=true

disconnect()
  // UPDATE profile_connections SET status='disconnected'
  // UPDATE items SET connected_profile_id=null WHERE owner_id=$me OR owner_id=$partnerId
  // INSERT notifications (type:'connection_disconnected') to partner
```

**Render**
```
active connection  → partner card with avatar, name, 🔗 label + "Koble fra" button (confirm modal)
pending (outgoing) → "Venter på svar fra [name]" + cancel option
pending (incoming) → handled via notifications page (Godta/Avslå inline)
no connection      → search field + "Send tilkobling" CTA
```

---

### `src/app/schedule/page.tsx` — `SchedulePage`

**Formål:** Viser alle aktive og kommende lån (begge retninger) i tidslinje- eller listevisning, med historikk dempet.

**State**
```ts
myLoans: Loan[]          // all loans both directions
viewMode: 'tidslinje' | 'liste'
loanFilter: 'pagaende' | 'historikk'
listGroup: 'gjenstand' | 'utlansdato' | 'person'
loading: boolean
```

**Loan-type (normalisert)**
```ts
type Loan = {
  id: string
  item_id: string
  owner_id: string
  borrower_id: string
  status: string
  start_date: string
  due_date: string
  role: 'lender' | 'borrower'
  items: { name: string; image_url: string | null; category: string }
  owner_profile: { name: string | null }
  counterpart: { name: string | null; email: string | null; avatar_url: string | null }
}
```

**Loan statuses (full set)**
```
pending          → amber   (forespurt, venter svar)
confirmed        → blå     (godtatt, venter henting)
active           → grønn   (aktivt lån)
change_proposed  → amber   (endringsforslag underveis)
pending_return   → blå     (låntaker merket levert, venter bekreftelse)
overdue          → rød     (forfalt)
declined         → grå
returned         → grå
```

**Queries**
```ts
// Utlån (jeg er owner eller co-owner)
SELECT loans + items + profiles!loans_borrower_id_fkey
WHERE (owner_id=$me OR items.connected_profile_id=$me) AND status IN all

// Innlån (jeg er borrower)
SELECT loans + items + profiles!loans_owner_id_fkey
WHERE borrower_id=$me AND status IN all
```

**Tidslinje-modus**
- 60 dager bakover + 27 dager fremover, en rad per item
- Lånebar på tidslinjen fargekodet etter status
- Popup på tap/klikk med låndetaljer og handlingsknapper

**Inline actions på lånekort**
- `pending` → Godta / Avslå (eier); venter (låner)
- `confirmed` → Bekreft henting (eier)
- `active` → Marker levert (låner)
- `pending_return` → Bekreft mottak (eier)

**Routing:** `/schedule` — i bottom nav ("Avtaler").

---

### `src/app/add/page.tsx` — `AddPage`

**Formål:** Skjema for å legge ut ny gjenstand. Multi-steg med kategori, underkategori, filtre (størrelse, alder, farge), bilde, beskrivelse og lokasjon.

**State (draft)**
```ts
type Draft = {
  categoryId: string
  subcategoryIds: string[]
  name: string
  description: string
  location: string
  gender: Gender | ''
  size: string
  ageRanges: string[]
  color: string
  suggestedImageUrl: string
  selectedImageSrc: 'own' | 'suggested'
  imagePreviews: string[]
  bookTitle: string
  bookAuthor: string
}
```

Draft lagres i `sessionStorage` under nøkkel `village_add_draft`.

**Routing:** `/add` — i bottom nav.

---

### `src/app/ask/page.tsx` — `AskPage`

**Formål:** Legg ut en etterlysning ("Jeg ser etter…") til venner/venners venner. Resulterer i en rad i `item_requests`.

**State**
```ts
itemName: string
category: string
audience: 'friends' | 'friends_of_friends'
imageFile: File | null
imagePreview: string
```

**Insert**
```ts
INSERT item_requests (user_id, item_name, category, audience, image_url, created_at)
INSERT notifications (type:'item_request_response') — ved svar fra andre
```

**Routing:** `/ask` — tilgjengelig fra feed og profil.

---

### `src/app/watches/page.tsx` — `WatchesPage`

**Formål:** Lagrede søk ("varsle meg når X dukker opp"). Bruker tabellen `item_watches`.

**State**
```ts
watches: any[]
query: string
maxPrice: string
category: string
location: string
availableFrom / availableTo: string
showForm: boolean
```

**CRUD**
```ts
SELECT item_watches WHERE user_id=$me ORDER BY created_at DESC
INSERT item_watches (user_id, query, max_price, category, location, available_from, available_to)
DELETE item_watches WHERE id=$id
```

**Routing:** `/watches` — tilgjengelig fra søkesiden og innstillinger.

---

### `src/app/onboarding/page.tsx` — `OnboardingPage`

Flerstegsonboarding for nye brukere: verdiprop-slides → interessevalg → Finn-import (valgfritt) → ferdig. Bruker `FinnImporter`-komponenten.

**Routing:** `/onboarding` — redirectes til etter register.

---

### `src/app/settings/page.tsx` — `SettingsPage`

Profilinnstillinger: navn, bio, telefon, by, interesser, personvern (privacy_profile, privacy_search), varslingsinnstillinger, tilkoblet profil, slett konto.

**Tabeller oppdatert**
```ts
UPDATE profiles SET name, bio, phone, city, interests, privacy_profile, privacy_search,
  notif_loan_request, notif_loan_accepted, notif_friend_request, notif_join_request
```

---

### `src/app/close-friends/page.tsx` — `CloseFriendsPage`

Administrer "nære venner"-liste. Bruker tabellen `close_friends`.

---

### `src/app/items/manage/page.tsx` — `ManageItemsPage`

Liste over egne gjenstander med sortering (nyeste/eldste/navn/status) og kategoribadges.

---

### `src/app/items/edit/page.tsx` — `EditItemPage`

Rediger eksisterende gjenstand (navn, beskrivelse, bilde, pris, synlighet).

---

### `src/app/items/access/page.tsx` — `ItemAccessPage`

Konfigurer tilgangsnivå for en gjenstand: public / friends / friends_of_friends / community. Skriver til `item_access`.

---

## Shared utilities

### `src/lib/sortProfiles.ts`
```ts
// Pins connected profile to top of any profile list, then sorts by name
export function sortProfilesWithConnectionFirst(
  profiles: any[],
  connectedProfileId: string | null
): any[]
// Usage: friend lists, mutual friends, community member lists, people search results
// Rendering: connected profile row prefixed with 🔗 before name
```

### `src/lib/categories.ts`
Master kategoridefinisjoner — **importer alltid herfra, aldri hardkod kategori-strenger**.

Eksporterer: `CATEGORIES`, `getCategoryById()`, `getCategoryLabel()`, `getCategoryGradient()`, `normalizeCategory()`, `SIZES_BY_GENDER`, `AGE_GROUPS`, `COLORS`, `LEGACY_CATEGORY_MAP`.

### `src/lib/track.ts`
Fire-and-forget analytics. Se `05_track_calls_guide.md`.

### `src/lib/sliderFill.ts`
`initSlider` / `updateSlider` — hjelpere for `input[type="range"]` CSS-variabel `--slider-val`.

### Item deduplication utility
```ts
// Applied in feeds, search, community item lists
// Items with connected_profile_id are shown once:
//   - If viewer friends with owner_id only → attributed to owner
//   - If viewer friends with connected_profile_id only → attributed to co-owner
//   - If viewer friends with both → attributed to owner_id
//   - If viewer friends with neither (public item) → attributed to owner_id
```

### Loan request routing
```ts
// On sendRequest(): resolve notification recipient
const friendOfOwner   = viewerFriendIds.includes(item.owner_id)
const friendOfCoOwner = item.connected_profile_id && viewerFriendIds.includes(item.connected_profile_id)
const notifyUserId = friendOfOwner ? item.owner_id
  : friendOfCoOwner ? item.connected_profile_id
  : item.owner_id  // fallback (public item, no friendship)
```

---

## DB Tables

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | id, name, username, email, avatar_url, bio, phone, interests, language, privacy_profile, privacy_search, notif_loan_request, notif_loan_accepted, notif_friend_request, notif_join_request, tier, village_points, city, address_street, address_zip, address_city, address_country, created_at | 1:1 med auth.users |
| `items` | id, owner_id, name, description, image_url, category, subcategories, available, price, vipps_number, community_id, connected_profile_id, location, item_filters, color, size, age_group, age_ranges, created_at | `connected_profile_id` → nullable FK til profiles; settes symmetrisk på begge partneres items når tilkobling aktiveres |
| `loans` | id, item_id, owner_id, borrower_id, status, start_date, due_date, message, community_id, created_at, updated_at, pickup_reminder_sent, return_reminder_sent | status: pending/confirmed/active/change_proposed/pending_return/overdue/declined/returned |
| `loan_messages` | id, loan_id, sender_id, type, body, metadata (jsonb), created_at | FK sender_id→profiles named `_sender_fkey`; type: chat/change_proposal/system |
| `loan_message_reads` | loan_id, user_id, read_at | Sporer lest/ulest per bruker per tråd |
| `notifications` | id, user_id, type, subtype, title, body, loan_id, action_url, metadata (jsonb), read, created_at | |
| `friendships` | id, user_a, user_b, created_at | Both directions inserted on accept |
| `friend_requests` | id, from_id, to_id, status, created_at | status: pending/accepted/declined |
| `close_friends` | user_id, friend_id | Nære venner-liste |
| `communities` | id, name, description, avatar_emoji, invite_code, created_by, is_public, visibility, created_at | |
| `community_members` | id, community_id, user_id, role, status, joined_at | status: active |
| `community_favorites` | user_id, community_id | Favorittmarkerte kretser |
| `join_requests` | community_id, user_id, status | Kø for ikke-åpne kretser |
| `item_blocked_dates` | id, item_id, date, created_at | |
| `item_access` | id, item_id, access_type, community_id, price, price_type, created_at | access_type: public/friends/friends_of_friends/community |
| `item_requests` | user_id, item_name, category, audience, image_url, created_at | Etterlysninger ("Jeg ser etter…") |
| `item_request_views` | user_id, request_id | Spor hvem som har sett en etterlysning |
| `item_watches` | id, user_id, query, max_price, category, location, available_from, available_to, created_at | Lagrede søkevarslere |
| `starred_users` | id, user_id, starred_id, created_at | |
| `profile_connections` | id, user_a, user_b, status, initiated_by, created_at, accepted_at | status: pending/active/disconnected; UNIQUE(user_a,user_b); CHECK(user_a < user_b); max one active per user |
| `stories` | id, user_id, ... | Item-stories/snutter |
| `item_stories` | item_id, story_id | Kobling mellom story og item |
| `item_story_slides` | story_id, ... | Enkelt-slides i en story |
| `group_loan_requests` | id, ... | Gruppeforespørsler (beta) |
| `group_loan_request_items` | request_id, item_id | Items i en gruppeforespørsel |
| `beta_feedback` | id, user_id, ... | Tilbakemeldinger fra FeedbackButton |
| `membership_log` | user_id, community_id, ... | Historikk for krets-medlemskap |

### Analytics tables

| Table | Key columns | Notes |
|---|---|---|
| `analytics_events` | id, user_id, session_id, event, properties (jsonb), created_at | Write-only for auth users via RLS |

### SQL Views

| View | Beregner |
|---|---|
| `v_dau_wau_mau` | Daglige/ukentlige/månedlige aktive brukere |
| `v_new_users_per_week` | Nye profiler per uke |
| `v_session_stats` | Median sesjonslengde, events per sesjon |
| `v_funnel_loan_request` | Drop-off per steg i låneforespørsels-flyten |
| `v_loan_metrics` | Antall lån, completion rate, tid til godkjenning |
| `v_item_metrics` | Antall ting lagt ut per uke |

---

## Notification types

| type | recipient | inserted when |
|---|---|---|
| `loan_request` | owner or co-owner (friend of borrower) | borrower sends request |
| `loan_accepted` / `loan_declined` | borrower | either owner or co-owner responds |
| `loan_accepted_coowner` / `loan_declined_coowner` | non-acting co-owner | the other owner acts on a loan |
| `loan_message` | counterpart | chat message sent in thread |
| `loan_change_proposal` | counterpart | proposal sent |
| `proposal_accepted` / `proposal_declined` | proposal sender | proposal responded to |
| `loan_offer` | borrower | owner proaktivt tilbyr lån |
| `loan_reminder` | borrower/owner | automatisk purring (cron) |
| `loan_start_owner` / `loan_start_borrower` | owner/borrower | lån starter (cron eller bekreftelse) |
| `loan_return_owner` / `loan_return_borrower` | owner/borrower | retur bekreftet |
| `friend_request` | target | friend request sent |
| `friend_accepted` | requester | request accepted |
| `friend_wishlist` | target | bruker ønsker seg noe fra din liste |
| `join_request` | community admin | community join request |
| `join_accepted` / `join_declined` | applicant | community response |
| `starred` | target | user starred |
| `item_request_response` | requester | noen svarer på en etterlysning |
| `connection_request` | invitee | connection invite sent |
| `connection_accepted` | inviter | invite accepted |
| `connection_disconnected` | both partners | either party disconnects |

---

## Kategoritaksonomi

Kategoriene er definert i `src/lib/categories.ts` — **aldri hardkod kategori-strenger andre steder**.

### Toppnivå

| id | Label |
|---|---|
| `baby-og-barn` | Baby & barn |
| `klar-og-mote` | Antrekk |
| `boker` | Bøker |
| `annet` | Annet (catch-all; inkluderer sport, verktøy, elektronikk, kjøkken, hage) |

### Underkategorier

**Baby & barn**
`spise` / `leke` / `stelle` / `sove` / `bade` / `ha-pa` / `reise` / `gravid` / `annet`
→ Filter: **Alder** (0–3 mnd, 3–6 mnd, 6–12 mnd, 1–2 år, 2–3 år, 3–5 år, 5–8 år, 8–12 år)
→ Filter: **Farge**

**Antrekk (klar-og-mote)**
Underkategorier: `bryllup` / `fest-og-ball` / `konfirmasjon` / `begravelse-og-seremoni` / `hverdag-og-casual` / `annet-klar`
Filtre (størrelse, sidestilte):
- Dame: XS / S / M / L / XL / XXL
- Herre: XS / S / M / L / XL / XXL
- Barn: 86–92 / 98–104 / 110–116 / 122–128 / 134–140 / 146–152 / 158–164
→ Filter: **Farge**

**Bøker**
`skjonnlitteratur` / `sakprosa` / `barn-og-ungdom` / `kokebok`

**Annet**
`sport-og-fritid` / `elektronikk` / `verktoy` / `kjokken-og-hjem` / `hage` / `annet-annet`

> **Merk:** De tidligere kategoriene `hjem-og-hage`, `fest-og-arrangement` og `friluft-og-sport` er slått sammen til `annet`. `LEGACY_CATEGORY_MAP` i `categories.ts` håndterer migrering av gamle DB-verdier.

---

## Bottom nav

5 tabs: **Hjem** (`/`) · **Kretser** (`/community/search`) · **Del** (`/add`) · **Avtaler** (`/schedule`) · **Profil** (`/profile`)

Varsler-klokke og notifikasjonsteller vises i page-headeren (ikke i bottom nav). Ikoner er SVG inline i `NavBar.tsx`.
