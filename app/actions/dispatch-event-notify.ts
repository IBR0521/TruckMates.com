"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/app/actions/notifications"
import {
  DISPATCH_NOTIFICATION_SETTINGS_SELECT,
  isDispatchNotifyEventEnabled,
  type DispatchNotificationSettings,
} from "@/lib/dispatch-notify-settings"
import { batchOperations } from "@/lib/performance"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager", "dispatcher"])
const DEDUPE_HOURS = 12

async function getDispatchSettings(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<DispatchNotificationSettings | null> {
  const { data } = await admin
    .from("company_settings")
    .select(DISPATCH_NOTIFICATION_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()
  return (data as DispatchNotificationSettings | null) ?? null
}

async function getManagerUserIds(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<string[]> {
  const { data: managers } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager", "dispatcher"])

  return (managers || [])
    .filter((u: { role?: string | null }) => MANAGER_ROLES.has(String(u.role || "")))
    .map((u: { id: string }) => u.id)
}

async function wasRecentlyNotified(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  event: string,
  resourceId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since)
    .filter("metadata->>event", "eq", event)
    .filter("metadata->>resource_id", "eq", resourceId)
  return (count ?? 0) > 0
}

async function notifyManagers(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  event: string,
  resourceId: string,
  payload: {
    title: string
    message: string
    shipmentNumber?: string
    priority?: string
  },
): Promise<number> {
  if (await wasRecentlyNotified(admin, companyId, event, resourceId)) return 0

  const managerIds = await getManagerUserIds(admin, companyId)
  if (managerIds.length === 0) return 0

  for (const userId of managerIds) {
    await sendNotification(userId, "load_update", {
      company_id: companyId,
      shipmentNumber: payload.shipmentNumber,
      title: payload.title,
      message: payload.message,
      priority: payload.priority,
      event,
      resource_id: resourceId,
    })
  }
  return 1
}

export async function notifyInstantEmergencyCheckCall(params: {
  companyId: string
  checkCallId: string
  loadId?: string | null
  notes?: string | null
}): Promise<number> {
  const admin = createAdminClient()
  const settings = await getDispatchSettings(admin, params.companyId)
  if (settings?.auto_notify_on_emergency === false) {
    return 0
  }

  return notifyManagers(admin, params.companyId, "emergency_check_call", params.checkCallId, {
    title: "Emergency check call",
    message: params.notes || "An emergency check call was logged and needs immediate attention.",
    priority: "critical",
  })
}

type DeadlineProcessOutcome = "alert_fired" | "stale_no_alert"

export async function processMissedCheckCallDeadline(checkCallId: string): Promise<{
  outcome: DeadlineProcessOutcome
  notified: number
  marked: number
}> {
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from("check_calls")
    .select("id, company_id, load_id, driver_id, call_type, scheduled_time, status")
    .eq("id", checkCallId)
    .maybeSingle()

  if (error || !row) {
    return { outcome: "stale_no_alert", notified: 0, marked: 0 }
  }

  const companyId = String(row.company_id || "")
  if (!companyId || String(row.status || "") !== "pending") {
    return { outcome: "stale_no_alert", notified: 0, marked: 0 }
  }

  const settings = await getDispatchSettings(admin, companyId)
  if (!isDispatchNotifyEventEnabled(settings, "check_call_missed")) {
    return { outcome: "stale_no_alert", notified: 0, marked: 0 }
  }

  const timeoutMinutes = Math.max(5, Number(settings?.check_call_timeout_minutes) || 30)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  if (String(row.scheduled_time || "") >= cutoff) {
    return { outcome: "stale_no_alert", notified: 0, marked: 0 }
  }

  let marked = 0
  if (settings?.auto_escalate_missed_calls !== false) {
    await admin.from("check_calls").update({ status: "missed" }).eq("id", checkCallId)
    marked = 1
  }

  const { data: load } = row.load_id
    ? await admin.from("loads").select("shipment_number").eq("id", row.load_id).maybeSingle()
    : { data: null }

  const label = load?.shipment_number || row.load_id || checkCallId
  const notified = await notifyManagers(admin, companyId, "check_call_missed", checkCallId, {
    title: `Missed check call: ${label}`,
    message: `Scheduled ${String(row.call_type || "check")} call was not completed on time.`,
    shipmentNumber: label,
    priority: "high",
  })

  return { outcome: notified > 0 ? "alert_fired" : "stale_no_alert", notified, marked }
}

export async function processDriverLateDeadline(loadId: string): Promise<{
  outcome: DeadlineProcessOutcome
  notified: number
  stillLate: boolean
}> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: load, error } = await admin
    .from("loads")
    .select("id, company_id, shipment_number, origin, load_date, status")
    .eq("id", loadId)
    .maybeSingle()

  if (error || !load) {
    return { outcome: "stale_no_alert", notified: 0, stillLate: false }
  }

  const companyId = String(load.company_id || "")
  const stillLate =
    !!companyId &&
    String(load.status || "") === "scheduled" &&
    !!load.load_date &&
    String(load.load_date) < now

  if (!stillLate) {
    return { outcome: "stale_no_alert", notified: 0, stillLate: false }
  }

  const settings = await getDispatchSettings(admin, companyId)
  if (!isDispatchNotifyEventEnabled(settings, "driver_late")) {
    return { outcome: "stale_no_alert", notified: 0, stillLate: true }
  }

  const label = load.shipment_number || loadId
  const notified = await notifyManagers(admin, companyId, "driver_late", loadId, {
    title: `Driver late: ${label}`,
    message: `Load ${label} is still scheduled past pickup time (${load.origin || "pickup"}).`,
    shipmentNumber: label,
    priority: "high",
  })

  return {
    outcome: notified > 0 ? "alert_fired" : "stale_no_alert",
    notified,
    stillLate: true,
  }
}

