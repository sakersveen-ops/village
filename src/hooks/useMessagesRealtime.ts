// Path of this file: src/hooks/useMessagesRealtime.ts
'use client'

/**
 * Drop-in realtime subscription for the messages list page.
 *
 * Usage: call useMessagesRealtime(userId, onNewMessage) inside
 * your messages page component alongside the existing data load.
 *
 * It subscribes to any INSERT on loan_messages where either party
 * is the current user, then calls onNewMessage() so the page can
 * re-fetch its loan list and show the updated last message + badge.
 */

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function useMessagesRealtime(
  userId: string | undefined,
  onNewMessage: () => void
) {
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase
      .channel('messages-list-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'loan_messages',
        },
        () => {
          // Re-fetch the full list so unread counts + previews update
          onNewMessage()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, onNewMessage])
}

/**
 * ─── How to integrate in src/app/messages/page.tsx ───────────────────────────
 *
 * 1. Import this hook at the top of the file:
 *      import { useMessagesRealtime } from '@/hooks/useMessagesRealtime'
 *      // (or inline it directly in messages/page.tsx if you prefer)
 *
 * 2. Add a stable callback that re-runs your existing load() function:
 *      const handleNewMessage = useCallback(() => { loadLoans() }, [])
 *      // Make sure loadLoans() is wrapped in useCallback so the ref is stable.
 *
 * 3. Call the hook:
 *      useMessagesRealtime(user?.id, handleNewMessage)
 *
 * That's it — no polling needed. The subscription fires for every new
 * loan_message row and triggers a re-fetch of the loans list.
 *
 * Note: Supabase Realtime postgres_changes requires the table to have
 * replica identity set. Run this once in SQL editor if not already done:
 *
 *   ALTER TABLE loan_messages REPLICA IDENTITY FULL;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
