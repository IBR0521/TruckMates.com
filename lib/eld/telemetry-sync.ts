import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { clearEldDeviceProviderAuthError, markEldDeviceProviderAuthFailed } from "@/lib/eld/eld-device-auth-helpers"
import { geotabAuthenticate, geotabGet } from "@/lib/eld/geotab-jsonrpc"
import { parseTimestampMs } from "@/lib/eld/parse-provider-time"
import { canonicalEldProvider, mappingProviderKeys, type EldProviderCanonical } from "@/lib/eld/provider-normalize"
import { resolveDriverId, resolveTruckId } from "@/lib/eld/harsh-events-sync"

export type TelemetryPointNormalized = {
  truck_external_id: string
  driver_external_id: string | null
  recorded_at: string
  location_lat: number
  location_lng: number
  speed_mph: number | null
  heading_degrees: number | null
  engine_on: boolean | null
  odometer_miles: number | null
  fuel_level_percent: number | null
  provider_point_id: string | null
  raw: Record<string, unknown>
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const n = parseFloat(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "boolean") return v
    if (v === 1 || v === "1" || v === "true") return true
    if (v === 0 || v === "0" || v === "false") return false
  }
  return null
}

function isFeatureNotLicensed(status: number, bodyText: string): boolean {
  const t = bodyText.toLowerCase()
  if (status === 402) return true
  if (t.includes("not licensed") || t.includes("not entitled") || t.includes("subscription")) return true
  return false
}

async function fetchMotiveJson(
  path: string,
  device: EldDeviceSyncRow,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const apiBaseUrl = "https://api.gomotive.com"
  const fallback = "https://api.keeptruckin.com"
  const headers: Record<string, string> = {
    "X-Api-Key": device.api_key || "",
    "X-Api-Secret": device.api_secret || "",
    Accept: "application/json",
  }
  let res = await fetch(`${apiBaseUrl}${path}`, { headers })
  if (!res.ok && res.status === 404) {
    res = await fetch(`${fallback}${path}`, { headers })
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text) as unknown
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

export async function syncSamsaraTelemetry(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ points: TelemetryPointNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  if (!device.api_key) {
    return { points: [], httpStatus: null, error: "Samsara API key not configured", softSkip: false }
  }
  const vehicleId = encodeURIComponent(device.provider_device_id)
  const startIso = since.toISOString()
  const endIso = until.toISOString()
  const url = `https://api.samsara.com/fleet/vehicles/stats/history?vehicleIds=${vehicleId}&types=gps&decorationTypes=gps&startTime=${encodeURIComponent(
    startIso,
  )}&endTime=${encodeURIComponent(endIso)}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${device.api_key}`,
        Accept: "application/json",
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Samsara telemetry request failed"
    return { points: [], httpStatus: null, error: msg, softSkip: false }
  }
  const text = await res.text()
  if (!res.ok) {
    if (isFeatureNotLicensed(res.status, text)) {
      Sentry.captureMessage(`Samsara vehicle stats/history unavailable: device ${device.id}`, { level: "warning" })
      return { points: [], httpStatus: res.status, error: null, softSkip: true }
    }
    return { points: [], httpStatus: res.status, error: text.slice(0, 500), softSkip: false }
  }
  let parsed: { data?: unknown }
  try {
    parsed = JSON.parse(text) as { data?: unknown }
  } catch {
    return { points: [], httpStatus: res.status, error: "Invalid JSON from Samsara", softSkip: false }
  }
  const series = Array.isArray(parsed.data) ? parsed.data : []
  const points: TelemetryPointNormalized[] = []
  for (const block of series) {
    const b = asRecord(block)
    const vehicle = asRecord(b.vehicle)
    const truckExt = pickString(vehicle, ["id", "name"]) || device.provider_device_id
    const gpsSeries = b.gps
    const rows = Array.isArray(gpsSeries) ? gpsSeries : Array.isArray(b.data) ? (b.data as unknown[]) : []
    for (const row of rows) {
      const o = asRecord(row)
      const timeRaw = pickString(o, ["time", "timestamp", "recordedAt", "recorded_at"])
      const ms = timeRaw ? parseTimestampMs(timeRaw) : null
      if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
      const lat = pickNum(o, ["latitude", "lat"])
      const lng = pickNum(o, ["longitude", "lng", "lon"])
      if (lat == null || lng == null) continue
      const idRaw = pickString(o, ["id", "messageId", "uuid"])
      const driverObj = asRecord(o.driver ?? o.driverInfo)
      const driverExt = pickString(driverObj, ["id", "driverId"])
      points.push({
        truck_external_id: truckExt || device.provider_device_id,
        driver_external_id: driverExt,
        recorded_at: timeRaw ? new Date(parseTimestampMs(timeRaw) ?? timeRaw).toISOString() : new Date(ms ?? until).toISOString(),
        location_lat: lat,
        location_lng: lng,
        speed_mph: pickNum(o, ["speedMph", "speed", "vehicleSpeedMph"]),
        heading_degrees: pickNum(o, ["headingDegrees", "heading", "course"]),
        engine_on: pickBool(o, ["engineOn", "engine_on", "isEngineOn"]),
        odometer_miles: pickNum(o, ["odometerMiles", "odometer"]),
        fuel_level_percent: pickNum(o, ["fuelPercent", "fuelLevelPercent", "fuel"]),
        provider_point_id: idRaw ? `samsara:${idRaw}` : null,
        raw: o,
      })
    }
  }
  return { points, httpStatus: res.status, error: null, softSkip: false }
}

