/**
 * Side effects for telemetry-driven geofence enter/exit (load status, alerts, detention flags).
 * Separated from lib/eld/geofence-detector.ts to keep detection vs business rules distinct.
 */

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeDbError } from "@/lib/utils/error"
import { getCompanyTier } from "@/lib/plan-enforcement"
import { hasFeatureAccess } from "@/lib/plan-limits"

export type GeofenceRow = {
  id: string
  name: string
  geofence_type: string
  zone_type: string
  related_customer_id: string | null
  auto_update_load_status: boolean | null
  alert_on_entry: boolean | null
  alert_on_exit: boolean | null
  alert_on_dwell: boolean | null
  detention_enabled: boolean | null
  detention_threshold_minutes: number | null
}

export type GeofenceEventRow = {
  id: string
  company_id: string
  geofence_id: string
  truck_id: string | null
  driver_id: string | null
  load_id: string | null
  event_type: "enter" | "exit"
  occurred_at: string
  location_lat: number
  location_lng: number
}

export type TruckLite = { id: string; truck_number?: string | null }

const DWELL_ALERT_SECONDS = 2 * 60 * 60

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

async function insertCompanyAlert(params: {
  companyId: string
  title: string
  message: string
  eventType: string
  truckId: string | null
  driverId: string | null
  loadId: string | null
  metadata: Record<string, unknown>
}): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("alerts")
    .insert({
      company_id: params.companyId,
      title: params.title,
      message: params.message,
      event_type: params.eventType,
      priority: "normal",
      status: "active",
      truck_id: params.truckId,
      driver_id: params.driverId,
      load_id: params.loadId,
      metadata: params.metadata,
    })
    .select("id")
    .maybeSingle()
  if (error) {
    Sentry.captureMessage(`geofence alert insert failed: ${safeDbError(error)}`, { level: "warning" })
    return null
  }
  const id = (data as { id?: string } | null)?.id
  return typeof id === "string" ? id : null
}

