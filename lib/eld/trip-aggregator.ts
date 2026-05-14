import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { haversineMiles } from "@/lib/promiles/geo"
import { fetchDieselPriceForTruckContext } from "@/lib/promiles/eia-diesel"

export type TripStopType = "pickup" | "delivery" | "rest" | "fuel" | "other"

export type TripStop = {
  lat: number
  lng: number
  started_at: string
  ended_at: string
  duration_seconds: number
  address?: string
  type: TripStopType
}

export type TripSummary = {
  id: string
  company_id: string
  load_id: string
  truck_id: string | null
  driver_id: string | null
  trip_started_at: string
  trip_ended_at: string
  total_distance_miles: number
  total_duration_seconds: number
  active_drive_seconds: number
  idle_seconds: number
  stopped_seconds: number
  max_speed_mph: number | null
  avg_speed_mph: number | null
  harsh_brake_count: number
  harsh_acceleration_count: number
  harsh_cornering_count: number
  speeding_count: number
  estimated_fuel_gallons: number | null
  estimated_fuel_cost_usd: number | null
  estimated_idle_fuel_gallons: number | null
  stops: TripStop[]
  on_time_pickup: boolean | null
  on_time_delivery: boolean | null
  pickup_arrival_at: string | null
  delivery_arrival_at: string | null
  computed_at: string
  needs_refresh: boolean
}

const DEFAULT_MPG = 6.5
const STOP_SPEED_MPH = 1
const STOP_MIN_SECONDS = 5 * 60
const REST_MIN_SECONDS = 10 * 60 * 60
const PROXIMITY_MILES = 0.5
const ON_TIME_SLACK_MS = 30 * 60 * 1000

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function parseCoordHints(load: Record<string, unknown>): {
  pickup?: { lat: number; lng: number }
  delivery?: { lat: number; lng: number }
} {
  const coords = load.coordinates
  if (!coords || typeof coords !== "object" || Array.isArray(coords)) return {}
  const o = coords as Record<string, unknown>
  const pick = asRecord(o.pickup ?? o.origin)
  const del = asRecord(o.delivery ?? o.destination)
  const out: { pickup?: { lat: number; lng: number }; delivery?: { lat: number; lng: number } } = {}
  const plat = typeof pick.lat === "number" ? pick.lat : typeof pick.latitude === "number" ? pick.latitude : null
  const plng = typeof pick.lng === "number" ? pick.lng : typeof pick.longitude === "number" ? pick.longitude : null
  if (plat != null && plng != null && Number.isFinite(plat) && Number.isFinite(plng)) {
    out.pickup = { lat: plat, lng: plng }
  }
  const dlat = typeof del.lat === "number" ? del.lat : typeof del.latitude === "number" ? del.latitude : null
  const dlng = typeof del.lng === "number" ? del.lng : typeof del.longitude === "number" ? del.longitude : null
  if (dlat != null && dlng != null && Number.isFinite(dlat) && Number.isFinite(dlng)) {
    out.delivery = { lat: dlat, lng: dlng }
  }
  return out
}

function classifyStop(
  lat: number,
  lng: number,
  durationSeconds: number,
  hints: { pickup?: { lat: number; lng: number }; delivery?: { lat: number; lng: number } },
): TripStopType {
  if (durationSeconds >= REST_MIN_SECONDS) return "rest"
  if (hints.pickup && haversineMiles({ lat, lng }, hints.pickup) <= PROXIMITY_MILES) return "pickup"
  if (hints.delivery && haversineMiles({ lat, lng }, hints.delivery) <= PROXIMITY_MILES) return "delivery"
  return "other"
}