export async function syncMotiveTelemetry(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ points: TelemetryPointNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  const vid = encodeURIComponent(device.provider_device_id)
  const start = encodeURIComponent(since.toISOString())
  const end = encodeURIComponent(until.toISOString())
  const path = `/v1/vehicles/${vid}/locations?start_time=${start}&end_time=${end}`
  const first = await fetchMotiveJson(path, device)
  let ok = first.ok
  let status = first.status
  let text = first.text
  let json: unknown = first.json
  if (!ok && status === 404) {
    const alt = `/v1/vehicle_locations?vehicle_id=${vid}&start_time=${start}&end_time=${end}`
    const fb = await fetchMotiveJson(alt, device)
    ok = fb.ok
    status = fb.status
    text = fb.text
    json = fb.json
  }
  if (!ok) {
    if (isFeatureNotLicensed(status, text)) {
      return { points: [], httpStatus: status, error: null, softSkip: true }
    }
    return { points: [], httpStatus: status, error: text.slice(0, 500), softSkip: false }
  }
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {}
  const list = Array.isArray(root.locations)
    ? (root.locations as unknown[])
    : Array.isArray(root.data)
      ? (root.data as unknown[])
      : Array.isArray(root.vehicle_locations)
        ? (root.vehicle_locations as unknown[])
        : []
  const points: TelemetryPointNormalized[] = []
  for (const row of list) {
    const o = asRecord(row)
    const ts = pickString(o, ["located_at", "timestamp", "time", "datetime", "created_at"])
    const ms = ts ? parseTimestampMs(ts) : null
    if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
    const lat = pickNum(o, ["lat", "latitude"])
    const lng = pickNum(o, ["lng", "lon", "longitude"])
    if (lat == null || lng == null) continue
    const idRaw = pickString(o, ["id", "uuid"])
    const driver = asRecord(o.driver ?? o.driver_details)
    const driverExt = pickString(driver, ["id", "driver_id", "number"])
    const vehicle = asRecord(o.vehicle ?? o.vehicle_details)
    const truckExt = pickString(vehicle, ["id", "number", "vehicle_id"]) || device.provider_device_id
    points.push({
      truck_external_id: truckExt,
      driver_external_id: driverExt,
      recorded_at: ts ? new Date(parseTimestampMs(ts) ?? ts).toISOString() : new Date(ms ?? until).toISOString(),
      location_lat: lat,
      location_lng: lng,
      speed_mph: pickNum(o, ["speed", "speed_mph", "vehicle_speed_mph"]),
      heading_degrees: pickNum(o, ["bearing", "heading", "course"]),
      engine_on: pickBool(o, ["ignition_on", "engine_on"]),
      odometer_miles: pickNum(o, ["odometer", "vehicle_mileage"]),
      fuel_level_percent: pickNum(o, ["fuel", "fuel_level_percent"]),
      provider_point_id: idRaw ? `motive:${idRaw}` : null,
      raw: o,
    })
  }
  return { points, httpStatus: status, error: null, softSkip: false }
}

export async function syncGeotabTelemetry(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ points: TelemetryPointNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  const auth = await geotabAuthenticate(device)
  if ("error" in auth) {
    return { points: [], httpStatus: 401, error: auth.error, softSkip: false }
  }
  const sessionId = auth.sessionId
  const deviceId = device.provider_device_id.trim()
  const search: Record<string, unknown> = {
    fromDate: since.toISOString(),
    toDate: until.toISOString(),
    deviceSearch: { id: deviceId },
  }
  const ex = await geotabGet<unknown[]>(device, sessionId, "LogRecord", search)
  if (ex.error) {
    if (isFeatureNotLicensed(ex.status, ex.error)) {
      return { points: [], httpStatus: ex.status, error: null, softSkip: true }
    }
    return { points: [], httpStatus: ex.status, error: ex.error, softSkip: false }
  }
  const rows = Array.isArray(ex.result) ? ex.result : []
  const points: TelemetryPointNormalized[] = []
  for (const row of rows) {
    const o = asRecord(row)
    const dt = pickString(o, ["dateTime", "timestamp"])
    const ms = dt ? parseTimestampMs(dt) : null
    if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
    const lat = pickNum(o, ["latitude"])
    const lng = pickNum(o, ["longitude"])
    if (lat == null || lng == null) continue
    const idRaw = pickString(o, ["id"])
    if (!idRaw) continue
    const devObj = asRecord(o.device)
    const truckExt = pickString(devObj, ["id", "name"]) || device.provider_device_id
    const driverObj = asRecord(o.driver)
    const driverExt = pickString(driverObj, ["id"])
    points.push({
      truck_external_id: truckExt,
      driver_external_id: driverExt,
      recorded_at: dt ? new Date(parseTimestampMs(dt) ?? dt).toISOString() : new Date(ms ?? until).toISOString(),
      location_lat: lat,
      location_lng: lng,
      speed_mph: pickNum(o, ["speed"]),
      heading_degrees: null,
      engine_on: null,
      odometer_miles: pickNum(o, ["distance"]),
      fuel_level_percent: null,
      provider_point_id: `geotab:${idRaw}`,
      raw: o,
    })
  }
  return { points, httpStatus: 200, error: null, softSkip: false }
}