export async function fetchActiveLoadForTruck(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  truckId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("loads")
    .select("id, status, customer_id, truck_id, shipment_number")
    .eq("company_id", companyId)
    .eq("truck_id", truckId)
    .in("status", ["confirmed", "scheduled", "in_transit", "pending"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return asRecord(data)
}

function geofenceAppliesToLoad(geofence: GeofenceRow, load: Record<string, unknown>): boolean {
  const gType = geofence.geofence_type
  if (gType === "pickup" || gType === "delivery" || gType === "yard" || gType === "fuel_stop" || gType === "rest_area") {
    return true
  }
  if (gType === "customer") {
    const cid = load.customer_id ? String(load.customer_id) : null
    if (!cid || !geofence.related_customer_id) return false
    return cid === geofence.related_customer_id
  }
  return geofence.related_customer_id == null
}

export async function handleGeofenceEnter(params: {
  companyId: string
  geofenceEvent: GeofenceEventRow
  geofence: GeofenceRow
  truck: TruckLite
  activeLoad: Record<string, unknown> | null
}): Promise<{ statusUpdated: boolean; notificationCreated: boolean }> {
  const admin = createAdminClient()
  const tier = await getCompanyTier(params.companyId)
  const canAutomateLoads = hasFeatureAccess(tier, "geofencing_load_automation")

  let statusUpdated = false
  let notificationCreated = false

  const load = params.activeLoad
  const truckLabel = params.truck.truck_number?.trim() || "Vehicle"

  const shouldNotifyArrival = params.geofence.alert_on_entry === true
  if (shouldNotifyArrival) {
    const alertId = await insertCompanyAlert({
      companyId: params.companyId,
      title: `${truckLabel} arrived at ${params.geofence.name}`,
      message: `Geofence “${params.geofence.name}” (${params.geofence.geofence_type}) — entry at ${new Date(params.geofenceEvent.occurred_at).toLocaleString()}.`,
      eventType: "geofence_entry",
      truckId: params.geofenceEvent.truck_id,
      driverId: params.geofenceEvent.driver_id,
      loadId: load?.id ? String(load.id) : null,
      metadata: {
        geofence_id: params.geofence.id,
        geofence_event_id: params.geofenceEvent.id,
        source: "geofence_telemetry_cron",
      },
    })
    if (alertId) {
      notificationCreated = true
      await admin
        .from("geofence_events")
        .update({ triggered_notification_id: alertId })
        .eq("id", params.geofenceEvent.id)
        .eq("company_id", params.companyId)
    }
  }

  if (!canAutomateLoads || !params.geofence.auto_update_load_status || !load || !geofenceAppliesToLoad(params.geofence, load)) {
    return { statusUpdated, notificationCreated }
  }

  const loadId = String(load.id ?? "")
  const oldStatus = load.status != null ? String(load.status) : ""
  const gType = params.geofence.geofence_type

  let newStatus: string | null = null
  if (gType === "pickup" && (oldStatus === "confirmed" || oldStatus === "scheduled")) {
    newStatus = "in_transit"
  } else if (gType === "delivery" && oldStatus === "in_transit") {
    newStatus = "delivered"
  }

  if (!newStatus || newStatus === oldStatus) {
    return { statusUpdated, notificationCreated }
  }

  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === "delivered") {
    patch.actual_delivery = params.geofenceEvent.occurred_at
  }

  const { error: upErr } = await admin.from("loads").update(patch).eq("id", loadId).eq("company_id", params.companyId)

  if (upErr) {
    Sentry.captureMessage(`geofence load status update failed: ${safeDbError(upErr)}`, { level: "warning" })
    return { statusUpdated, notificationCreated }
  }

  const { error: histErr } = await admin.from("load_status_history").insert({
    company_id: params.companyId,
    load_id: loadId,
    old_status: oldStatus,
    new_status: newStatus,
    change_reason: "automatic_geofence_telemetry",
    geofence_id: params.geofence.id,
    zone_visit_id: null,
    changed_by: null,
    changed_by_system: true,
    metadata: {
      source: "geofence_telemetry_cron",
      geofence_event_id: params.geofenceEvent.id,
    },
  })

  if (histErr) {
    Sentry.captureMessage(`geofence load_status_history insert failed: ${safeDbError(histErr)}`, { level: "warning" })
  }

  await admin
    .from("geofence_events")
    .update({
      triggered_status_update: true,
      previous_load_status: oldStatus,
      new_load_status: newStatus,
      load_id: loadId,
    })
    .eq("id", params.geofenceEvent.id)
    .eq("company_id", params.companyId)

  statusUpdated = true
  return { statusUpdated, notificationCreated }
}

export async function handleGeofenceExit(params: {
  companyId: string
  geofenceEvent: GeofenceEventRow
  geofence: GeofenceRow
  truck: TruckLite
  enterEventId: string | null
  dwellSeconds: number
}): Promise<{ detentionFlagged: boolean; notificationCreated: boolean }> {
  const admin = createAdminClient()
  let detentionFlagged = false
  let notificationCreated = false

  const truckLabel = params.truck.truck_number?.trim() || "Vehicle"
  const thresholdMin = params.geofence.detention_threshold_minutes ?? 120
  const thresholdSec = thresholdMin * 60

  const shouldFlagDetention =
    (params.geofence.detention_enabled === true || params.geofence.alert_on_dwell === true) &&
    params.dwellSeconds >= thresholdSec

  if (shouldFlagDetention && params.dwellSeconds >= DWELL_ALERT_SECONDS) {
    detentionFlagged = true
    const hours = Math.round((params.dwellSeconds / 3600) * 10) / 10
    await admin
      .from("geofence_events")
      .update({ detention_billing_status: "candidate" })
      .eq("id", params.geofenceEvent.id)
      .eq("company_id", params.companyId)

    const alertId = await insertCompanyAlert({
      companyId: params.companyId,
      title: `${truckLabel} dwell at ${params.geofence.name}`,
      message: `Approximately ${hours}h inside “${params.geofence.name}”. Telemetry sampling affects precision — use for detention discussions, not payroll.`,
      eventType: "geofence_dwell",
      truckId: params.geofenceEvent.truck_id,
      driverId: params.geofenceEvent.driver_id,
      loadId: params.geofenceEvent.load_id,
      metadata: {
        geofence_id: params.geofence.id,
        geofence_event_id: params.geofenceEvent.id,
        dwell_seconds: params.dwellSeconds,
        paired_enter_event_id: params.enterEventId,
        source: "geofence_telemetry_cron",
      },
    })
    if (alertId) {
      notificationCreated = true
      await admin
        .from("geofence_events")
        .update({ triggered_notification_id: alertId })
        .eq("id", params.geofenceEvent.id)
        .eq("company_id", params.companyId)
    }
  }

  if (params.geofence.alert_on_exit === true) {
    const alertId = await insertCompanyAlert({
      companyId: params.companyId,
      title: `${truckLabel} left ${params.geofence.name}`,
      message: `Exit from “${params.geofence.name}” at ${new Date(params.geofenceEvent.occurred_at).toLocaleString()}.`,
      eventType: "geofence_exit",
      truckId: params.geofenceEvent.truck_id,
      driverId: params.geofenceEvent.driver_id,
      loadId: params.geofenceEvent.load_id,
      metadata: {
        geofence_id: params.geofence.id,
        geofence_event_id: params.geofenceEvent.id,
        dwell_seconds: params.dwellSeconds,
        source: "geofence_telemetry_cron",
      },
    })
    if (alertId) {
      notificationCreated = true
      await admin
        .from("geofence_events")
        .update({ triggered_notification_id: alertId })
        .eq("id", params.geofenceEvent.id)
        .eq("company_id", params.companyId)
    }
  }

  return { detentionFlagged, notificationCreated }
}
