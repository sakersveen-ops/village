# Village — Liquid Glass Design System Reference
> For use when iterating source code. Read this before touching any visual styling.

---

## 1. Core principle

The glass treatment is applied **on top of** the warm terracotta palette — it is not a replacement for it. Every surface gets frosted; the colour story stays brown and earthy underneath.

**The single primitive:**
```css
/* globals.css — already defined, use the class */
.glass {
  background: rgba(255, 248, 243, 0.55);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(196, 103, 58, 0.18);
  box-shadow: 0 2px 24px rgba(44, 26, 14, 0.06), inset 0 1px 0 rgba(255,255,255,0.7);
  transition: box-shadow 200ms ease, background 200ms ease, border-color 200ms ease;
}
```

**Never reproduce this inline.** Always use the `glass` class (or `glass-heavy` for modals/drawers). If you're writing `rgba(255, 248, 243` anywhere in a component, stop and use the class instead.

---

## 2. Colour tokens

These are the only permitted colours. Never introduce new ones.

| Token | Hex | Use |
|---|---|---|
| `--terra` | `#C4673A` | Primary actions, active states, selected dates, CTA buttons, "mine" chat bubbles |
| `--terra-dark` | `#2C1A0E` | All body text, headings, primary text on glass surfaces |
| `--terra-mid` | `#9C7B65` | Secondary text, metadata, timestamps, placeholder text — **never body text** |
| `--terra-green` | `#4A7C59` | "Tilgjengelig" / accepted / active loan status |

**WCAG AA floor:** Never use a text colour lighter than `#9C7B65` on a glass surface. `#2C1A0E` is always the safe choice for readable text.

---

## 3. Typography

### Display font — Fraunces
Applied to: page titles, item names in cards, drawer/modal titles, calendar month name, section headers.

```tsx
// Tailwind
className="font-display"

// Or directly
style={{ fontFamily: "var(--font-display)", fontOpticalSizing: "auto", letterSpacing: "-0.025em" }}
```

**Where Fraunces appears in source** (update if you add new title-level text):
- `page-header-title` — `"Village"`, `"Kretser"`, `"Varsler"` etc.
- Item name in `ItemPage` hero section
- `item-name` inside item cards
- `cal-month-title` in `ItemCalendar.tsx`
- Modal/drawer `<h2>` titles (e.g. `"Send låneforespørsel"`)
- Profile name `<h1>` in `profile/[userId]/page.tsx`

### Body / UI text
Stays as system sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI"`). Apply these rules to text ≥ 16px:
```css
font-optical-sizing: auto;
letter-spacing: -0.01em;
```

---

## 4. Glass surface catalogue

Apply the correct variant depending on context. **Do not mix inline rgba with these classes.**

| Class | Used on | Border radius |
|---|---|---|
| `glass` | Bottom nav, page header, calendar wrapper, filter pill row container, tab bars, notification items | varies — see §5 |
| `glass-heavy` | Modal overlays, drawer sheets, loan request form | `24px 24px 0 0` (drawer) or `20px` (dialog) |
| `glass-card` | Item card body (hover tint only) | inherit from card wrapper |
| `bubble-theirs` | Chat bubbles from the other party in `LoanThread` | `18px 18px 18px 4px` |
| `proposal-card` | `change_proposal` message cards in `LoanThread` | `16px` |

**Fallback for non-supporting browsers** — already in globals.css via `@supports not (backdrop-filter)`. Do not add your own fallback logic; the CSS handles it.

---

## 5. Component-specific rules

### Bottom navigation bar (`src/app/layout.tsx` or nav component)

```tsx
<nav className="bottom-nav glass">
  {items.map(item => (
    <button
      key={item.href}
      className={`nav-item ${pathname === item.href ? 'active' : ''}`}
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </button>
  ))}
</nav>
<div className="nav-spacer" />  {/* prevents content hiding behind fixed nav */}
```

**Rules:**
- `border-radius: 24px`, `margin: 0 12px 12px`, `position: fixed`, `bottom: 0`
- Active indicator = **terracotta dot via `::after` pseudo-element** — defined in `.nav-item.active::after` in globals.css. Do NOT add a background highlight box behind the icon.
- Icon scales to `1.1×` via `transform: scale(1.1)` on `.nav-item.active .nav-icon`
- **Critical:** Never apply `filter: blur()` to the `<nav>` or any of its ancestors. This breaks the stacking context and `position: fixed` children will disappear. The glass effect comes from `backdrop-filter` on `.glass`, not `filter`.