const INSERT_CHUNK = 500

export async function persistTelemetryPoints(
  companyId: string,
  device: EldDeviceSyncRow,
  provider: EldProviderCanonical,
  points: TelemetryPointNormalized[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const admin = createAdminClient()
  let inserted = 0
  let skipped = 0
  let errors = 0
  const keys = mappingProviderKeys(device)

  const rows: Array<Record<string, unknown>> = []
  for (const p of points) {
    const truckId = await resolveTruckId(admin, companyId, device, p.truck_external_id)
    const driverId = await resolveDriverId(admin, device, p.driver_external_id, keys)
    const strippedId = p.provider_point_id?.replace(/^(samsara|motive|geotab):/, "") ?? null
    rows.push({
      company_id: companyId,
      truck_id: truckId,
      driver_id: driverId,
      eld_device_id: device.id,
      recorded_at: p.recorded_at,
      location_lat: p.location_lat,
      location_lng: p.location_lng,
      speed_mph: p.speed_mph,
      heading_degrees: p.heading_degrees,
      engine_on: p.engine_on,
      odometer_miles: p.odometer_miles,
      fuel_level_percent: p.fuel_level_percent,
      provider,
      provider_point_id: strippedId,
    })
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await admin.from("eld_telemetry_points").insert(chunk)
    if (!error) {
      inserted += chunk.length
      continue
    }
    for (const row of chunk) {
      const { error: e1 } = await admin.from("eld_telemetry_points").insert(row)
      if (e1) {
        if (e1.code === "23505") skipped += 1
        else {
          errors += 1
          Sentry.captureMessage(`persistTelemetryPoints row: ${e1.message}`, { level: "warning", extra: { companyId } })
        }
      } else {
        inserted += 1
      }
    }
  }
  return { inserted, skipped, errors }
}

export type TelemetrySyncOutcome = {
  httpStatus: number | null
  error: string | null
  softSkip: boolean
  rateLimited: boolean
  inserted: number
  skipped: number
  errors: number
}

export async function syncTelemetryForDevice(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<TelemetrySyncOutcome> {
  const prov = canonicalEldProvider(device.provider)
  if (!prov) {
    return { httpStatus: null, error: "Unsupported provider", softSkip: false, rateLimited: false, inserted: 0, skipped: 0, errors: 0 }
  }
  let pack: { points: TelemetryPointNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }
  if (prov === "samsara") {
    pack = await syncSamsaraTelemetry(device, since, until)
  } else if (prov === "motive") {
    pack = await syncMotiveTelemetry(device, since, until)
  } else {
    pack = await syncGeotabTelemetry(device, since, until)
  }

  if (pack.httpStatus === 429) {
    return { httpStatus: 429, error: null, softSkip: true, rateLimited: true, inserted: 0, skipped: 0, errors: 0 }
  }
  if (pack.softSkip) {
    await clearEldDeviceProviderAuthError(device.id)
    return { httpStatus: pack.httpStatus, error: null, softSkip: true, rateLimited: false, inserted: 0, skipped: 0, errors: 0 }
  }
  if (pack.error) {
    const st = pack.httpStatus
    if (st === 401 || st === 403) {
      await markEldDeviceProviderAuthFailed(device.id, pack.error)
    }
    return { httpStatus: st, error: pack.error, softSkip: false, rateLimited: false, inserted: 0, skipped: 0, errors: 1 }
  }
  await clearEldDeviceProviderAuthError(device.id)
  const persist = await persistTelemetryPoints(device.company_id, device, prov, pack.points)
  return {
    httpStatus: pack.httpStatus,
    error: null,
    softSkip: false,
    rateLimited: false,
    inserted: persist.inserted,
    skipped: persist.skipped,
    errors: persist.errors,
  }
}