function rowToTripSummary(row: Record<string, unknown>): TripSummary | null {
  if (typeof row.id !== "string" || typeof row.load_id !== "string") return null
  const stopsRaw = row.stops
  let stops: TripStop[] = []
  if (Array.isArray(stopsRaw)) {
    stops = stopsRaw
      .map((s) => {
        const o = asRecord(s)
        const lat = typeof o.lat === "number" ? o.lat : Number(o.lat)
        const lng = typeof o.lng === "number" ? o.lng : Number(o.lng)
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

export async function generateTripSummaryForLoad(params: {
  loadId: string
  companyId: string
}): Promise<{ data: TripSummary | null; error: string | null }> {
  const admin = createAdminClient()
  const { data: loadRaw, error: lErr } = await admin.from("loads").select("*").eq("id", params.loadId).maybeSingle()
  if (lErr) return { data: null, error: lErr.message }
  if (!loadRaw) return { data: null, error: "Load not found." }
  const load = loadRaw as Record<string, unknown>
  if (String(load.company_id ?? "") !== params.companyId) {
    return { data: null, error: "Load not found." }
  }
  const status = String(load.status ?? "").toLowerCase()
  if (!["delivered", "invoiced", "paid"].includes(status)) {
    return { data: null, error: "Trip summaries are generated only for completed loads." }
  }

  const truckId = (load.truck_id as string | null) ?? null
  if (!truckId) {
    return { data: null, error: "Load has no assigned truck; cannot correlate telemetry." }
  }

  const pickupIso = load.load_date ? String(load.load_date) : null
  const deliveryEndIso = load.actual_delivery
    ? String(load.actual_delivery)
    : load.estimated_delivery
      ? String(load.estimated_delivery)
      : null
  if (!pickupIso || !deliveryEndIso) {
    return { data: null, error: "Load is missing pickup or delivery timestamps." }
  }

  const windowStart = new Date(new Date(pickupIso).getTime() - 2 * 60 * 60 * 1000)
  const windowEnd = new Date(new Date(deliveryEndIso).getTime() + 2 * 60 * 60 * 1000)
  if (!Number.isFinite(windowStart.getTime()) || !Number.isFinite(windowEnd.getTime()) || windowEnd <= windowStart) {
    return { data: null, error: "Invalid trip time window." }
  }

  const { data: pointsRaw, error: pErr } = await admin
    .from("eld_telemetry_points")
    .select(
      "recorded_at, location_lat, location_lng, speed_mph, heading_degrees, engine_on, odometer_miles, fuel_level_percent",
    )
    .eq("company_id", params.companyId)
    .eq("truck_id", truckId)
    .gte("recorded_at", windowStart.toISOString())
    .lte("recorded_at", windowEnd.toISOString())
    .order("recorded_at", { ascending: true })
    .limit(25_000)

  if (pErr) return { data: null, error: pErr.message }

  type Pt = {
    recorded_at: string
    location_lat: number
    location_lng: number
    speed_mph: number | null
    engine_on: boolean | null
    odometer_miles: number | null
  }

  const points: Pt[] = (pointsRaw || [])
    .map((r) => {
      const o = r as Record<string, unknown>
      const lat = Number(o.location_lat)
      const lng = Number(o.location_lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        recorded_at: String(o.recorded_at ?? ""),
        location_lat: lat,
        location_lng: lng,
        speed_mph: o.speed_mph == null ? null : Number(o.speed_mph),
        engine_on: typeof o.engine_on === "boolean" ? o.engine_on : o.engine_on == null ? null : Boolean(o.engine_on),
        odometer_miles: o.odometer_miles == null ? null : Number(o.odometer_miles),
      }
    })
    .filter((p): p is Pt => p != null && p.recorded_at.length > 0)

  const hints = parseCoordHints(load)

  let totalDistanceMiles = 0
  let activeDriveSeconds = 0
  let idleSeconds = 0
  let stoppedSeconds = 0
  const speedSamples: number[] = []
  let maxSpeed: number | null = null

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const t0 = new Date(a.recorded_at).getTime()
    const t1 = new Date(b.recorded_at).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue
    const dtSec = (t1 - t0) / 1000
    const segMi = haversineMiles({ lat: a.location_lat, lng: a.location_lng }, { lat: b.location_lat, lng: b.location_lng })
    totalDistanceMiles += segMi

    const spd = b.speed_mph != null && Number.isFinite(b.speed_mph) ? b.speed_mph : a.speed_mph
    const eng = b.engine_on != null ? b.engine_on : a.engine_on

    if (spd != null && spd > STOP_SPEED_MPH) {
      speedSamples.push(spd)
      maxSpeed = maxSpeed == null ? spd : Math.max(maxSpeed, spd)
    }

    const moving = spd != null && spd > STOP_SPEED_MPH
    const engineOff = eng === false
    const engineIdle = eng === true && !moving
    const unknownEngine = eng == null

    if (engineOff) {
      stoppedSeconds += dtSec
    } else if (engineIdle || (unknownEngine && !moving)) {
      idleSeconds += dtSec
    } else {
      activeDriveSeconds += dtSec
    }
  }

  if (points.length >= 2) {
    const o0 = points[0].odometer_miles
    const o1 = points[points.length - 1].odometer_miles
    if (o0 != null && o1 != null && Number.isFinite(o0) && Number.isFinite(o1) && o1 >= o0) {
      const odometerDelta = o1 - o0
      if (odometerDelta > totalDistanceMiles * 0.5) {
        totalDistanceMiles = odometerDelta
      }
    }
  }

  const avgSpeed =
    speedSamples.length > 0 ? speedSamples.reduce((s, v) => s + v, 0) / speedSamples.length : null

  const stops: TripStop[] = []
  let runStart: Pt | null = null
  let runLast: Pt | null = null
  const flushStop = (start: Pt, end: Pt) => {
    const t0 = new Date(start.recorded_at).getTime()
    const t1 = new Date(end.recorded_at).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return
    const dur = Math.round((t1 - t0) / 1000)
    if (dur < STOP_MIN_SECONDS) return
    const lat = (start.location_lat + end.location_lat) / 2
    const lng = (start.location_lng + end.location_lng) / 2
    const type = classifyStop(lat, lng, dur, hints)
    stops.push({
      lat,
      lng,
      started_at: start.recorded_at,
      ended_at: end.recorded_at,
      duration_seconds: dur,
      type,
    })
  }

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    const spd = p.speed_mph ?? 0
    const stationary = spd < STOP_SPEED_MPH
    if (stationary) {
      if (!runStart) runStart = p
      runLast = p
    } else {
      if (runStart && runLast) flushStop(runStart, runLast)
      runStart = null
      runLast = null
    }
  }
  if (runStart && runLast) flushStop(runStart, runLast)

  const tripStartedAt = points.length > 0 ? points[0].recorded_at : pickupIso
  const tripEndedAt = points.length > 0 ? points[points.length - 1].recorded_at : deliveryEndIso
  const totalDurationSeconds = Math.max(
    0,
    Math.round((new Date(tripEndedAt).getTime() - new Date(tripStartedAt).getTime()) / 1000),
  )

  const { data: harshRows } = await admin
    .from("eld_harsh_events")
    .select("event_type")
    .eq("company_id", params.companyId)
    .eq("truck_id", truckId)
    .gte("occurred_at", windowStart.toISOString())
    .lte("occurred_at", windowEnd.toISOString())
    .limit(5000)

  let harsh_brake_count = 0
  let harsh_acceleration_count = 0
  let harsh_cornering_count = 0
  let speeding_count = 0
  for (const r of harshRows || []) {
    const t = String((r as { event_type?: string }).event_type ?? "")
    if (t === "harsh_brake") harsh_brake_count += 1
    else if (t === "harsh_acceleration") harsh_acceleration_count += 1
    else if (t === "harsh_cornering") harsh_cornering_count += 1
    else if (t === "speeding") speeding_count += 1
  }

  const mpg = DEFAULT_MPG
  const estGallons = totalDistanceMiles > 0 ? totalDistanceMiles / mpg : null
  const idleGallons = idleSeconds > 0 ? idleSeconds * (0.8 / 3600) : null

  const eiaKey = process.env.EIA_API_KEY
  const diesel = await fetchDieselPriceForTruckContext({ apiKey: eiaKey, registrationState: null })
  const price = diesel.pricePerGallon
  const estCost =
    estGallons != null || idleGallons != null ? (estGallons ?? 0) * price + (idleGallons ?? 0) * price : null

  const pickupStop = stops.find((s) => s.type === "pickup")
  const deliveryStop = stops.find((s) => s.type === "delivery")
  const pickupArrivalAt = pickupStop?.started_at ?? null
  const deliveryArrivalAt = deliveryStop?.started_at ?? null

  const schedPickup = new Date(pickupIso).getTime()
  const schedDelivery = new Date(deliveryEndIso).getTime()
  let on_time_pickup: boolean | null = null
  let on_time_delivery: boolean | null = null
  if (pickupArrivalAt) {
    const at = new Date(pickupArrivalAt).getTime()
    if (Number.isFinite(at) && Number.isFinite(schedPickup)) {
      on_time_pickup = at <= schedPickup + ON_TIME_SLACK_MS
    }
  }
  if (deliveryArrivalAt) {
    const at = new Date(deliveryArrivalAt).getTime()
    if (Number.isFinite(at) && Number.isFinite(schedDelivery)) {
      on_time_delivery = at <= schedDelivery + ON_TIME_SLACK_MS
    }
  }

  const driverId = (load.driver_id as string | null) ?? null

  const upsertRow = {
    company_id: params.companyId,
    load_id: params.loadId,
    truck_id: truckId,
    driver_id: driverId,
    trip_started_at: tripStartedAt,
    trip_ended_at: tripEndedAt,
    total_distance_miles: Math.round(totalDistanceMiles * 100) / 100,
    total_duration_seconds: totalDurationSeconds,
    active_drive_seconds: Math.round(activeDriveSeconds),
    idle_seconds: Math.round(idleSeconds),
    stopped_seconds: Math.round(stoppedSeconds),
    max_speed_mph: maxSpeed == null ? null : Math.round(maxSpeed * 100) / 100,
    avg_speed_mph: avgSpeed == null ? null : Math.round(avgSpeed * 100) / 100,
    harsh_brake_count,
    harsh_acceleration_count,
    harsh_cornering_count,
    speeding_count,
    estimated_fuel_gallons: estGallons == null ? null : Math.round(estGallons * 100) / 100,
    estimated_fuel_cost_usd: estCost == null ? null : Math.round(estCost * 100) / 100,
    estimated_idle_fuel_gallons: idleGallons == null ? null : Math.round(idleGallons * 100) / 100,
    stops,
    on_time_pickup,
    on_time_delivery,
    pickup_arrival_at: pickupArrivalAt,
    delivery_arrival_at: deliveryArrivalAt,
    computed_at: new Date().toISOString(),
    needs_refresh: false,
  }

  const { data: saved, error: uErr } = await admin
    .from("trip_summaries")
    .upsert(upsertRow, { onConflict: "load_id" })
    .select("*")
    .maybeSingle()

  if (uErr) {
    Sentry.captureMessage(`trip_summaries upsert: ${uErr.message}`, { level: "warning", extra: { loadId: params.loadId } })
    return { data: null, error: uErr.message }
  }
  const parsed = rowToTripSummary(saved as Record<string, unknown>)
  if (!parsed) return { data: null, error: "Failed to read trip summary after save." }
  return { data: parsed, error: null }
}