---

### Page headers (`src/app/*/page.tsx` or shared header component)

```tsx
<header className="page-header glass">
  <h1 className="page-header-title font-display">Village</h1>
  {/* right-side actions */}
</header>
```

**Rules:**
- `position: sticky; top: 0; z-index: 40`
- `border-radius: 0 0 20px 20px` (rounds only bottom corners — it slides in from top)
- Title uses `font-display` class, `font-size: clamp(22px, 6vw, 28px)`
- Never apply `filter: blur()` here for the same stacking context reason as nav

---

### Item cards (`src/app/items/[id]/page.tsx`, feed/browse pages)

```tsx
<div className="item-card glass-hover" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(196,103,58,0.18)' }}>
  <div className="card-image-area">
    {/* image or emoji placeholder */}
  </div>
  <div className="item-card-body glass-card">
    <p className="item-name font-display">{item.name}</p>
    <p style={{ fontSize: '12px', color: 'var(--terra-mid)' }}>{owner} · {distance}</p>
    <span className={`status-pill ${item.available ? 'active' : 'declined'}`}>
      {item.available ? '● Tilgjengelig' : '● Utlånt nå'}
    </span>
  </div>
</div>
```

**Rules:**
- Card wrapper: `border-radius: 16px`, `overflow: hidden`, `border: 1px solid rgba(196,103,58,0.18)`
- Card body background: use `glass-card` class (light tint, intensifies on hover)
- Item name: always use `font-display` class
- Status pills: use `.status-pill.active` (green) or `.status-pill.declined` (terracotta)

---

### Category pills / filter tabs

```tsx
// Pill row
<div className="pill-row">
  {categories.map(cat => (
    <button
      key={cat}
      className={`pill ${activeCategory === cat ? 'active' : ''}`}
      onClick={() => setActiveCategory(cat)}
    >
      {cat}
    </button>
  ))}
</div>
```

**Rules:**
- Inactive: `glass` surface (already in `.pill` base styles in globals.css)
- Active: terracotta glass — `.pill.active` applies `border: 1.5px solid rgba(196,103,58,0.45)` and terracotta background tint
- Scroll container: `pill-row` class hides scrollbar and adds scroll-snap
- **Do not** replicate the glass styles inline with Tailwind — use the `.pill` / `.pill.active` classes

---

### Calendar wrapper (`src/components/ItemCalendar.tsx`)

**Outer wrapper:**
```tsx
<div className="calendar-wrapper glass">
  ...
</div>
```

**Month title:**
```tsx
<h2 className="cal-month-title font-display">
  {format(currentMonth, 'MMMM yyyy', { locale: nb })}
</h2>
```

**Day cell className logic** — replace any inline Tailwind colour classes with these:

| Condition | Class to apply | Visual |
|---|---|---|
| `isPast(day)` | `cal-day past` | Faded text, no cursor |
| `status === 'active'` loan | `cal-day active-loan` | Red tint |
| `status === 'pending'` or `'change_proposed'` loan | `cal-day pending-loan` | Amber tint |
| Matches `requestedRange` | `cal-day requested` | Yellow — borrower's own pending request |
| In `blockedDates` | `cal-day blocked` | Beige/taupe, strikethrough |
| `day === selectStart` | `cal-day selected` | Solid terracotta, white text |
| In hover range | `cal-day in-range` | Terracotta tint, no border-radius (flush range) |
| Hover range end | `cal-day range-end` | Slightly stronger tint, rounded |
| None of the above | `cal-day` | Default, hover tint on mouseover |

**Priority order (first matching wins):** `past` → `active-loan` → `pending-loan` → `requested` → `blocked` → `selected` → `in-range` → `range-end` → default.

```tsx
function getDayClass(day: string): string {
  const base = 'cal-day'
  if (isPast(day))                         return `${base} past`
  if (isActiveLoan(day))                   return `${base} active-loan`
  if (isPendingLoan(day))                  return `${base} pending-loan`
  if (requestedRange && inRequestedRange(day)) return `${base} requested`
  if (blockedDates.includes(day))          return `${base} blocked`
  if (day === selectStart)                 return `${base} selected`
  if (isInHoverRange(day))                 return `${base} in-range`
  if (day === hoverRangeEnd)               return `${base} range-end`
  return base
}
```