export async function processEmergencyEscalationDeadline(checkCallId: string): Promise<{
  outcome: DeadlineProcessOutcome
  notified: number
}> {
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from("check_calls")
    .select("id, company_id, load_id, notes, scheduled_time, created_at, call_type, status")
    .eq("id", checkCallId)
    .maybeSingle()

  if (error || !row) {
    return { outcome: "stale_no_alert", notified: 0 }
  }

  const companyId = String(row.company_id || "")
  if (
    !companyId ||
    String(row.call_type || "").toLowerCase() !== "emergency" ||
    String(row.status || "") !== "pending"
  ) {
    return { outcome: "stale_no_alert", notified: 0 }
  }

  const settings = await getDispatchSettings(admin, companyId)
  if (settings?.auto_notify_on_emergency === false) {
    return { outcome: "stale_no_alert", notified: 0 }
  }

  const escalationMinutes = Math.max(5, Number(settings?.emergency_escalation_minutes) || 15)
  const cutoff = new Date(Date.now() - escalationMinutes * 60 * 1000).toISOString()
  if (String(row.created_at || "") >= cutoff) {
    return { outcome: "stale_no_alert", notified: 0 }
  }

  const notified = await notifyManagers(admin, companyId, "emergency_escalation", checkCallId, {
    title: "Emergency check call escalation",
    message: row.notes || "Emergency check call is still unresolved.",
    priority: "critical",
  })

  return { outcome: notified > 0 ? "alert_fired" : "stale_no_alert", notified }
}

