# Village – Project Overview

## What it is
Village is a Norwegian peer-to-peer sharing and lending app. Users can list items they own, lend them to neighbours/friends, and borrow from others. The product is live at `village-jade.vercel.app`.

## Core objectives
- Make sharing physical items between people as frictionless as possible.
- Build trust through a social graph (friends, communities).
- Keep the UI warm, community-oriented, and Norwegian-language throughout.

## Key features (built or in active development)
- **Item listing & browsing** — users post items available for lending.
- **Borrowing flow** — date range selection → loan request → owner approval/counter-proposal/decline.
- **Loan messaging thread** — per-loan chat with structured proposal actions (Godta / Foreslå endring / Avslå).
- **Friends system** — send/accept requests, mutual-friend display on profiles.
- **Communities** — shared groups visible as pill links on profile pages.
- **Notifications** — friend requests, loan status changes, friend_accepted events.
- **Profile pages** — shows user's items, mutual friends, shared communities, search + category filter.
- **Tilkoblede profiler** — two accounts (e.g. spouses) can connect so their items appear on each other's profile with a 🔗 tag. Shared loan calendar, co-owner loan management, max one connection per account.

## Design language
- Warm brown/terracotta palette: `#C4673A` (primary), `#2C1A0E` (dark), `#9C7B65` (mid), `#4A7C59` (green accent).
- Norwegian UI copy throughout (e.g. "Godta", "Avslå", "Foreslå endring", "Meldingstråd").
- Airbnb-style UX patterns where applicable (date pickers, item cards).

## Current development focus
Connected Profiles (Tilkoblede profiler): schema, invite flow, co-owner loan management, item deduplication in feeds, 🔗 badge on item cards.
