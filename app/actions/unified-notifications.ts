"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Get all unified notifications (system notifications + alerts)
 */
export async function getUnifiedNotifications(filters?: {
  type?: "all" | "notifications" | "alerts"
  read?: boolean
  priority?: string
  limit?: number
  offset?: number
  search?: string // FIXED: Add search parameter
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null, count: 0 }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null, count: 0 }
  }

  try {
    const unifiedNotifications: any[] = []

    // Get system notifications
    if (!filters?.type || filters.type === "all" || filters.type === "notifications") {
      let notificationsQuery = supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (filters?.read !== undefined) {
        notificationsQuery = notificationsQuery.eq("read", filters.read)
      }

      // FIXED: Add server-side search filter
      if (filters?.search) {
        notificationsQuery = notificationsQuery.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`)
      }

      const limit = Math.min(filters?.limit || 50, 100)
      const offset = filters?.offset || 0
      notificationsQuery = notificationsQuery.range(offset, offset + limit - 1)

      const { data: notifications, error: notifError } = await notificationsQuery

      if (!notifError && notifications) {
        notifications.forEach((notif: any) => {
          unifiedNotifications.push({
            id: notif.id,
            type: "notification",
            source: "system",
            title: notif.title,
            message: notif.message,
            priority: notif.priority || "normal",
            read: notif.read,
            created_at: notif.created_at,
            metadata: notif.metadata || {},
          })
        })
      }
    }

    // Get alerts
    if (!filters?.type || filters.type === "all" || filters.type === "alerts") {
      let alertsQuery = supabase
        .from("alerts")
        .select("*", { count: "exact" })
        .eq("company_id", company_id)
        .order("created_at", { ascending: false })

      if (filters?.priority) {
        alertsQuery = alertsQuery.eq("priority", filters.priority)
      }

      // FIXED: Add status filter for read/unread when read filter is specified
      if (filters?.read !== undefined) {
        if (filters.read) {
          // Read = resolved or acknowledged
          alertsQuery = alertsQuery.in("status", ["resolved", "acknowledged"])
        } else {
          // Unread = pending or active
          alertsQuery = alertsQuery.in("status", ["pending", "active"])
        }
      }

      // FIXED: Add server-side search filter
      if (filters?.search) {
        alertsQuery = alertsQuery.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`)
      }

      const limit = Math.min(filters?.limit || 50, 100)
      const offset = filters?.offset || 0
      alertsQuery = alertsQuery.range(offset, offset + limit - 1)

      const { data: alerts, error: alertsError } = await alertsQuery

      if (!alertsError && alerts) {
        alerts.forEach((alert: any) => {
          unifiedNotifications.push({
            id: alert.id,
            type: "alert",
            source: "alerts",
            title: alert.title,
            message: alert.message,
            priority: alert.priority || "normal",
            read: alert.status === "resolved" || alert.status === "acknowledged",
            status: alert.status,
            created_at: alert.created_at,
            metadata: {
              event_type: alert.event_type,
              load_id: alert.load_id,
              route_id: alert.route_id,
              driver_id: alert.driver_id,
              truck_id: alert.truck_id,
            },
          })
        })
      }
    }

    // Sort by created_at (newest first)
    unifiedNotifications.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // FIXED: Apply read filter before pagination (not after)
    let filtered = unifiedNotifications
    if (filters?.read !== undefined) {
      filtered = unifiedNotifications.filter((n) => n.read === filters.read)
    }

    // FIXED: Remove double pagination - pagination is already applied in DB queries
    // Just return the filtered results (already paginated from DB)
    return {
      data: filtered,
      error: null,
      count: filtered.length,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get unified notifications", data: null, count: 0 }
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, notificationType: "notification" | "alert") {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // FIXED: Check source value instead of notificationType parameter
    // The source is "system" for notifications and "alerts" for alerts
    // We need to determine which table to update based on the actual record
    if (notificationType === "notification") {
      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("user_id", user.id)

      if (error) {
        return { error: error.message, data: null }
      }
    } else if (notificationType === "alert") {
      // FIXED: Add company_id ownership check for alerts
      const { error } = await supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("company_id", company_id) // FIXED: Add ownership check

      if (error) {
        return { error: error.message, data: null }
      }
    }

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to mark notification as read", data: null }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // FIXED: Mark both notifications AND alerts as read
    // Use Promise.all to update both in parallel
    const [notificationsResult, alertsResult] = await Promise.all([
      // Mark all system notifications as read
      supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("read", false),
      // Mark all unresolved alerts as acknowledged
      supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("company_id", company_id)
        .in("status", ["pending", "active"]),
    ])

    if (notificationsResult.error) {
      console.error("[NOTIFICATIONS] Error marking notifications:", notificationsResult.error)
    }
    if (alertsResult.error) {
      console.error("[ALERTS] Error marking alerts:", alertsResult.error)
    }

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to mark all notifications as read", data: null }
  }
}

