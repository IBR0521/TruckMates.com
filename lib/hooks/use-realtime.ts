"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * Hook for real-time subscriptions to Supabase tables
 * Automatically handles connection, reconnection, and cleanup
 */
export function useRealtimeSubscription<T = any>(
  table: string,
  options: {
    filter?: string // e.g., "company_id=eq.xxx"
    event?: "INSERT" | "UPDATE" | "DELETE" | "*"
    onInsert?: (payload: T) => void
    onUpdate?: (payload: T) => void
    onDelete?: (payload: T) => void
    enabled?: boolean
  } = {}
) {
  const [data, setData] = useState<T[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClient()

  const {
    filter = "",
    event = "*",
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options

  useEffect(() => {
    if (!enabled) return

    const channelName = `realtime:${table}${filter ? `:${filter}` : ""}`
    let channel: RealtimeChannel | null = null

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table,
            filter: filter || undefined,
          },
          (payload) => {
            try {
              if (payload.eventType === "INSERT" && onInsert) {
                onInsert(payload.new as T)
              } else if (payload.eventType === "UPDATE" && onUpdate) {
                onUpdate(payload.new as T)
              } else if (payload.eventType === "DELETE" && onDelete) {
                onDelete(payload.old as T)
              }

              // Update local state
              if (payload.eventType === "INSERT") {
                setData((prev) => [...prev, payload.new as T])
              } else if (payload.eventType === "UPDATE") {
                setData((prev) =>
                  prev.map((item: any) =>
                    item.id === (payload.new as any).id ? payload.new : item
                  )
                )
              } else if (payload.eventType === "DELETE") {
                setData((prev) =>
                  prev.filter((item: any) => item.id !== (payload.old as any).id)
                )
              }
            } catch (err) {
              console.error(`[REALTIME] Error handling ${payload.eventType}:`, err)
              setError(err as Error)
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === "SUBSCRIBED")
          if (status === "CHANNEL_ERROR") {
            setError(new Error("Failed to subscribe to real-time updates"))
          }
        })
    } catch (err) {
      console.error("[REALTIME] Failed to create subscription:", err)
      setError(err as Error)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
        setIsConnected(false)
      }
    }
  }, [table, filter, event, enabled, supabase])

  return { data, isConnected, error }
}

/**
 * Hook for real-time updates to a single record
 */
export function useRealtimeRecord<T = any>(
  table: string,
  recordId: string | null,
  options: {
    enabled?: boolean
    onUpdate?: (payload: T) => void
  } = {}
) {
  const [record, setRecord] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient()

  const { enabled = true, onUpdate } = options

  useEffect(() => {
    if (!enabled || !recordId) return

    const channelName = `realtime:${table}:${recordId}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: `id=eq.${recordId}`,
        },
        (payload) => {
          const updated = payload.new as T
          setRecord(updated)
          if (onUpdate) {
            onUpdate(updated)
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, recordId, enabled, supabase, onUpdate])

  return { record, isConnected }
}

/**
 * Hook for real-time notifications
 * Note: Requires notifications table in database
 */
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  // Load existing notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50)

        if (error) {
          // Table might not exist, that's okay
          console.log("[NOTIFICATIONS] Table not found or error:", error.message)
          return
        }

        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter((n: any) => !n.read).length)
        }
      } catch (error) {
        // Silently fail if notifications table doesn't exist
        console.log("[NOTIFICATIONS] Failed to load:", error)
      }
    }

    loadNotifications()
  }, [supabase])

  // Subscribe to real-time updates
  useEffect(() => {
    try {
      const channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
          },
          (payload) => {
            const notification = payload.new
            setNotifications((prev) => [notification, ...prev])
            setUnreadCount((prev) => prev + 1)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (error) {
      // Silently fail if real-time is not available
      console.log("[NOTIFICATIONS] Real-time not available:", error)
    }
  }, [supabase])

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Failed to mark as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)

      if (!error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Failed to mark all as read:", error)
    }
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}

