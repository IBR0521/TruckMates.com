"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { resolveDriverIdForSessionUser } from "@/lib/auth/resolve-driver-for-session"
import { mapLegacyRole } from "@/lib/roles"

/** `public.notifications` — supabase/notifications_table.sql */
const NOTIFICATIONS_LIST_SELECT =
  "id, user_id, company_id, type, title, message, priority, metadata, read, read_at, created_at, updated_at"

/** `public.alerts` — supabase/trucklogics_features_schema.sql */
const ALERTS_LIST_SELECT =
  "id, company_id, alert_rule_id, title, message, event_type, priority, status, load_id, route_id, driver_id, truck_id, metadata, escalated, escalation_level, escalated_at, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at"

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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null, count: 0 }
  }

  try {
    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

    let loadIdsForDriver: string[] = []
    if (role === "driver" && myDriverId) {
      const { data: loadRows } = await supabase
        .from("loads")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("driver_id", myDriverId)
        .limit(500)
      loadIdsForDriver = (loadRows || []).map((r: { id: string }) => String(r.id))
    }

    const unifiedNotifications: any[] = []

    // Get system notifications
    if (!filters?.type || filters.type === "all" || filters.type === "notifications") {
      let notificationsQuery = supabase
        .from("notifications")
        .select(NOTIFICATIONS_LIST_SELECT, { count: "exact" })
        .eq("user_id", ctx.userId ?? "")
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

    // Get alerts (fleet: whole company; driver: targeted to them or their assigned loads only)
    if (!filters?.type || filters.type === "all" || filters.type === "alerts") {
      if (role === "driver" && !myDriverId) {
        // No driver profile — skip company-wide alerts
      } else {
      let alertsQuery = supabase
        .from("alerts")
        .select(ALERTS_LIST_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (role === "driver" && myDriverId) {
        if (loadIdsForDriver.length === 0) {
          alertsQuery = alertsQuery.eq("driver_id", myDriverId)
        } else {
          const inList = loadIdsForDriver.join(",")
          alertsQuery = alertsQuery.or(`driver_id.eq.${myDriverId},load_id.in.(${inList})`)
        }
      }

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

      // Search: fleet can use OR on title/message. Drivers already use OR for driver/load scope — filter search in memory.
      if (filters?.search && role !== "driver") {
        alertsQuery = alertsQuery.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`)
      }

      const limit = Math.min(filters?.limit || 50, 100)
      const offset = filters?.offset || 0
      alertsQuery = alertsQuery.range(offset, offset + limit - 1)

      const { data: alerts, error: alertsError } = await alertsQuery

      if (!alertsError && alerts) {
        let alertRows = alerts as any[]
        if (role === "driver" && filters?.search) {
          const q = filters.search.toLowerCase()
          alertRows = alertRows.filter(
            (a) =>
              (a.title && String(a.title).toLowerCase().includes(q)) ||
              (a.message && String(a.message).toLowerCase().includes(q))
          )
        }
        alertRows.forEach((alert: any) => {
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
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get unified notifications"), data: null, count: 0 }
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, notificationType: "notification" | "alert") {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
        .eq("user_id", ctx.userId ?? "")

      if (error) {
        return { error: error.message, data: null }
      }
    } else if (notificationType === "alert") {
      const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
      const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

      if (role === "driver") {
        if (!myDriverId) {
          return { error: "Not found", data: null }
        }
        const { data: alertRow } = await supabase
          .from("alerts")
          .select("driver_id, load_id")
          .eq("id", notificationId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        if (!alertRow) {
          return { error: "Not found", data: null }
        }
        const { data: loadRows } = await supabase
          .from("loads")
          .select("id")
          .eq("company_id", ctx.companyId)
          .eq("driver_id", myDriverId)
          .limit(500)
        const loadIds = new Set((loadRows || []).map((r: { id: string }) => String(r.id)))
        const ok =
          String(alertRow.driver_id) === myDriverId ||
          (!!alertRow.load_id && loadIds.has(String(alertRow.load_id)))
        if (!ok) {
          return { error: "Not found", data: null }
        }
      }

      const { error } = await supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("company_id", ctx.companyId)

      if (error) {
        return { error: error.message, data: null }
      }
    }

    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to mark notification as read"), data: null }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

    let alertsUpdate = supabase
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.companyId)
      .in("status", ["pending", "active"])

    if (role === "driver" && myDriverId) {
      const { data: loadRows } = await supabase
        .from("loads")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("driver_id", myDriverId)
        .limit(500)
      const loadIds = (loadRows || []).map((r: { id: string }) => String(r.id))
      if (loadIds.length === 0) {
        alertsUpdate = alertsUpdate.eq("driver_id", myDriverId)
      } else {
        const inList = loadIds.join(",")
        alertsUpdate = alertsUpdate.or(`driver_id.eq.${myDriverId},load_id.in.(${inList})`)
      }
    }

    const alertsPromise =
      role === "driver" && !myDriverId
        ? Promise.resolve({ error: null })
        : alertsUpdate

    const [notificationsResult, alertsResult] = await Promise.all([
      supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", ctx.userId ?? "")
        .eq("read", false),
      alertsPromise,
    ])

    if (notificationsResult.error) {
      Sentry.captureException(notificationsResult.error)
    }
    if (alertsResult.error) {
      Sentry.captureException(alertsResult.error)
    }

    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to mark all notifications as read"), data: null }
  }
}

