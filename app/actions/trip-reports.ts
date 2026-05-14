"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import type { HarshEvent } from "@/app/actions/eld-events"
import { decimatePoints } from "@/lib/promiles/geo"
import { generateTripSummaryForLoad, type TripSummary, type TripStop } from "@/lib/eld/trip-aggregator"

export type TelemetryPoint = {
  recorded_at: string
  location_lat: number
  location_lng: number
  speed_mph: number | null
  heading_degrees: number | null
  engine_on: boolean | null
}

async function requireTripReplayGate(): Promise<{ companyId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "trip_replay" })
  if (!gate.allowed) {
    return { error: "Trip replay and route reports are available on Professional and Fleet plans." }
  }
  return { companyId: ctx.companyId }
}

async function assertLoadInCompany(loadId: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("loads").select("id").eq("id", loadId).eq("company_id", companyId).maybeSingle()
  if (error) return { error: safeDbError(error) }
  if (!data) return { error: "Load not found." }
  return { ok: true }
}

function rowToTripSummary(row: Record<string, unknown>): TripSummary | null {
  if (typeof row.id !== "string" || typeof row.load_id !== "string") return null
  const stopsRaw = row.stops
  let stops: TripStop[] = []
  if (Array.isArray(stopsRaw)) {
    stops = stopsRaw
      .map((s) => {
        const o = s as Record<string, unknown>
        const lat = Number(o.lat)
        const lng = Number(o.lng)
        const type =
          o.type === "pickup" || o.type === "delivery" || o.type === "rest" || o.type === "fuel" || o.type === "other"
            ? o.type
            : "other"
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return {
          lat,
          lng,
          started_at: String(o.started_at ?? ""),
          ended_at: String(o.ended_at ?? ""),
          duration_seconds: Math.round(Number(o.duration_seconds ?? 0)),
          address: typeof o.address === "string" ? o.address : undefined,
          type,
        } as TripStop
      })
      .filter((s): s is TripStop => s != null)
  }
  return {
    id: row.id,
    company_id: String(row.company_id ?? ""),
    load_id: row.load_id,
    truck_id: (row.truck_id as string | null) ?? null,
    driver_id: (row.driver_id as string | null) ?? null,
    trip_started_at: String(row.trip_started_at ?? ""),
    trip_ended_at: String(row.trip_ended_at ?? ""),
    total_distance_miles: Number(row.total_distance_miles ?? 0),
    total_duration_seconds: Math.round(Number(row.total_duration_seconds ?? 0)),
    active_drive_seconds: Math.round(Number(row.active_drive_seconds ?? 0)),
    idle_seconds: Math.round(Number(row.idle_seconds ?? 0)),
    stopped_seconds: Math.round(Number(row.stopped_seconds ?? 0)),
    max_speed_mph: row.max_speed_mph == null ? null : Number(row.max_speed_mph),
    avg_speed_mph: row.avg_speed_mph == null ? null : Number(row.avg_speed_mph),
    harsh_brake_count: Math.round(Number(row.harsh_brake_count ?? 0)),
    harsh_acceleration_count: Math.round(Number(row.harsh_acceleration_count ?? 0)),
    harsh_cornering_count: Math.round(Number(row.harsh_cornering_count ?? 0)),
    speeding_count: Math.round(Number(row.speeding_count ?? 0)),
    estimated_fuel_gallons: row.estimated_fuel_gallons == null ? null : Number(row.estimated_fuel_gallons),
    estimated_fuel_cost_usd: row.estimated_fuel_cost_usd == null ? null : Number(row.estimated_fuel_cost_usd),
    estimated_idle_fuel_gallons: row.estimated_idle_fuel_gallons == null ? null : Number(row.estimated_idle_fuel_gallons),
    stops,
    on_time_pickup: row.on_time_pickup == null ? null : Boolean(row.on_time_pickup),
    on_time_delivery: row.on_time_delivery == null ? null : Boolean(row.on_time_delivery),
    pickup_arrival_at: (row.pickup_arrival_at as string | null) ?? null,
    delivery_arrival_at: (row.delivery_arrival_at as string | null) ?? null,
    computed_at: String(row.computed_at ?? ""),
    needs_refresh: Boolean(row.needs_refresh),
  }
}

