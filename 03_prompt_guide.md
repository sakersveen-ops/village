# Village – Prompt Guide & Interaction Mode

## How to write efficient prompts

### Always specify
1. **Which file** you're working in (full path preferred, e.g. `src/components/LoanThread.tsx`)
2. **What's broken or missing** — symptom + observed behaviour
3. **What you've already checked** — saves diagnosis round-trips

### Prefer this format for bug reports
```
File: src/components/LoanThread.tsx
Problem: [what's wrong]
Suspected cause: [RLS? FK? import casing? state bug?]
Already checked: [pg_policies, FK, build output, etc.]
```

### For new features
```
Feature: [name]
Where: [file(s)]
Behaviour: [what it should do]
Relevant DB tables: [loans, loan_messages, etc.]
```

---

## Assumed context (don't repeat in every prompt)
Claude already knows:
- Stack: Next.js + TypeScript + Tailwind + Supabase + Vercel
- UI is Norwegian
- Color palette and design system
- Core tables: profiles, items, loans, loan_messages, friendships, notifications, communities, profile_connections
- RLS is always a suspect when data is missing
- `npm run build` is the quality gate
- Vercel deployment, case-sensitive file paths
- `hasOwnerAccess = isOwner || isCoOwner` — replaces raw `isOwner` checks wherever co-owners need access

So you **don't need to re-explain** any of the above. Just reference things by name.

---

## Preferred response style
- **Code-first**: show the fix/implementation directly, minimal preamble
- **Highlight only what changed** in diffs or edited files — don't reprint unchanged code
- **Call out risks**: if a change touches RLS, FK, or file casing, flag it explicitly
- **SQL snippets** for any schema changes, ready to run in Supabase SQL editor
- Skip motivational commentary ("Great question!") — go straight to the answer
- **Short answers and no explanations unless explicitly requested**
- **Update the .md files** after any response that changes schema, adds pages/components, adds notification types, or adds analytics events. Produce updated file(s) as output alongside the code.

---

## Common debug checklist (include in prompt if relevant)
- [ ] Checked `pg_policies` for the relevant table?
- [ ] FK exists for the join being attempted?
- [ ] `npm run build` passes locally?
- [ ] File import casing matches disk casing?
- [ ] Optimistic update rolled back on failure?
- [ ] `connected_profile_id` considered in owner-access checks?

---

## Shorthand you can use
| Shorthand | Means |
|---|---|
| "thread" | `LoanThread.tsx` and its loan message logic |
| "calendar" | `ItemCalendar.tsx` date range picker |
| "item page" | `src/app/items/[id]/page.tsx` |
| "profile page" | `src/app/profile/[userId]/page.tsx` |
| "connections page" | `src/app/connections/page.tsx` |
| "RLS issue" | Missing or incorrect Supabase row-level security policy |
| "FK issue" | Missing foreign key causing Supabase join to fail |
| "track()" | `src/lib/track.ts` — bruk for alle nye brukerhandlinger |
| "analytics dashboard" | `src/app/admin/insights/page.tsx` |
| "co-owner" | The connected profile partner (item.connected_profile_id) |
| "hasOwnerAccess" | `isOwner \|\| isCoOwner` — gate for all loan management actions |

## Analytics tracking — konvensjon
Når du legger til en ny brukerhandling, legg alltid til en track()-kall:
```ts
track(Events.LOAN_REQUEST_SENT, { item_id: item.id, days_requested: n })
track(Events.FRIEND_REQUEST_SENT)
track(Events.ITEM_PUBLISHED, { category: item.category })
```
Event-navn: snake_case, verb_noun-format via `Events.*` konstanter — aldri raw strings.
Properties: kun ikke-personidentifiserbar info.

## .md update convention
For any prompt response that introduces:
- New DB tables or column changes → update `02_architecture__1_.md` DB Tables section
- New pages or components → update `02_architecture__1_.md` Pages/Components section
- New notification types → update `02_architecture__1_.md` Notification types table
- New analytics events → update `05_track_calls_guide.md`
- New major features → update `01_project_overview.md` Key features list

Claude produces updated .md file(s) as downloadable output alongside any code. Sverre pastes them back manually.
