"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { aiPriorityRank, effectiveAiPriority } from "@/lib/notifications/smart-ui"
import { toast } from "sonner"
import { useDashboardShell } from "@/components/dashboard/shell-bootstrap-provider"

type RecordWithId = {
  id?: unknown
} & Record<string, unknown>

type NotificationLike = {
  id?: string
  user_id?: string
  /** Unified feed item kind — distinct from DB event type (`event_type`). */
  itemType?: "notification" | "alert"
  event_type?: string | null
  read?: boolean
  read_at?: string
  ai_priority?: string | null
  ai_suppressed?: boolean | null
  priority?: string | null
  created_at?: string
  source?: string | null
  status?: string | null
  title?: string | null
  message?: string | null
  ai_reasoning?: string | null
  ai_cluster_id?: string | null
  /** Used by groupNotificationRows — mirrors `itemType`. */
  type?: string
} & Record<string, unknown>

type UnifiedBellRow = {
  id: string
  type: "notification" | "alert"
  source: "system" | "alerts"
  event_type: string | null
  title: string | null | undefined
  message: string | null | undefined
  priority: string
  read: boolean
  created_at: string
  status?: string | null
  ai_priority: string | null
  ai_cluster_id: string | null
  ai_reasoning: string | null
  ai_suppressed: boolean
  event_source: string
  legacy_priority: string
}

function mapUnifiedToBellRow(row: UnifiedBellRow): NotificationLike {
  return {
    id: row.id,
    itemType: row.type,
    type: row.type,
    event_type: row.event_type,
    title: row.title,
    message: row.message,
    read: row.read,
    created_at: row.created_at,
    priority: row.legacy_priority || row.priority,
    ai_priority: row.ai_priority,
    ai_reasoning: row.ai_reasoning,
    ai_cluster_id: row.ai_cluster_id,
    ai_suppressed: row.ai_suppressed,
    source: row.source === "alerts" ? "alerts" : row.event_source,
    status: row.status,
  }
}

function sortNotificationsClient(list: NotificationLike[], smartUi: boolean): NotificationLike[] {
  const copy = [...list]
  if (!smartUi) {
    return copy.sort(
      (a, b) =>
        new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
    )
  }
  return copy.sort((a, b) => {
    const diff =
      aiPriorityRank(
        effectiveAiPriority(
          typeof a.ai_priority === "string" ? a.ai_priority : null,
          typeof a.priority === "string" ? a.priority : null,
        ),
      ) -
      aiPriorityRank(
        effectiveAiPriority(
          typeof b.ai_priority === "string" ? b.ai_priority : null,
          typeof b.priority === "string" ? b.priority : null,
        ),
      )
    if (diff !== 0) return -diff
    return new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime()
  })
}

/**
 * Hook for real-time subscriptions to Supabase tables
 * Automatically handles connection, reconnection, and cleanup
 */
export function useRealtimeSubscription<T extends RecordWithId = RecordWithId>(
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
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
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
                const newRow = payload.new as RecordWithId
                setData((prev) =>
                  prev.map((item) =>
                    item.id === newRow.id ? (payload.new as T) : item
                  )
                )
              } else if (payload.eventType === "DELETE") {
                const oldRow = payload.old as RecordWithId
                setData((prev) =>
                  prev.filter((item) => item.id !== oldRow.id)
                )
              }
            } catch (err) {
              console.error(`[REALTIME] Error handling ${payload.eventType}:`, err)
              setError(err as Error)
            }
          }
        )
        .subscribe((status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
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
export function useRealtimeRecord<T = unknown>(
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updated = payload.new as T
          setRecord(updated)
          if (onUpdate) {
            onUpdate(updated)
          }
        }
      )
      .subscribe((status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, recordId, enabled, onUpdate]) // FIXED: Remove supabase from deps

  return { record, isConnected }
}

/**
 * Hook for header bell notifications (unified system notifications + fleet alerts).
 */
