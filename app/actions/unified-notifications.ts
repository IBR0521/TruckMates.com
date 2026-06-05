"use server"

import { safeDbError } from "@/lib/utils/error"
import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { resolveDriverIdForSessionUser } from "@/lib/auth/resolve-driver-for-session"
import { mapLegacyRole } from "@/lib/roles"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { aiPriorityRank, effectiveAiPriority } from "@/lib/notifications/smart-ui"
/** `public.notifications` — supabase/notifications_table.sql */
const NOTIFICATIONS_LIST_SELECT =
  "id, user_id, company_id, type, title, message, priority, metadata, read, read_at, created_at, updated_at, ai_priority, ai_cluster_id, ai_reasoning, ai_suppressed, source"

/** `public.alerts` — supabase/trucklogics_features_schema.sql */
const ALERTS_LIST_SELECT =
  "id, company_id, alert_rule_id, title, message, event_type, priority, status, load_id, route_id, driver_id, truck_id, metadata, escalated, escalation_level, escalated_at, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at"

type NotificationRow = {
  id: string
  type?: string | null
  title?: string | null
  message?: string | null
  priority?: string | null
  read?: boolean | null
  created_at: string
  metadata?: Record<string, unknown> | null
  ai_priority?: string | null
  ai_cluster_id?: string | null
  ai_reasoning?: string | null
  ai_suppressed?: boolean | null
  source?: string | null
}

type AlertRow = {
  id: string
  title?: string | null
  message?: string | null
  priority?: string | null
  status?: string | null
  created_at: string
  event_type?: string | null
  load_id?: string | null
  route_id?: string | null
  driver_id?: string | null
  truck_id?: string | null
}

/**
 * Get all unified notifications (system notifications + alerts)
 */
function parseEventSource(raw: string | null | undefined): "event" | "ai_proactive" | "ai_cluster_parent" {
  if (raw === "ai_proactive" || raw === "ai_cluster_parent") return raw
  return "event"
}

export async function getUnifiedNotifications(filters?: {
  type?: "all" | "notifications" | "alerts"
  read?: boolean
  priority?: string
  limit?: number
  offset?: number
  search?: string // FIXED: Add search parameter
  /** When smart UI is on, omit suppressed unless true. */
  includeSuppressed?: boolean
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null, count: 0, meta: null }
  }

  try {
    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

    const [{ data: companyRow }, { data: userRow }] = await Promise.all([
      ctx.companyId
        ? supabase.from("companies").select("subscription_tier").eq("id", ctx.companyId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("users").select("notification_smart_mode").eq("id", ctx.userId ?? "").maybeSingle(),
    ])

    const tier: PlanTier = normalizePlanTier(
      (companyRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? undefined,
    )
    const planAllowsSmart = hasFeatureAccess(tier, "ai_smart_notifications")
    const userSmart = Boolean((userRow as { notification_smart_mode?: boolean } | null)?.notification_smart_mode)
    const smartUi = planAllowsSmart && userSmart

    let suppressedCount = 0
    if (
      smartUi &&
      ctx.userId &&
      !filters?.includeSuppressed &&
      (!filters?.type || filters.type === "all" || filters.type === "notifications")
    ) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("ai_suppressed", true)
      suppressedCount = count ?? 0
    }

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

    const unifiedNotifications: Array<{
      id: string
      type: "notification" | "alert"
      source: "system" | "alerts"
      /** DB event type, e.g. load_update or fault_code (distinct from unified `type`). */
      event_type: string | null
      title: string | null | undefined
      message: string | null | undefined
      priority: string
      read: boolean
      created_at: string
      status?: string | null
      metadata: Record<string, unknown>
      ai_priority: string | null
      ai_cluster_id: string | null
      ai_reasoning: string | null
      ai_suppressed: boolean
      event_source: "event" | "ai_proactive" | "ai_cluster_parent"
      /** Raw DB `notifications.priority` / `alerts.priority` for filtering and AI fallback. */
      legacy_priority: string
    }> = []

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
        notifications.forEach((notif: NotificationRow) => {
          const legacyP = notif.priority || "normal"
          const displayPriority = smartUi ? effectiveAiPriority(notif.ai_priority, legacyP) : legacyP
          const suppressed = Boolean(notif.ai_suppressed)
          if (smartUi && suppressed && !filters?.includeSuppressed) {
            return
          }
          unifiedNotifications.push({
            id: notif.id,
            type: "notification",
            source: "system",
            event_type: notif.type ?? null,
            title: notif.title,
            message: notif.message,
            priority: displayPriority,
            read: Boolean(notif.read),
            created_at: notif.created_at,
            metadata: notif.metadata || {},
            ai_priority: notif.ai_priority ?? null,
            ai_cluster_id: notif.ai_cluster_id ?? null,
            ai_reasoning: notif.ai_reasoning ?? null,
            ai_suppressed: suppressed,
            event_source: parseEventSource(notif.source),
            legacy_priority: legacyP,
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
        let alertRows = alerts as AlertRow[]
        if (role === "driver" && filters?.search) {
          const q = filters.search.toLowerCase()
          alertRows = alertRows.filter(
            (a) =>
              (a.title && String(a.title).toLowerCase().includes(q)) ||
              (a.message && String(a.message).toLowerCase().includes(q))
          )
        }
        alertRows.forEach((alert: AlertRow) => {
          const legacyA = alert.priority || "normal"
          unifiedNotifications.push({
            id: alert.id,
            type: "alert",
            source: "alerts",
            event_type: alert.event_type ?? null,
            title: alert.title,
            message: alert.message,
            priority: legacyA,
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
            ai_priority: null,
            ai_cluster_id: null,
            ai_reasoning: null,
            ai_suppressed: false,
            event_source: "event",
            legacy_priority: legacyA,
          })
        })
      }
    }
    }

    const filterP = filters?.priority
    unifiedNotifications.sort((a, b) => {
      if (smartUi) {
        const diff =
          aiPriorityRank(effectiveAiPriority(a.ai_priority, a.legacy_priority)) -
          aiPriorityRank(effectiveAiPriority(b.ai_priority, b.legacy_priority))
        if (diff !== 0) return -diff
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    let priorityFiltered = unifiedNotifications
    if (filterP && filterP !== "all") {
      priorityFiltered = unifiedNotifications.filter((n) => {
        if (n.type === "alert") {
          return n.legacy_priority === filterP
        }
        if (!smartUi) {
          return n.legacy_priority === filterP
        }
        const eff = effectiveAiPriority(n.ai_priority, n.legacy_priority)
        if (filterP === "normal") {
          return eff === "medium" || n.legacy_priority === "normal"
        }
        if (filterP === "medium" || filterP === "critical" || filterP === "high" || filterP === "low") {
          return eff === filterP
        }
        return n.legacy_priority === filterP
      })
    }

    let filtered = priorityFiltered
    if (filters?.read !== undefined) {
      filtered = priorityFiltered.filter((n) => n.read === filters.read)
    }

    return {
      data: filtered,
      error: null,
      count: filtered.length,
      meta: {
        smartUi,
        planAllowsSmart,
        userSmart,
        suppressedCount,
      },
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get unified notifications"), data: null, count: 0, meta: null }
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
        return { error: safeDbError(error), data: null }
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
        return { error: safeDbError(error), data: null }
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