export async function getTripSummary(loadId: string): Promise<{ data: TripSummary | null; error: string | null }> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const ok = await assertLoadInCompany(loadId, gate.companyId)
  if ("error" in ok) return { data: null, error: ok.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("trip_summaries").select("*").eq("load_id", loadId).maybeSingle()
  if (error) return { data: null, error: safeDbError(error) }
  if (!data) return { data: null, error: null }
  const row = data as Record<string, unknown>
  if (String(row.company_id ?? "") !== gate.companyId) return { data: null, error: "Not found." }
  const parsed = rowToTripSummary(row)
  return { data: parsed, error: null }
}

export async function getTripTelemetry(params: {
  loadId: string
  simplify?: boolean
}): Promise<{
  data: { points: TelemetryPoint[]; events: HarshEvent[]; stops: TripStop[] } | null
  error: string | null
}> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const ok = await assertLoadInCompany(params.loadId, gate.companyId)
  if ("error" in ok) return { data: null, error: ok.error }

  const supabase = await createClient()
  const { data: loadRaw, error: lErr } = await supabase.from("loads").select("*").eq("id", params.loadId).maybeSingle()
  if (lErr) return { data: null, error: safeDbError(lErr) }
  if (!loadRaw) return { data: null, error: "Load not found." }
  const load = loadRaw as Record<string, unknown>
  const truckId = (load.truck_id as string | null) ?? null
  if (!truckId) {
    return { data: null, error: "No truck assigned — no route telemetry to show." }
  }

  const pickupIso = load.load_date ? String(load.load_date) : null
  const deliveryEndIso = load.actual_delivery
    ? String(load.actual_delivery)
    : load.estimated_delivery
      ? String(load.estimated_delivery)
      : null
  if (!pickupIso || !deliveryEndIso) {
    return { data: null, error: "Load is missing pickup or delivery timestamps for the telemetry window." }
  }

  const windowStart = new Date(new Date(pickupIso).getTime() - 2 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(new Date(deliveryEndIso).getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data: ptsRaw, error: pErr } = await supabase
    .from("eld_telemetry_points")
    .select("recorded_at, location_lat, location_lng, speed_mph, heading_degrees, engine_on")
    .eq("company_id", gate.companyId)
    .eq("truck_id", truckId)
    .gte("recorded_at", windowStart)
    .lte("recorded_at", windowEnd)
    .order("recorded_at", { ascending: true })
    .limit(15_000)

  if (pErr) return { data: null, error: safeDbError(pErr) }

  let points: TelemetryPoint[] = ((ptsRaw ?? []) as unknown[]).map((row) => {
    const o = row as Record<string, unknown>
    return {
      recorded_at: String(o.recorded_at ?? ""),
      location_lat: Number(o.location_lat),
      location_lng: Number(o.location_lng),
      speed_mph: o.speed_mph == null ? null : Number(o.speed_mph),
      heading_degrees: o.heading_degrees == null ? null : Number(o.heading_degrees),
      engine_on: typeof o.engine_on === "boolean" ? o.engine_on : o.engine_on == null ? null : Boolean(o.engine_on),
    }
  })

  points = points.filter((p) => Number.isFinite(p.location_lat) && Number.isFinite(p.location_lng) && p.recorded_at)

  const maxPts = params.simplify === false ? 2000 : 500
  if (points.length > maxPts) {
    points = decimatePoints(
      points.map((p) => ({ ...p, lat: p.location_lat, lng: p.location_lng })),
      maxPts,
    ).map((p) => ({
      recorded_at: p.recorded_at,
      location_lat: p.lat,
      location_lng: p.lng,
      speed_mph: p.speed_mph,
      heading_degrees: p.heading_degrees,
      engine_on: p.engine_on,
    }))
  }

  const { data: evs, error: eErr } = await supabase
    .from("eld_harsh_events")
    .select(
      `id, company_id, truck_id, driver_id, eld_device_id, event_type, severity, occurred_at,
       location_lat, location_lng, location_address, speed_mph, speed_limit_mph, g_force,
       duration_seconds, provider, provider_event_id, raw_payload, reviewed, reviewed_at, coaching_note,
       driver:drivers(id, name),
       truck:trucks(id, truck_number)`,
    )
    .eq("company_id", gate.companyId)
    .eq("truck_id", truckId)
    .gte("occurred_at", windowStart)
    .lte("occurred_at", windowEnd)
    .order("occurred_at", { ascending: false })
    .limit(400)

  if (eErr) return { data: null, error: safeDbError(eErr) }

  const events: HarshEvent[] = ((evs ?? []) as unknown[]).map((r) => {
    const o = r as Record<string, unknown>
    return {
      id: String(o.id),
      company_id: String(o.company_id),
      truck_id: (o.truck_id as string | null) ?? null,
      driver_id: (o.driver_id as string | null) ?? null,
      eld_device_id: String(o.eld_device_id ?? ""),
      event_type: String(o.event_type ?? ""),
      severity: String(o.severity ?? "medium"),
      occurred_at: String(o.occurred_at ?? ""),
      location_lat: o.location_lat == null ? null : Number(o.location_lat),
      location_lng: o.location_lng == null ? null : Number(o.location_lng),
      location_address: (o.location_address as string | null) ?? null,
      speed_mph: o.speed_mph == null ? null : Number(o.speed_mph),
      speed_limit_mph: o.speed_limit_mph == null ? null : Number(o.speed_limit_mph),
      g_force: o.g_force == null ? null : Number(o.g_force),
      duration_seconds: o.duration_seconds == null ? null : Number(o.duration_seconds),
      provider: String(o.provider ?? ""),
      provider_event_id: String(o.provider_event_id ?? ""),
      raw_payload: (o.raw_payload as Record<string, unknown>) || {},
      reviewed: Boolean(o.reviewed),
      reviewed_at: (o.reviewed_at as string | null) ?? null,
      coaching_note: (o.coaching_note as string | null) ?? null,
      driver: o.driver as HarshEvent["driver"],
      truck: o.truck as HarshEvent["truck"],
    }
  })

  const { data: sumRow } = await supabase.from("trip_summaries").select("stops").eq("load_id", params.loadId).maybeSingle()
  const stops: TripStop[] = []
  const sr = sumRow as { stops?: unknown } | null
  if (sr && Array.isArray(sr.stops)) {
    for (const s of sr.stops) {
      const o = s as Record<string, unknown>
      const lat = Number(o.lat)
      const lng = Number(o.lng)
      const type =
        o.type === "pickup" || o.type === "delivery" || o.type === "rest" || o.type === "fuel" || o.type === "other"
          ? o.type
          : "other"
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      stops.push({
        lat,
        lng,
        started_at: String(o.started_at ?? ""),
        ended_at: String(o.ended_at ?? ""),
        duration_seconds: Math.round(Number(o.duration_seconds ?? 0)),
        address: typeof o.address === "string" ? o.address : undefined,
        type,
      })
    }
  }

  return { data: { points, events, stops }, error: null }
}