---

### Loan message thread (`src/components/LoanThread.tsx`)

**System messages:**
```tsx
<div className="flex justify-center my-2">
  <span className="system-message-pill">{msg.body}</span>
</div>
```

**Chat bubbles:**
```tsx
// Mine (right side, terracotta)
<div className="bubble-mine">{msg.body}</div>

// Theirs (left side, frosted glass)
<div className="bubble-theirs">{msg.body}</div>
```

**Proposal card (`change_proposal` type):**
```tsx
<div className="proposal-card">
  <p className="proposal-header">🔄 Forslag til endring</p>
  <div className="proposal-dates">
    <span className="date-chip">Fra: {start}</span>
    <span className="date-chip">Til: {end}</span>
  </div>
  <div className="proposal-actions">
    <button className="btn-sm btn-accept" onClick={() => respondProposal(msg.id, true)}>Godta</button>
    <button className="btn-sm btn-decline" onClick={() => respondProposal(msg.id, false)}>Avslå</button>
  </div>
</div>
```

**Status badges inside thread:**
```tsx
<span className={`status-pill ${
  loan.status === 'active'          ? 'active'   :
  loan.status === 'pending'         ? 'pending'  :
  loan.status === 'change_proposed' ? 'pending'  :
  loan.status === 'declined'        ? 'declined' :
  'returned'
}`}>
  {statusLabel[loan.status]}
</span>
```

---

### Modal overlays & drawers

```tsx
{/* Backdrop */}
<div className="modal-backdrop" onClick={onClose} />

{/* Drawer sheet (bottom slide-up) */}
<div className="drawer-sheet glass-heavy">
  <div className="drawer-handle" />
  <h2 className="modal-title font-display">Send låneforespørsel</h2>
  {/* form content */}
  <button className="btn-primary w-full">Send forespørsel</button>
</div>
```

**Rules:**
- Always `glass-heavy`, never `glass`, for modal surfaces (more opaque for focus)
- Drawer: `border-radius: 24px 24px 0 0`
- Centred dialog: `border-radius: 20px`
- Backdrop uses `backdrop-filter: blur(4px)` — defined in `.modal-backdrop` in globals.css
- `z-index: 60` on sheet (above `z-index: 50` nav, `z-index: 40` sticky header)

---

### Range sliders (calendar, future filters)

```tsx
<input
  type="range"
  min={0}
  max={100}
  value={value}
  onInput={(e) => {
    const el = e.currentTarget
    const pct = ((+el.value - +el.min) / (+el.max - +el.min)) * 100
    el.style.setProperty('--slider-val', `${pct}%`)
  }}
/>
```

The `--slider-val` CSS variable drives the gradient fill on the track. Without this, the track will appear flat/unfilled. Use the `initSlider` / `updateSlider` helpers in `src/lib/sliderFill.ts`, or inline the calculation as above.

**Never override** `input[type="range"]` styles inline — the globals.css definition handles WebKit, Firefox, focus rings, and fallbacks.

---

### Buttons

| Use | Class | When |
|---|---|---|
| Primary action (send, confirm) | `btn-primary` | One per screen — the main CTA |
| Secondary / ghost | `btn-glass` | Secondary actions, cancel, back |
| Accept (Godta) | `btn-sm btn-accept` | Inside proposal card only |
| Decline (Avslå) | `btn-sm btn-decline` | Inside proposal card only |

**Never** use raw Tailwind `bg-[#C4673A]` for buttons — use the classes above.

---

## 6. What lives where

