"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { createGeofence as legacyCreateGeofence, deleteGeofence as legacyDeleteGeofence, getGeofences, updateGeofence as legacyUpdateGeofence } from "@/app/actions/geofencing"

export type GeofenceListItem = {
  id: string
  name: string
  geofence_type: string | null
  zone_type: string | null
  is_active: boolean | null
  related_customer_id: string | null
  center_latitude: number | null
  center_longitude: number | null
  radius_meters: number | null
}

export type GeofenceEventListItem = {
  id: string
  occurred_at: string
  event_type: "enter" | "exit"
  geofence_id: string
  geofence_name: string | null
  truck_id: string | null
  truck_number: string | null
  driver_id: string | null
  driver_name: string | null
  load_id: string | null
  shipment_number: string | null
  dwell_seconds: number | null
  triggered_status_update: boolean
  previous_load_status: string | null
  new_load_status: string | null
  detention_billing_status: string
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

async function ensureGeofenceZonesGate(): Promise<{ companyId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "geofencing_automation" })
  if (!gate.allowed) return { error: "Geofencing is not available on your plan." }
  return { companyId: ctx.companyId }
}

export async function listGeofences(params?: {
  type?: string
  customerId?: string
  activeOnly?: boolean
}): Promise<{ data: GeofenceListItem[] | null; error: string | null }> {
  const g = await ensureGeofenceZonesGate()
  if ("error" in g) return { data: null, error: g.error }

  const res = await getGeofences({
    is_active: params?.activeOnly === true ? true : params?.activeOnly === false ? false : undefined,
  })
  if (res.error || res.data == null) return { data: null, error: res.error || "Failed to list geofences." }

  let rows: GeofenceListItem[] = (res.data as unknown[]).map((raw) => {
    const o = asRecord(raw)
    return {
      id: String(o.id ?? ""),
      name: String(o.name ?? ""),
      geofence_type: o.geofence_type == null ? null : String(o.geofence_type),
      zone_type: o.zone_type == null ? null : String(o.zone_type),
      is_active: typeof o.is_active === "boolean" ? o.is_active : null,
      related_customer_id: o.related_customer_id == null ? null : String(o.related_customer_id),
      center_latitude: o.center_latitude == null ? null : Number(o.center_latitude),
      center_longitude: o.center_longitude == null ? null : Number(o.center_longitude),
      radius_meters: o.radius_meters == null ? null : Number(o.radius_meters),
    }
  })

  if (params?.type) {
    rows = rows.filter((r) => (r.geofence_type || "").toLowerCase() === params.type!.toLowerCase())
  }
  if (params?.customerId) {
    rows = rows.filter((r) => r.related_customer_id === params.customerId)
  }

  return { data: rows, error: null }
}

export async function createGeofence(params: {
  name: string
  description?: string
  geofence_type: string
  center_lat: number
  center_lng: number
  radius_meters: number
  related_customer_id?: string
  auto_update_load_status?: boolean
  notify_on_arrival?: boolean
  notify_on_departure?: boolean
  track_dwell_time?: boolean
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const res = await legacyCreateGeofence({
    name: params.name,
    description: params.description,
    zone_type: "circle",
    center_latitude: params.center_lat,
    center_longitude: params.center_lng,
    radius_meters: params.radius_meters,
    geofence_type: params.geofence_type,
    related_customer_id: params.related_customer_id ?? null,
    auto_update_load_status: params.auto_update_load_status ?? true,
    alert_on_entry: params.notify_on_arrival ?? true,
    alert_on_exit: params.notify_on_departure ?? false,
    alert_on_dwell: params.track_dwell_time ?? true,
  })

  if (res.error || !res.data) return { data: null, error: res.error || "Failed to create geofence." }
  const id = String((res.data as { id?: string }).id ?? "")
  if (!id) return { data: null, error: "Create succeeded but no id returned." }
  revalidatePath("/dashboard/eld/geofences")
  return { data: { id }, error: null }
}

export async function updateGeofence(params: {
  id: string
  patches: Partial<{
    name: string
    description: string
    center_latitude: number
    center_longitude: number
    radius_meters: number
    auto_update_load_status: boolean
    notify_on_arrival: boolean
    notify_on_departure: boolean
    track_dwell_time: boolean
    active: boolean
    geofence_type: string
    related_customer_id: string | null
  }>
}): Promise<{ data: { updated: boolean } | null; error: string | null }> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const p = params.patches
  const res = await legacyUpdateGeofence(params.id, {
    name: p.name,
    description: p.description,
    center_latitude: p.center_latitude,
    center_longitude: p.center_longitude,
    radius_meters: p.radius_meters,
    auto_update_load_status: p.auto_update_load_status,
    alert_on_entry: p.notify_on_arrival,
    alert_on_exit: p.notify_on_departure,
    alert_on_dwell: p.track_dwell_time,
    is_active: p.active,
    geofence_type: p.geofence_type,
    related_customer_id: p.related_customer_id,
  })

  if (res.error) return { data: null, error: res.error }
  revalidatePath("/dashboard/eld/geofences")
  return { data: { updated: true }, error: null }
}

export async function deleteGeofence(id: string): Promise<{
  data: { deleted: boolean } | null
  error: string | null
}> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const res = await legacyDeleteGeofence(id)
  if (res.error) return { data: null, error: res.error }
  revalidatePath("/dashboard/eld/geofences")
  return { data: { deleted: true }, error: null }
}

