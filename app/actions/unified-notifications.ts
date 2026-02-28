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

    // Apply read filter if specified
    let filtered = unifiedNotifications
    if (filters?.read !== undefined) {
      filtered = unifiedNotifications.filter((n) => n.read === filters.read)
    }

    // Limit results
    const limit = filters?.limit || 50
    const paginated = filtered.slice(0, limit)

    return {
      data: paginated,
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

  try {
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
      // For alerts, we acknowledge them
      const { error } = await supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", notificationId)

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

  try {
    // Mark all system notifications as read
    await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("read", false)

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to mark all notifications as read", data: null }
  }
}

