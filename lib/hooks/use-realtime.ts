"use client"

import { useEffect, useState, useMemo } from "react"
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
  // FIXED: Memoize supabase client to avoid dependency churn
  const supabase = useMemo(() => createClient(), [])

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
  }, [table, filter, event, enabled]) // FIXED: Remove supabase from deps

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
  // FIXED: Memoize supabase client
  const supabase = useMemo(() => createClient(), [])

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
  }, [table, recordId, enabled, onUpdate]) // FIXED: Remove supabase from deps

  return { record, isConnected }
}

/**
 * Hook for real-time notifications
 * Note: Requires notifications table in database
 */
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  // FIXED: Memoize supabase client to avoid dependency issues
  const supabase = useMemo(() => createClient(), [])

  // Load existing notifications and get user ID
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        // MEDIUM FIX 13: Use efficient COUNT query instead of fetching all records
        const { getUnreadNotificationCount } = await import("@/app/actions/notifications")
        const countResult = await getUnreadNotificationCount()
        if (countResult.data) {
          setUnreadCount(countResult.data.total)
        }

        // Still fetch notifications for display (limited to 50)
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
        }
      } catch (error) {
        // Silently fail if notifications table doesn't exist
        console.log("[NOTIFICATIONS] Failed to load:", error)
      }
    }

    loadNotifications()
  }, [supabase])

  // Subscribe to real-time updates
  // FIXED: Add user_id filter to prevent receiving all users' notifications
  useEffect(() => {
    if (!userId) return

    try {
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`, // FIXED: Filter by user_id
          },
          (payload) => {
            const notification = payload.new
            // Only add if it's for this user
            if (notification.user_id === userId) {
              setNotifications((prev) => [notification, ...prev])
              // MEDIUM FIX 13: Update count efficiently
              if (!notification.read) {
                setUnreadCount((prev) => prev + 1)
              }
            }
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
  }, [supabase, userId]) // FIXED: Only depend on userId, not supabase

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => {
            if (n.id === notificationId && !n.read) {
              // MEDIUM FIX 13: Only decrement if it was unread
              setUnreadCount((prev) => Math.max(0, prev - 1))
              return { ...n, read: true, read_at: new Date().toISOString() }
            }
            return n
          })
        )
      } else {
        console.error("[NOTIFICATIONS] Error marking as read:", error)
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
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("read", false)

      if (!error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })))
        setUnreadCount(0)
      } else {
        console.error("[NOTIFICATIONS] Error marking all as read:", error)
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