export async function refreshTripSummary(loadId: string): Promise<{ data: { refreshed: boolean } | null; error: string | null }> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const ok = await assertLoadInCompany(loadId, gate.companyId)
  if ("error" in ok) return { data: null, error: ok.error }

  const out = await generateTripSummaryForLoad({ loadId, companyId: gate.companyId })
  if (out.error) return { data: null, error: out.error }
  return { data: { refreshed: true }, error: null }
}

export async function exportTripReport(_loadId: string): Promise<{ data: { pdfUrl: string } | null; error: string | null }> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  void _loadId
  return { data: null, error: "Trip PDF export is not available yet." }
}

export type TripSummaryListRow = {
  load_id: string
  shipment_number: string | null
  trip_started_at: string
  total_distance_miles: number
  harsh_total: number
}

export async function listTripSummariesForDriver(driverId: string): Promise<{
  data: TripSummaryListRow[] | null
  error: string | null
}> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trip_summaries")
    .select(
      "load_id, trip_started_at, total_distance_miles, harsh_brake_count, harsh_acceleration_count, harsh_cornering_count, speeding_count",
    )
    .eq("company_id", gate.companyId)
    .eq("driver_id", driverId)
    .order("trip_started_at", { ascending: false })
    .limit(30)

  if (error) return { data: null, error: safeDbError(error) }
  const rows = (data || []) as Record<string, unknown>[]
  const loadIds = [...new Set(rows.map((r) => String(r.load_id ?? "")).filter(Boolean))]
  const shipById = new Map<string, string | null>()
  if (loadIds.length > 0) {
    const { data: loads } = await supabase.from("loads").select("id, shipment_number").in("id", loadIds)
    for (const l of loads || []) {
      const o = l as { id?: string; shipment_number?: string | null }
      if (o.id) shipById.set(o.id, o.shipment_number ?? null)
    }
  }
  const list: TripSummaryListRow[] = rows.map((o) => {
    const lid = String(o.load_id ?? "")
    const hb = Number(o.harsh_brake_count ?? 0)
    const ha = Number(o.harsh_acceleration_count ?? 0)
    const hc = Number(o.harsh_cornering_count ?? 0)
    const sp = Number(o.speeding_count ?? 0)
    return {
      load_id: lid,
      shipment_number: shipById.get(lid) ?? null,
      trip_started_at: String(o.trip_started_at ?? ""),
      total_distance_miles: Number(o.total_distance_miles ?? 0),
      harsh_total: hb + ha + hc + sp,
    }
  })
  return { data: list, error: null }
}

