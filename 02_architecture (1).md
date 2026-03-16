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
item: any            // item record (id, name, owner_id)
user: any            // Supabase auth user (id, email, user_metadata.name, user_metadata.avatar_url)
isOwner: boolean
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
- `chat` → iMessage bubbles; mine=right+terracotta, theirs=left+white; grouped by sender (avatar only on first in group)

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
6. `selectStart` match → `bg-[#C4673A] text-white`
7. In hover range → `bg-[#FFF0E6]`

**Click behaviour**
- Owner + `onToggleBlock` → toggles date in/out of blocked
- Borrower: first click sets `selectStart`; second click calls `onSelectRange(sorted a, b)`, resets state

---

## Pages

### `src/app/items/[id]/page.tsx` — `ItemPage`

**State**
```ts
item: any                                           // items + profiles(id,name,email,avatar_url)
user: any                                           // auth user
loan: any | null                                    // current user's loan on this item
allLoans: any[]                                     // all non-terminal loans (for calendar)
pendingLoans: any[]                                 // owner only: status pending|change_proposed
proposalLoanId: string | null                       // which loan has external proposal form triggered
blockedDates: string[]
message: string                                     // pre-filled request message
startDate / dueDate: string                         // YYYY-MM-DD
sent: boolean
sentRange: { start: string; end: string } | null    // passed to ItemCalendar as requestedRange
loading: boolean
```

**Key functions**
```ts
load()
  // SELECT items + profiles WHERE id=$id
  // SELECT loans + profiles!loans_borrower_id_fkey WHERE item_id=$id AND status IN(pending,active,change_proposed) ORDER BY start_date
  // SELECT item_blocked_dates WHERE item_id=$id
  // Sets: item, allLoans, loan (myLoan), pendingLoans (owner only)

toggleBlock(dateStr)
  // DELETE or INSERT item_blocked_dates; updates blockedDates state

handleSelectRange(start, end)
  // Sets startDate, dueDate; pre-fills message with item name + dates

sendRequest()
  // INSERT loans (status:'pending', community_id: item.community_id)
  // INSERT loan_messages (type:'chat', body: message) — seeds thread
  // INSERT notifications (type:'loan_request') to owner
  // Sets sentRange, loan, sent=true

respondToLoan(loanId, accept)
  // UPDATE loans SET status='active'|'declined'
  // If accept: UPDATE items SET available=false
  // INSERT loan_messages (type:'system') with outcome text
  // INSERT notifications (type:'loan_accepted'|'loan_declined') to borrower

markReturned(loanId)
  // UPDATE loans SET status='returned'
  // UPDATE items SET available=true
```

**Render decision tree**
```
isOwner + available + no pending + no active → "Dette er din gjenstand" + access link
isOwner + activeLoan                         → LoanThread (isOwner=true)
isOwner + pendingLoans                       → per-loan: request card + Godta/Foreslå endring/Avslå + LoanThread

borrower + loan.status==='pending'           → waiting banner + LoanThread
borrower + loan.status==='change_proposed'   → proposal banner + LoanThread
borrower + loan.status==='active'            → active banner + Vipps link (if price+vipps_number) + LoanThread
borrower + no loan + available               → date inputs + message textarea + send button
borrower + no loan + unavailable             → "Utlånt akkurat nå"
```

**ItemCalendar props passed from ItemPage**
```ts
<ItemCalendar
  loans={allLoans}
  blockedDates={blockedDates}
  requestedRange={sentRange}
  onToggleBlock={isOwner ? toggleBlock : undefined}
  onSelectRange={!isOwner && !loan && item.available ? handleSelectRange : undefined}
  isOwner={isOwner}
/>
```

---

### `src/app/notifications/page.tsx` — `NotificationsPage`

**State**
```ts
notifications: any[]
tab: 'actions' | 'updates'
handledRequests: Set<string>   // local UI state; marks friend requests handled after click
loading: boolean
```

**Tab split**
```ts
ACTION_TYPES = ['loan_request', 'friend_request', 'join_request', 'friend_accepted']
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

---

### `src/app/profile/[userId]/page.tsx` — `UserProfilePage`

**State**
```ts
viewer: any / viewerProfile: any    // auth user + their profiles row
profile: any                        // target user's profiles row
items: any[]                        // access-filtered items
accessLevel: 'self'|'friend'|'friend_of_friend'|'community'|'stranger'
isStarred / friendRequestSent / isFriend: boolean
sharedCommunities: any[]    // community_members rows viewer and target share
publicCommunities: any[]    // target's is_public communities viewer is NOT in
mutualFriends: any[]        // profiles of common friends
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
```

**Filtered items (search + category)**
```ts
matchSearch = itemSearch.length < 2 || item.name/description.includes(itemSearch)
matchCat    = !itemCategory || item.category === itemCategory
// Search input only shown if items.length > 3
// Category filter only shown if availableCategories.length > 1
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

## DB Tables

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | id, name, username, email, avatar_url | 1:1 with auth.users |
| `items` | id, owner_id, name, category, description, image_url, price, vipps_number, available, community_id | |
| `loans` | id, item_id, owner_id, borrower_id, status, start_date, due_date, message, community_id | status: pending/active/change_proposed/declined/returned |
| `loan_messages` | id, loan_id, sender_id, type, body, metadata (jsonb), created_at | FK sender_id→profiles named `_sender_fkey`; type: chat/change_proposal/system |
| `notifications` | id, user_id, type, title, body, loan_id, action_url, read | |
| `friendships` | user_a, user_b | Both directions inserted on accept |
| `friend_requests` | from_id, to_id, status | status: pending/accepted/declined |
| `communities` | id, name, avatar_emoji, is_public | |
| `community_members` | user_id, community_id, status | status: active |
| `item_blocked_dates` | item_id, date | |
| `item_access` | item_id, access_type, community_id | access_type: public/friends/friends_of_friends/community |
| `starred_users` | user_id, starred_id | |

## Notification types

| type | inserted when |
|---|---|
| `loan_request` | borrower sends request |
| `loan_accepted` / `loan_declined` | owner responds to pending loan |
| `loan_message` | chat message sent in thread |
| `loan_change_proposal` | proposal sent |
| `proposal_accepted` / `proposal_declined` | proposal responded to |
| `friend_request` | friend request sent |
| `friend_accepted` | request accepted |
| `join_request` | community join |
| `join_accepted` / `join_declined` | community response |
| `starred` | user starred |

## Analytics & Tracking

### `src/lib/track.ts`
Fire-and-forget event logger.

**Signatur**
```ts
track(event: string, properties?: Record<string, unknown>): void
// Kaller supabase.from('analytics_events').insert() — ingen await, ingen error-blocking
```

**Kalles fra:** alle pages og nøkkelkomponenter ved brukerhandlinger.

### DB Tables (analytics)

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