export function useRealtimeNotifications() {
  const shell = useDashboardShell()
  const [notifications, setNotifications] = useState<NotificationLike[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadCountDegraded, setUnreadCountDegraded] = useState(false)
  const [loadDegraded, setLoadDegraded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [smartUi, setSmartUi] = useState(false)
  const smartUiRef = useRef(false)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    smartUiRef.current = smartUi
  }, [smartUi])

  const refreshUnreadCount = useCallback(async () => {
    const { getUnreadNotificationCount } = await import("@/app/actions/notifications")
    const countResult = await getUnreadNotificationCount()
    if (countResult.degraded || countResult.error) {
      setUnreadCountDegraded(true)
      console.error("[NOTIFICATIONS] Unread count degraded:", countResult.error)
      return
    }
    if (countResult.data) {
      setUnreadCountDegraded(false)
      setUnreadCount(countResult.data.total)
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      const { getUnifiedNotifications } = await import("@/app/actions/unified-notifications")
      const result = await getUnifiedNotifications({ limit: 50, type: "all" })

      if (result.degraded || result.error) {
        setLoadDegraded(true)
        setLoadError(result.error ?? "Couldn't load notifications")
        console.error("[NOTIFICATIONS] Unified feed degraded:", result.error, result.partialErrors)
        toast.error("Couldn't load notifications", {
          description: result.error ?? undefined,
        })

        if (result.data) {
          const rows = result.data.map((row) => mapUnifiedToBellRow(row as UnifiedBellRow))
          setNotifications(sortNotificationsClient(rows, smartUiRef.current))
          // Badge from loaded rows only — do not trust a separate COUNT when list queries failed.
          setUnreadCount(rows.filter((n) => !n.read).length)
          setUnreadCountDegraded(true)
        } else {
          setNotifications([])
          setUnreadCount(0)
          setUnreadCountDegraded(true)
        }
        return
      }

      setLoadDegraded(false)
      setLoadError(null)

      if (result.data) {
        const rows = result.data.map((row) => mapUnifiedToBellRow(row as UnifiedBellRow))
        setNotifications(sortNotificationsClient(rows, smartUiRef.current))
      } else {
        setNotifications([])
      }

      await refreshUnreadCount()
    } catch (error) {
      setLoadDegraded(true)
      setLoadError(error instanceof Error ? error.message : "Couldn't load notifications")
      setUnreadCountDegraded(true)
      console.error("[NOTIFICATIONS] Failed to refresh unified feed:", error)
      toast.error("Couldn't load notifications")
    }
  }, [refreshUnreadCount])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => {
      void refreshNotifications()
    }, 400)
  }, [refreshNotifications])

  // Initial load: badge only from shell bootstrap; full feed when popover opens.
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        if (shell.data) {
          setSmartUi(shell.data.notifications.smartUi)
          setUnreadCount(shell.data.notifications.unreadCount)
          setUnreadCountDegraded(shell.data.notifications.unreadCountDegraded)
          return
        }

        const display = await import("@/app/actions/user-preferences").then((m) =>
          m.getNotificationSmartDisplayState(),
        )
        const ui = display.data?.smartUi ?? false
        setSmartUi(ui)

        await refreshUnreadCount()
      } catch (error) {
        console.log("[NOTIFICATIONS] Failed to load:", error)
      }
    }

    if (!shell.loading) {
      void loadNotifications()
    }
  }, [supabase, refreshUnreadCount, shell.data, shell.loading])

  // Realtime for in-app notifications; alerts are refreshed via scheduleRefresh (no realtime publication).
  useEffect(() => {
    if (!userId) return

    try {
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            scheduleRefresh()
          },
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (error) {
      console.log("[NOTIFICATIONS] Real-time not available:", error)
    }
  }, [supabase, userId, scheduleRefresh])

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  const markAsRead = async (notificationId: string, itemType: "notification" | "alert" = "notification") => {
    try {
      const { markNotificationAsRead } = await import("@/app/actions/unified-notifications")
      const result = await markNotificationAsRead(notificationId, itemType)
      if (!result.error) {
        let wasUnread = false
        setNotifications((prev) =>
          prev.map((n) => {
            if (n.id === notificationId && !n.read) {
              wasUnread = true
              return { ...n, read: true, read_at: new Date().toISOString() }
            }
            return n
          }),
        )
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1))
        }
      } else {
        console.error("[NOTIFICATIONS] Error marking as read:", result.error)
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Failed to mark as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const { markAllNotificationsAsRead } = await import("@/app/actions/unified-notifications")
      const result = await markAllNotificationsAsRead()
      if (!result.error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })))
        setUnreadCount(0)
      } else {
        console.error("[NOTIFICATIONS] Error marking all as read:", result.error)
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Failed to mark all as read:", error)
    }
  }

  return {
    notifications,
    unreadCount,
    unreadCountDegraded,
    loadDegraded,
    loadError,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    smartUi,
  }
}