export async function listTripSummariesForTruck(truckId: string): Promise<{
  data: TripSummaryListRow[] | null
  error: string | null
}> {
  const gate = await requireTripReplayGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trip_summaries")
    .select(
      "load_id, trip_started_at, total_distance_miles, harsh_brake_count, harsh_acceleration_count, harsh_cornering_count, speeding_count",
    )
    .eq("company_id", gate.companyId)
    .eq("truck_id", truckId)
    .order("trip_started_at", { ascending: false })
    .limit(30)

  if (error) return { data: null, error: safeDbError(error) }
  const rows = (data || []) as Record<string, unknown>[]
  const loadIds = [...new Set(rows.map((r) => String(r.load_id ?? "")).filter(Boolean))]
  const shipById = new Map<string, string | null>()
  if (loadIds.length > 0) {
    const { data: loads } = await supabase.from("loads").select("id, shipment_number").in("id", loadIds)
    for (const l of loads || []) {
      const o = l as { id?: string; shipment_number?: string | null }
      if (o.id) shipById.set(o.id, o.shipment_number ?? null)
    }
  }
  const list: TripSummaryListRow[] = rows.map((o) => {
    const lid = String(o.load_id ?? "")
    const hb = Number(o.harsh_brake_count ?? 0)
    const ha = Number(o.harsh_acceleration_count ?? 0)
    const hc = Number(o.harsh_cornering_count ?? 0)
    const sp = Number(o.speeding_count ?? 0)
    return {
      load_id: lid,
      shipment_number: shipById.get(lid) ?? null,
      trip_started_at: String(o.trip_started_at ?? ""),
      total_distance_miles: Number(o.total_distance_miles ?? 0),
      harsh_total: hb + ha + hc + sp,
    }
  })
  return { data: list, error: null }
}