| Pattern | Defined in | Consumed by |
|---|---|---|
| `.glass`, `.glass-heavy`, `.glass-card` | `globals.css` | Everywhere |
| `.pill`, `.pill.active` | `globals.css` | Feed, Profile, Notifications |
| `.bottom-nav`, `.nav-item` | `globals.css` | `layout.tsx` / nav component |
| `.page-header`, `.page-header-title` | `globals.css` | Per-page header components |
| `.cal-day.*` variants | `globals.css` | `ItemCalendar.tsx` |
| `.bubble-mine`, `.bubble-theirs` | `globals.css` | `LoanThread.tsx` |
| `.system-message-pill` | `globals.css` | `LoanThread.tsx` |
| `.proposal-card`, `.btn-sm` | `globals.css` | `LoanThread.tsx` |
| `.status-pill.*` | `globals.css` | `LoanThread.tsx`, item pages |
| `.modal-backdrop`, `.drawer-sheet` | `globals.css` | Drawers / modals |
| `font-display` (Tailwind class) | `tailwind.config.ts` plugin | Titles, item names, month label |
| `initSlider`, `updateSlider` | `src/lib/sliderFill.ts` | Any `input[type="range"]` |
| `--terra`, `--terra-dark` etc. | `globals.css :root` | Anywhere you need a colour inline |

---

## 7. Inline styles that are still OK

Some values are context-specific enough that they don't need a class. These are fine inline:

```tsx
// Border radius variations based on context
style={{ borderRadius: '16px' }}   // item card
style={{ borderRadius: '20px' }}   // modal dialog
style={{ borderRadius: '24px' }}   // drawer, bottom nav

// Gap / padding within a component
style={{ gap: '8px', padding: '12px 14px' }}

// Specific width/height for an avatar circle
style={{ width: '32px', height: '32px', borderRadius: '50%' }}

// Using a token in an inline style (this is fine)
style={{ color: 'var(--terra-dark)', fontFamily: 'var(--font-display)' }}
```

**Not OK inline:**
```tsx
// ❌ Don't reproduce glass manually
style={{ background: 'rgba(255, 248, 243, 0.55)', backdropFilter: 'blur(20px)' }}

// ❌ Don't hardcode palette colours
style={{ background: '#C4673A' }}  // use var(--terra) or btn-primary class

// ❌ Don't hardcode fonts
style={{ fontFamily: 'Fraunces, Georgia, serif' }}  // use font-display class
```

---

## 8. Stacking context rules

This is the most common source of invisible elements.

1. **Never use `filter: blur()` on any element that has `position: fixed` descendants.** `filter` creates a new stacking context and fixed children are positioned relative to that context, not the viewport — they vanish or misplace.
2. The glass blur effect in Village comes **exclusively** from `backdrop-filter` on `.glass` / `.glass-heavy`. There is no `filter: blur()` anywhere in the design.
3. Z-index hierarchy: modals `60` → nav bar `50` → sticky header `40` → cards `auto`.
4. If you add a new fixed/sticky element, assign a z-index from this hierarchy. Don't invent new values.

---

## 9. Adding a new screen — checklist

When building a new page or major component, verify:

- [ ] Page title uses `font-display` + `page-header-title`
- [ ] Sticky header uses `page-header glass` with `border-radius: 0 0 20px 20px`
- [ ] Filter pills use `pill` / `pill.active` classes
- [ ] Cards use `item-card` wrapper + `item-card-body glass-card` body
- [ ] Any modal/drawer uses `glass-heavy` + correct border-radius
- [ ] Status indicators use `status-pill` + correct modifier
- [ ] No `filter: blur()` anywhere in the tree above a fixed element
- [ ] `nav-spacer` div present at bottom of page so content isn't hidden behind nav
- [ ] All text ≥ 16px has `letter-spacing: -0.01em` (via Tailwind or class)
- [ ] Text colour is `--terra-dark` or `--terra-mid` — nothing lighter than `#9C7B65`
- [ ] Any `input[type="range"]` calls `initSlider` or sets `--slider-val` manually

---

## 10. Colours to avoid introducing

These are common Tailwind defaults that clash with the palette:

| Avoid | Reason |
|---|---|
| `bg-white` on surfaces | Use `glass` instead — pure white breaks the warm frosted look |
| `text-gray-500` / `text-gray-400` | Use `text-[#9C7B65]` or `var(--terra-mid)` — cooler grays clash |
| `bg-blue-*` for info states | Not in the Village palette; use `status-pill pending` (amber) |
| `rounded-2xl` on nav | Nav must be `border-radius: 24px` = `rounded-[24px]` specifically |
| `shadow-lg` / `shadow-md` | Use glass shadow tokens — standard Tailwind shadows are too cool-toned |
| `border-gray-200` | Use `border-[rgba(196,103,58,0.18)]` or `glass-border` token |
