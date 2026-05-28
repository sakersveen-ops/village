// Path: src/lib/share.ts
// Utility for generating share links + triggering native share sheet.
// SMS/plain-text fallback is used automatically by iMessage/WhatsApp link preview.
//
// Usage:
//   import { shareItem, shareProfile, shareCommunity } from '@/lib/share'
//   await shareItem(item, ownerName)  // opens native share sheet

import { track, Events } from '@/lib/track'

const BASE = 'https://village-jade.vercel.app'

// ─── URL builders ─────────────────────────────────────────────────────────────

export function itemShareUrl(itemId: string) {
  return `${BASE}/p/item/${itemId}`
}

export function profileShareUrl(userId: string) {
  return `${BASE}/p/profile/${userId}`
}

export function communityShareUrl(communityId: string) {
  return `${BASE}/p/community/${communityId}`
}

// ─── Deep-link: existing user re-opens app directly to the right screen ────────
// Append ?app=1 so the target page can redirect logged-in users to /items/[id] etc.
// The public /p/* pages should check searchParams.app=1 + cookie → redirect.

export function itemDeepLink(itemId: string) {
  return `${BASE}/items/${itemId}`
}

export function profileDeepLink(userId: string) {
  return `${BASE}/profile/${userId}`
}

export function communityDeepLink(communityId: string) {
  return `${BASE}/community/${communityId}`
}

// ─── SMS / plain-text fallback ─────────────────────────────────────────────────
// These are used as the `text` field in navigator.share() so that
// iMessage and WhatsApp show a readable preview even when og:image fails to load.

export function itemSmsText(itemName: string, ownerName: string, available: boolean, itemId: string) {
  const status = available ? '– tilgjengelig nå' : ''
  return `${ownerName} deler «${itemName}» ${status} på Village.\n${itemShareUrl(itemId)}`
}

export function profileSmsText(profileName: string, itemCount: number, userId: string) {
  return `Se hva ${profileName} deler på Village (${itemCount} gjenstander).\n${profileShareUrl(userId)}`
}

export function communitySmsText(communityName: string, memberCount: number, communityId: string) {
  return `Bli med i «${communityName}» på Village – ${memberCount} naboer deler allerede.\n${communityShareUrl(communityId)}`
}

// ─── Share sheet helpers ───────────────────────────────────────────────────────
// Falls back to clipboard copy on desktop or unsupported browsers.

export async function shareItem(item: { id: string; name: string; available: boolean }, ownerName: string) {
  const url = itemShareUrl(item.id)
  const text = itemSmsText(item.name, ownerName, item.available, item.id)
  await triggerShare({ title: `${item.name} – lån på Village`, text, url })
  track(Events.ITEM_SHARED, { item_id: item.id })
}

export async function shareProfile(profile: { id: string; name: string }, itemCount: number) {
  const url = profileShareUrl(profile.id)
  const text = profileSmsText(profile.name, itemCount, profile.id)
  await triggerShare({ title: `${profile.name} deler på Village`, text, url })
  track(Events.PROFILE_SHARED, { profile_id: profile.id })
}

export async function shareCommunity(community: { id: string; name: string }, memberCount: number) {
  const url = communityShareUrl(community.id)
  const text = communitySmsText(community.name, memberCount, community.id)
  await triggerShare({ title: `${community.name} – bli med på Village`, text, url })
  track(Events.COMMUNITY_SHARED, { community_id: community.id })
}

// ─── Core trigger (native sheet or clipboard fallback) ────────────────────────

async function triggerShare({ title, text, url }: { title: string; text: string; url: string }) {
  if (typeof navigator === 'undefined') return
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch {
      // User cancelled or share failed → fall through to clipboard
    }
  }
  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(url)
    // Caller can show a "Lenke kopiert!" toast
  } catch {
    // Silent fail on restrictive environments
  }
}