export async function listGeofenceEvents(params: {
  daysBack?: number
  geofenceId?: string
  truckId?: string
  loadId?: string
  eventType?: "enter" | "exit"
  limit?: number
}): Promise<{ data: GeofenceEventListItem[] | null; error: string | null }> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const days = Math.min(Math.max(params.daysBack ?? 7, 1), 90)
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const lim = Math.min(Math.max(params.limit ?? 200, 1), 1000)

  let q = supabase
    .from("geofence_events")
    .select(
      "id, occurred_at, event_type, geofence_id, truck_id, driver_id, load_id, dwell_seconds, triggered_status_update, previous_load_status, new_load_status, detention_billing_status",
    )
    .eq("company_id", gate.companyId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(lim)

  if (params.geofenceId) q = q.eq("geofence_id", params.geofenceId)
  if (params.truckId) q = q.eq("truck_id", params.truckId)
  if (params.loadId) q = q.eq("load_id", params.loadId)
  if (params.eventType) q = q.eq("event_type", params.eventType)

  const { data, error } = await q
  if (error) return { data: null, error: safeDbError(error) }

  const rows: GeofenceEventListItem[] = (data ?? []).map((raw: unknown) => {
    const o = asRecord(raw)
    return {
      id: String(o.id ?? ""),
      occurred_at: String(o.occurred_at ?? ""),
      event_type: o.event_type === "exit" ? "exit" : "enter",
      geofence_id: String(o.geofence_id ?? ""),
      geofence_name: null,
      truck_id: o.truck_id == null ? null : String(o.truck_id),
      truck_number: null,
      driver_id: o.driver_id == null ? null : String(o.driver_id),
      driver_name: null,
      load_id: o.load_id == null ? null : String(o.load_id),
      shipment_number: null,
      dwell_seconds: o.dwell_seconds == null ? null : Number(o.dwell_seconds),
      triggered_status_update: o.triggered_status_update === true,
      previous_load_status: o.previous_load_status == null ? null : String(o.previous_load_status),
      new_load_status: o.new_load_status == null ? null : String(o.new_load_status),
      detention_billing_status: typeof o.detention_billing_status === "string" ? o.detention_billing_status : "none",
    }
  })

  return { data: rows, error: null }
}

export async function getDwellTimeReport(params: {
  daysBack: number
  groupBy: "customer" | "truck" | "driver" | "geofence"
}): Promise<{
  data: Array<{
    group_key: string
    group_label: string
    total_dwell_hours: number
    event_count: number
    avg_dwell_hours: number
    detention_candidate_count: number
  }> | null
  error: string | null
}> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const days = Math.min(Math.max(params.daysBack, 1), 90)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data, error } = await supabase
    .from("geofence_events")
    .select("dwell_seconds, truck_id, driver_id, geofence_id, load_id, detention_billing_status, event_type")
    .eq("company_id", gate.companyId)
    .eq("event_type", "exit")
    .gte("occurred_at", since)
    .not("dwell_seconds", "is", null)
    .limit(5000)

  if (error) return { data: null, error: safeDbError(error) }

  type Agg = {
    totalSeconds: number
    count: number
    detentionCandidates: number
    label: string
  }
  const map = new Map<string, Agg>()

  for (const raw of data ?? []) {
    const o = asRecord(raw)
    const dwell = Number(o.dwell_seconds ?? 0)
    if (!Number.isFinite(dwell) || dwell <= 0) continue
    const isCand = dwell >= 7200 || o.detention_billing_status === "candidate"

    let key = ""
    let label = ""

    if (params.groupBy === "truck") {
      key = o.truck_id ? String(o.truck_id) : "unknown"
      label = key === "unknown" ? "Unknown truck" : `Truck ${key.slice(0, 8)}…`
    } else if (params.groupBy === "driver") {
      key = o.driver_id ? String(o.driver_id) : "unknown"
      label = key === "unknown" ? "Unknown driver" : `Driver ${key.slice(0, 8)}…`
    } else if (params.groupBy === "geofence") {
      key = o.geofence_id ? String(o.geofence_id) : "unknown"
      label = key === "unknown" ? "Unknown geofence" : `Geofence ${key.slice(0, 8)}…`
    } else {
      key = o.load_id ? String(o.load_id) : "unknown"
      label = key === "unknown" ? "No load linked" : `Load ${key.slice(0, 8)}…`
    }

    const cur = map.get(key) ?? { totalSeconds: 0, count: 0, detentionCandidates: 0, label }
    cur.totalSeconds += dwell
    cur.count += 1
    if (isCand) cur.detentionCandidates += 1
    cur.label = label
    map.set(key, cur)
  }

  const out = [...map.entries()]
    .map(([group_key, v]) => ({
      group_key,
      group_label: v.label,
      total_dwell_hours: Math.round((v.totalSeconds / 3600) * 100) / 100,
      event_count: v.count,
      avg_dwell_hours: v.count > 0 ? Math.round((v.totalSeconds / v.count / 3600) * 100) / 100 : 0,
      detention_candidate_count: v.detentionCandidates,
    }))
    .sort((a, b) => b.total_dwell_hours - a.total_dwell_hours)

  return { data: out, error: null }
}

export async function markGeofenceDetentionReviewed(params: {
  eventId: string
  status: "reviewed" | "ignored"
}): Promise<{ data: { ok: boolean } | null; error: string | null }> {
  const gate = await ensureGeofenceZonesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("geofence_events")
    .update({ detention_billing_status: params.status })
    .eq("id", params.eventId)
    .eq("company_id", gate.companyId)
    .eq("event_type", "exit")

  if (error) return { data: null, error: safeDbError(error) }
  revalidatePath("/dashboard/billing/detention-candidates")
  return { data: { ok: true }, error: null }
}
