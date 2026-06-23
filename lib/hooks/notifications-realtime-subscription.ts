"use client"

import { useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"

export type NotificationChangeListener = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) => void

const listeners = new Set<NotificationChangeListener>()
let activeUserId: string | null = null
let channelRef: RealtimeChannel | null = null
let supabaseRef: SupabaseClient | null = null
let subscriberCount = 0

function notifyAll(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  for (const listener of listeners) {
    try {
      listener(payload)
    } catch (err) {
      console.error("[NOTIFICATIONS] Realtime listener error:", err)
    }
  }
}

function teardownChannel() {
  if (channelRef && supabaseRef) {
    supabaseRef.removeChannel(channelRef)
  }
  channelRef = null
  activeUserId = null
}

function ensureChannel(userId: string, supabase: SupabaseClient) {
  if (activeUserId === userId && channelRef) return

  teardownChannel()
  activeUserId = userId
  supabaseRef = supabase

  channelRef = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        notifyAll(payload)
      },
    )
    .subscribe()
}

/**
 * Shared user-scoped notifications realtime channel. Multiple consumers register
 * listeners; only one Supabase channel is opened per signed-in user.
 */
export function useNotificationsRealtimeSubscription(
  userId: string | null,
  listener: NotificationChangeListener,
  enabled = true,
) {
  const supabase = useMemo(() => createClient(), [])
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!enabled || !userId) return

    const wrapped: NotificationChangeListener = (payload) => listenerRef.current(payload)
    listeners.add(wrapped)
    subscriberCount += 1
    ensureChannel(userId, supabase)

    return () => {
      listeners.delete(wrapped)
      subscriberCount -= 1
      if (subscriberCount <= 0) {
        subscriberCount = 0
        teardownChannel()
      }
    }
  }, [userId, enabled, supabase])
}
