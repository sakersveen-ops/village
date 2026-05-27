# Village – Project Overview

## What it is
Village is a Norwegian peer-to-peer sharing and lending app. Users can list items they own, lend them to friends and family, and borrow from others. The product is live at `village-jade.vercel.app`.

## Core objectives
- Make sharing physical items between people as frictionless as possible.
- Build trust through a social graph (friends, communities).
- Keep the UI clean, community-oriented, and Norwegian-language throughout.

## Key features (built or in active development)
- **Item listing & browsing** — users post items available for lending. Multi-step add form with category, filters (size, age, colour), image and location.
- **Borrowing flow** — date range selection → loan request → owner confirms → pickup → active → return. Full status lifecycle: `pending → confirmed → active → pending_return → returned`.
- **Loan messaging thread** — per-loan chat with structured proposal actions (Godta / Foreslå endring / Avslå). Accessible from Messages inbox or item page.
- **Messages inbox** — (`/messages`) unified inbox showing all active loan threads both as lender and borrower, with unread badges and action indicators.
- **Schedule / Tidslinje** — (`/schedule`) all active and upcoming loans in timeline or list view, with inline quick-actions (godta, bekreft henting, marker levert).
- **Friends system** — send/accept requests, close friends list, mutual-friend display on profiles.
- **Communities** — shared groups visible as pill links on profile pages.
- **Notifications** — full notification system covering loan lifecycle, friend/connection requests, join requests, etterlysninger-svar, reminders.
- **Profile pages** — shows user's items, mutual friends, shared communities, search + category filter.
- **Tilkoblede profiler** — two accounts (e.g. spouses) can connect so their items appear on each other's profile with a 🔗 tag. Shared loan calendar, co-owner loan management, max one connection per account.
- **Etterlysninger / Ask** — (`/ask`) post a "looking for" request visible to friends/friends-of-friends. Others can respond with "Jeg har dette!".
- **Lagrede søk / Watches** — (`/watches`) save search criteria and get notified when matching items appear.
- **Onboarding** — multi-step onboarding: value prop → interests → optional Finn.no import.
- **Settings** — profile info, privacy settings, notification preferences, connected profile management, delete account.
- **VillagePoints & tier system** — `profiles.village_points` and `profiles.tier` track engagement and unlock features.

## Design language
- Teal/slate palette: `#2E6271` (primary), `#1A2530` (dark), `#6B7A82` (mid), `#5E9A78` (green accent).
- Liquid glass UI: frosted surfaces via `backdrop-filter`, CSS tokens `--terra`, `--terra-dark`, `--terra-mid`.
- Norwegian UI copy throughout (e.g. "Godta", "Avslå", "Foreslå endring", "Meldingstråd").
- Airbnb-style UX patterns where applicable (date pickers, item cards).
- Display font: Fraunces (via `font-display` Tailwind class) for all titles and item names.

## Stack
Next.js 14 + TypeScript + Tailwind + Supabase + Vercel. Case-sensitive file paths (Vercel). `npm run build` is the quality gate.

## Current development focus
Loan status lifecycle expansion (`confirmed`, `pending_return`, `overdue`), Messages inbox, Schedule tidslinje-view, Etterlysninger-feed on home page.