export async function scanMissedCheckCallsForCompany(companyId: string): Promise<{
  data: { notified: number; marked: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const settings = await getDispatchSettings(admin, companyId)
  if (!isDispatchNotifyEventEnabled(settings, "check_call_missed")) {
    return { data: { notified: 0, marked: 0 }, error: null }
  }

  const timeoutMinutes = Math.max(5, Number(settings?.check_call_timeout_minutes) || 30)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()

  const { data: overdue, error } = await admin
    .from("check_calls")
    .select("id, load_id, driver_id, call_type, scheduled_time, status")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .lt("scheduled_time", cutoff)

  if (error) {
    return { data: null, error: error.message || "Failed to scan check calls" }
  }

  let notified = 0
  let marked = 0

  for (const row of overdue || []) {
    const callId = String(row.id || "")
    if (!callId) continue

    if (settings?.auto_escalate_missed_calls !== false) {
      await admin.from("check_calls").update({ status: "missed" }).eq("id", callId)
      marked += 1
    }

    const { data: load } = row.load_id
      ? await admin
          .from("loads")
          .select("shipment_number")
          .eq("id", row.load_id)
          .maybeSingle()
      : { data: null }

    const label = load?.shipment_number || row.load_id || callId
    notified += await notifyManagers(admin, companyId, "check_call_missed", callId, {
      title: `Missed check call: ${label}`,
      message: `Scheduled ${String(row.call_type || "check")} call was not completed on time.`,
      shipmentNumber: label,
      priority: "high",
    })
  }

  return { data: { notified, marked }, error: null }
}

export async function scanDriverLateForCompany(companyId: string): Promise<{
  data: { notified: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const settings = await getDispatchSettings(admin, companyId)
  if (!isDispatchNotifyEventEnabled(settings, "driver_late")) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const now = new Date().toISOString()
  const { data: loads, error } = await admin
    .from("loads")
    .select("id, shipment_number, origin, load_date, status")
    .eq("company_id", companyId)
    .eq("status", "scheduled")
    .not("load_date", "is", null)
    .lt("load_date", now)

  if (error) {
    return { data: null, error: error.message || "Failed to scan loads" }
  }

  let notified = 0
  for (const load of loads || []) {
    const loadId = String(load.id || "")
    if (!loadId) continue
    const label = load.shipment_number || loadId
    notified += await notifyManagers(admin, companyId, "driver_late", loadId, {
      title: `Driver late: ${label}`,
      message: `Load ${label} is still scheduled past pickup time (${load.origin || "pickup"}).`,
      shipmentNumber: label,
      priority: "high",
    })
  }

  return { data: { notified, scanned: (loads || []).length }, error: null }
}

export async function scanRouteDeviationsForCompany(companyId: string): Promise<{
  data: { notified: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const settings = await getDispatchSettings(admin, companyId)
  if (!isDispatchNotifyEventEnabled(settings, "route_deviation")) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const maxMiles = Math.max(1, Number(settings?.max_route_deviation_miles) || 10)
  const maxMeters = maxMiles * 1609.34

  const { data: routes, error } = await admin
    .from("routes")
    .select("id, name, route_deviation_meters, status")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "in_progress"])
    .not("route_deviation_meters", "is", null)
    .gt("route_deviation_meters", maxMeters)

  if (error) {
    return { data: null, error: error.message || "Failed to scan routes" }
  }

  let notified = 0
  for (const route of routes || []) {
    const routeId = String(route.id || "")
    if (!routeId) continue
    const deviationMiles = Math.round((Number(route.route_deviation_meters) / 1609.34) * 10) / 10
    notified += await notifyManagers(admin, companyId, "route_deviation", routeId, {
      title: `Route deviation: ${route.name || routeId}`,
      message: `Route ${route.name || routeId} is ${deviationMiles} mi off plan (limit ${maxMiles} mi).`,
      priority: deviationMiles > maxMiles * 2 ? "high" : "medium",
    })
  }

  return { data: { notified, scanned: (routes || []).length }, error: null }
}

export async function scanEmergencyEscalationsForCompany(companyId: string): Promise<{
  data: { notified: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const settings = await getDispatchSettings(admin, companyId)
  if (settings?.auto_notify_on_emergency === false) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const escalationMinutes = Math.max(5, Number(settings?.emergency_escalation_minutes) || 15)
  const cutoff = new Date(Date.now() - escalationMinutes * 60 * 1000).toISOString()

  const { data: emergencies, error } = await admin
    .from("check_calls")
    .select("id, load_id, notes, scheduled_time, created_at")
    .eq("company_id", companyId)
    .eq("call_type", "emergency")
    .eq("status", "pending")
    .lt("created_at", cutoff)

  if (error) {
    return { data: null, error: error.message || "Failed to scan emergency check calls" }
  }

  let notified = 0
  for (const row of emergencies || []) {
    const callId = String(row.id || "")
    if (!callId) continue
    notified += await notifyManagers(admin, companyId, "emergency_escalation", callId, {
      title: "Emergency check call escalation",
      message: row.notes || "Emergency check call is still unresolved.",
      priority: "critical",
    })
  }

  return { data: { notified, scanned: (emergencies || []).length }, error: null }
}

export async function scanAllDispatchEvents(): Promise<{
  data: {
    companies: number
    route_deviation: number
  } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: companies, error } = await admin.from("companies").select("id").limit(5000)
  if (error) {
    return { data: null, error: error.message || "Failed to list companies" }
  }

  const companyIds = (companies || [])
    .map((row) => String(row.id || ""))
    .filter(Boolean)

  const results = await batchOperations(companyIds, 6, async (companyId) => {
    const deviation = await scanRouteDeviationsForCompany(companyId)
    return {
      deviation: deviation.data?.notified ?? 0,
    }
  })

  const routeDeviation = results.reduce((sum, r) => sum + r.deviation, 0)

  return {
    data: {
      companies: companyIds.length,
      route_deviation: routeDeviation,
    },
    error: null,
  }
}
