import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { clearEldDeviceProviderAuthError, markEldDeviceProviderAuthFailed } from "@/lib/eld/eld-device-auth-helpers"
import { geotabAuthenticate, geotabGet } from "@/lib/eld/geotab-jsonrpc"
import { parseTimestampMs } from "@/lib/eld/parse-provider-time"
import { canonicalEldProvider, mappingProviderKeys, type EldProviderCanonical } from "@/lib/eld/provider-normalize"
import { fetchDieselPriceForTruckContext } from "@/lib/promiles/eia-diesel"

const CLASS_8_IDLE_GPH = 0.8
const MIN_IDLE_SECONDS = 120

export type IdleSessionNormalized = {
  truck_external_id: string
  driver_external_id: string | null
  started_at: string
  ended_at: string
  duration_seconds: number
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  provider_session_id: string
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

function isFeatureNotLicensed(status: number, bodyText: string): boolean {
  const t = bodyText.toLowerCase()
  if (status === 402) return true
  if (t.includes("not licensed") || t.includes("not entitled")) return true
  return false
}

type Sample = { t: number; engineOn: boolean; speedMph: number; lat: number | null; lng: number | null }

function groupIdleFromSamples(samples: Sample[], vehicleKey: string): IdleSessionNormalized[] {
  const sorted = [...samples].sort((a, b) => a.t - b.t)
  const out: IdleSessionNormalized[] = []
  let runStart: number | null = null
  let runLat: number | null = null
  let runLng: number | null = null

  for (const s of sorted) {
    const idleCandidate = s.engineOn && s.speedMph <= 0.5
    if (idleCandidate) {
      if (runStart == null) {
        runStart = s.t
        runLat = s.lat
        runLng = s.lng
      }
    } else if (runStart != null) {
      const durSec = Math.max(0, Math.round((s.t - runStart) / 1000))
      if (durSec >= MIN_IDLE_SECONDS) {
        out.push({
          truck_external_id: vehicleKey,
          driver_external_id: null,
          started_at: new Date(runStart).toISOString(),
          ended_at: new Date(s.t).toISOString(),
          duration_seconds: durSec,
          location_lat: runLat,
          location_lng: runLng,
          location_address: null,
          provider_session_id: `${vehicleKey}:${runStart}:${s.t}`,
          raw: { method: "sample_grouping", samplesApprox: true },
        })
      }
      runStart = null
      runLat = null
      runLng = null
    }
  }
  return out
}

export async function syncSamsaraIdleSessions(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ sessions: IdleSessionNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  if (!device.api_key) {
    return { sessions: [], httpStatus: null, error: "Samsara API key not configured", softSkip: false }
  }
  const vehicleId = encodeURIComponent(device.provider_device_id)
  const startIso = since.toISOString()
  const endIso = until.toISOString()
  const urls = [
    `https://api.samsara.com/fleet/vehicles/stats/feed?vehicleIds=${vehicleId}&types=engineStates%2Cgps&startTime=${encodeURIComponent(startIso)}&endTime=${encodeURIComponent(endIso)}`,
    `https://api.samsara.com/v2/fleet/vehicles/stats/feed?vehicleIds=${vehicleId}&types=engineStates%2Cgps&startTime=${encodeURIComponent(startIso)}&endTime=${encodeURIComponent(endIso)}`,
  ]
  let res: Response | null = null
  let text = ""
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        headers: { Authorization: `Bearer ${device.api_key}`, Accept: "application/json" },
      })
      res = r
      text = await r.text()
      if (r.ok || r.status !== 404) break
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Samsara stats request failed"
      return { sessions: [], httpStatus: null, error: msg, softSkip: false }
    }
  }
  if (!res) {
    return { sessions: [], httpStatus: null, error: "Samsara stats: no response", softSkip: false }
  }
  if (!res.ok) {
    if (isFeatureNotLicensed(res.status, text)) {
      Sentry.captureMessage(`Samsara idle stats unavailable: device ${device.id}`, { level: "warning" })
      return { sessions: [], httpStatus: res.status, error: null, softSkip: true }
    }
    const locFallback = await fetch(
      `https://api.samsara.com/v2/fleet/vehicles/locations/feed?vehicleIds=${vehicleId}`,
      { headers: { Authorization: `Bearer ${device.api_key}`, Accept: "application/json" } },
    )
    const locText = await locFallback.text()
    if (!locFallback.ok) {
      return { sessions: [], httpStatus: locFallback.status, error: locText.slice(0, 400), softSkip: false }
    }
    let locParsed: { data?: unknown }
    try {
      locParsed = JSON.parse(locText) as { data?: unknown }
    } catch {
      return { sessions: [], httpStatus: locFallback.status, error: "Invalid JSON (locations fallback)", softSkip: false }
    }
    const locRows = Array.isArray(locParsed.data) ? locParsed.data : []
    const samples: Sample[] = []
    for (const row of locRows) {
      const o = asRecord(row)
      const ts = pickString(o, ["time", "timestamp"])
      const ms = ts ? parseTimestampMs(ts) : null
      if (ms == null || ms < since.getTime() || ms > until.getTime()) continue
      const speed = pickNum(o, ["speed", "speedMph"]) ?? 0
      samples.push({
        t: ms,
        engineOn: true,
        speedMph: speed,
        lat: pickNum(o, ["latitude", "lat"]),
        lng: pickNum(o, ["longitude", "lng", "lon"]),
      })
    }
    return {
      sessions: groupIdleFromSamples(samples, device.provider_device_id),
      httpStatus: locFallback.status,
      error: null,
      softSkip: false,
    }
  }
  let parsed: { data?: unknown }
  try {
    parsed = JSON.parse(text) as { data?: unknown }
  } catch {
    return { sessions: [], httpStatus: res.status, error: "Invalid JSON from Samsara stats", softSkip: false }
  }
  const vehicles = Array.isArray(parsed.data) ? parsed.data : []
  const samples: Sample[] = []
  for (const v of vehicles) {
    const vr = asRecord(v)
    const vid = pickString(vr, ["id", "vehicleId"]) || device.provider_device_id
    const engineStates = Array.isArray(vr.engineStates) ? (vr.engineStates as unknown[]) : []
    const gpsArr = Array.isArray(vr.gps) ? (vr.gps as unknown[]) : []
    for (const e of engineStates) {
      const er = asRecord(e)
      const ts = pickString(er, ["time", "timestamp"])
      const ms = ts ? parseTimestampMs(ts) : null
      if (ms == null || ms < since.getTime() || ms > until.getTime()) continue
      const val = String(pickString(er, ["value", "state"]) || "").toLowerCase()
      const engineOn = val.includes("on") || val === "true" || val === "1"
      let speed = 0
      let lat: number | null = null
      let lng: number | null = null
      const nearest = gpsArr
        .map((g) => asRecord(g))
        .map((g) => {
          const gt = pickString(g, ["time", "timestamp"])
          const gms = gt ? parseTimestampMs(gt) : null
          return { gms, g }
        })
        .filter((x): x is { gms: number; g: Record<string, unknown> } => x.gms != null)
        .sort((a, b) => Math.abs(a.gms - ms) - Math.abs(b.gms - ms))[0]
      if (nearest) {
        speed = pickNum(nearest.g, ["speedMph", "speed"]) ?? 0
        lat = pickNum(nearest.g, ["latitude", "lat"])
        lng = pickNum(nearest.g, ["longitude", "lng", "lon"])
      }
      samples.push({ t: ms, engineOn, speedMph: speed, lat, lng })
    }
  }
  return {
    sessions: groupIdleFromSamples(samples, device.provider_device_id),
    httpStatus: res.status,
    error: null,
    softSkip: false,
  }
}

async function fetchMotiveJson(path: string, device: EldDeviceSyncRow) {
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

export async function syncMotiveIdleSessions(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ sessions: IdleSessionNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  if (!device.api_key || !device.api_secret) {
    return { sessions: [], httpStatus: null, error: "Motive credentials missing", softSkip: false }
  }
  const dev = encodeURIComponent(device.provider_device_id)
  const sinceSec = Math.floor(since.getTime() / 1000)
  const untilSec = Math.floor(until.getTime() / 1000)
  const path = `/v2/vehicle_locations?vehicle_id=${dev}&start_time=${sinceSec}&end_time=${untilSec}`
  const { ok, status, json, text } = await fetchMotiveJson(path, device)
  if (!ok) {
    if (isFeatureNotLicensed(status, text)) {
      return { sessions: [], httpStatus: status, error: null, softSkip: true }
    }
    return { sessions: [], httpStatus: status, error: text.slice(0, 500), softSkip: false }
  }
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {}
  const locs = Array.isArray(root.vehicle_locations)
    ? (root.vehicle_locations as unknown[])
    : Array.isArray(root.locations)
      ? (root.locations as unknown[])
      : Array.isArray(root.data)
        ? (root.data as unknown[])
        : []

  const samples: Sample[] = []
  for (const row of locs) {
    const o = asRecord(row)
    const ts = pickString(o, ["located_at", "timestamp", "time", "created_at"])
    const ms = ts ? parseTimestampMs(ts) : null
    if (ms == null || ms < since.getTime() || ms > until.getTime()) continue
    const speed = pickNum(o, ["speed", "speed_mph"]) ?? 0
    const staleMs = 5 * 60 * 1000
    const fresh = until.getTime() - ms <= staleMs
    samples.push({
      t: ms,
      engineOn: fresh,
      speedMph: speed,
      lat: pickNum(o, ["lat", "latitude"]),
      lng: pickNum(o, ["lng", "lon", "longitude"]),
    })
  }
  return {
    sessions: groupIdleFromSamples(samples, device.provider_device_id),
    httpStatus: status,
    error: null,
    softSkip: false,
  }
}

export async function syncGeotabIdleSessions(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ sessions: IdleSessionNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  const auth = await geotabAuthenticate(device)
  if ("error" in auth) {
    return { sessions: [], httpStatus: 401, error: auth.error, softSkip: false }
  }
  const sessionId = auth.sessionId
  const search: Record<string, unknown> = {
    fromDate: since.toISOString(),
    toDate: until.toISOString(),
  }
  if (device.provider_device_id.trim()) {
    search.deviceSearch = { id: device.provider_device_id.trim() }
  }
  const statusRows = await geotabGet<unknown[]>(device, sessionId, "StatusData", search)
  if (statusRows.error) {
    if (isFeatureNotLicensed(statusRows.status, statusRows.error)) {
      return { sessions: [], httpStatus: statusRows.status, error: null, softSkip: true }
    }
    return { sessions: [], httpStatus: statusRows.status, error: statusRows.error, softSkip: false }
  }
  const rows = Array.isArray(statusRows.result) ? statusRows.result : []
  const sessions: IdleSessionNormalized[] = []
  for (const row of rows) {
    const o = asRecord(row)
    const diag = asRecord(o.diagnostic)
    const dname = String(pickString(diag, ["name", "id"]) || "").toLowerCase()
    if (!dname.includes("idle") && !dname.includes("idling")) continue
    const dt = pickString(o, ["dateTime", "start", "activeFrom"])
    const ms = dt ? parseTimestampMs(dt) : null
    if (ms == null || ms < since.getTime() || ms > until.getTime()) continue
    const rawVal = o.data ?? o.value
    let idleSec = 0
    if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      idleSec = rawVal > 1000 ? Math.round(rawVal / 1000) : Math.round(rawVal)
    } else if (typeof rawVal === "string") {
      const n = parseFloat(rawVal)
      idleSec = Number.isFinite(n) ? Math.round(n > 1000 ? n / 1000 : n) : 0
    }
    if (idleSec < MIN_IDLE_SECONDS) continue
    const dev = asRecord(o.device)
    const truckExt = pickString(dev, ["id"]) || device.provider_device_id
    const drv = asRecord(o.driver)
    const driverExt = pickString(drv, ["id"])
    const lat = pickNum(o, ["latitude"])
    const lng = pickNum(o, ["longitude"])
    const idRaw = pickString(o, ["id"]) || `${truckExt}-${ms}`
    const endMs = ms + idleSec * 1000
    sessions.push({
      truck_external_id: truckExt,
      driver_external_id: driverExt,
      started_at: new Date(ms).toISOString(),
      ended_at: new Date(endMs).toISOString(),
      duration_seconds: idleSec,
      location_lat: lat,
      location_lng: lng,
      location_address: null,
      provider_session_id: `geotab:idle:${idRaw}`,
      raw: o,
    })
  }
  return { sessions, httpStatus: 200, error: null, softSkip: false }
}

async function resolveTruckId(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  device: EldDeviceSyncRow,
  truckExternalId: string,
): Promise<string | null> {
  const ext = String(truckExternalId || "").trim()
  if (!ext) return device.truck_id ?? null
  if (device.truck_id && ext === String(device.provider_device_id || "").trim()) {
    return device.truck_id
  }
  const { data } = await admin
    .from("eld_devices")
    .select("truck_id")
    .eq("company_id", companyId)
    .eq("provider_device_id", ext)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()
  const tid = (data as { truck_id?: string | null } | null)?.truck_id
  return tid ?? device.truck_id ?? null
}

async function resolveDriverId(
  admin: ReturnType<typeof createAdminClient>,
  device: EldDeviceSyncRow,
  driverExternalId: string | null,
  providerKeys: string[],
): Promise<string | null> {
  if (!driverExternalId?.trim()) return device.driver_id ?? null
  const pid = driverExternalId.trim()
  const { data } = await admin
    .from("eld_driver_mappings")
    .select("internal_driver_id")
    .eq("eld_device_id", device.id)
    .in("provider", providerKeys)
    .eq("provider_driver_id", pid)
    .eq("is_active", true)
    .maybeSingle()
  const did = (data as { internal_driver_id?: string } | null)?.internal_driver_id
  return did ?? device.driver_id ?? null
}

export async function persistIdleSessions(
  companyId: string,
  device: EldDeviceSyncRow,
  provider: EldProviderCanonical,
  sessions: IdleSessionNormalized[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const admin = createAdminClient()
  const eiaKey = process.env.EIA_API_KEY
  let inserted = 0
  let skipped = 0
  let errors = 0
  const keys = mappingProviderKeys(device)

  for (const s of sessions) {
    const truckId = await resolveTruckId(admin, companyId, device, s.truck_external_id)
    const driverId = await resolveDriverId(admin, device, s.driver_external_id, keys)
    let regState: string | null = null
    if (truckId) {
      const { data: tr } = await admin.from("trucks").select("registration_state, license_state").eq("id", truckId).maybeSingle()
      const row = tr as { registration_state?: string | null; license_state?: string | null } | null
      regState = row?.registration_state || row?.license_state || null
    }
    const { pricePerGallon } = await fetchDieselPriceForTruckContext({
      apiKey: eiaKey,
      registrationState: regState,
    })
    const gallons = (s.duration_seconds / 3600) * CLASS_8_IDLE_GPH
    const costUsd = Math.round(gallons * pricePerGallon * 100) / 100
    const strippedId = s.provider_session_id.replace(/^(samsara|motive|geotab):/, "")
    const row = {
      company_id: companyId,
      truck_id: truckId,
      driver_id: driverId,
      eld_device_id: device.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_seconds: s.duration_seconds,
      location_lat: s.location_lat,
      location_lng: s.location_lng,
      location_address: s.location_address,
      estimated_fuel_gallons: Math.round(gallons * 1000) / 1000,
      estimated_fuel_cost_usd: costUsd,
      provider,
      provider_session_id: strippedId,
      raw_payload: s.raw,
    }
    const { error } = await admin.from("eld_idle_sessions").insert(row)
    if (error) {
      if (error.code === "23505") {
        skipped += 1
      } else {
        errors += 1
        Sentry.captureMessage(`persistIdleSessions: ${error.message}`, { level: "warning", extra: { companyId } })
      }
    } else {
      inserted += 1
    }
  }
  return { inserted, skipped, errors }
}

export type IdleSyncOutcome = {
  httpStatus: number | null
  error: string | null
  softSkip: boolean
  rateLimited: boolean
  inserted: number
  skipped: number
  errors: number
}

export async function syncIdleSessionsForDevice(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<IdleSyncOutcome> {
  const prov = canonicalEldProvider(device.provider)
  if (!prov) {
    return { httpStatus: null, error: "Unsupported provider", softSkip: false, rateLimited: false, inserted: 0, skipped: 0, errors: 0 }
  }
  let pack: { sessions: IdleSessionNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }
  if (prov === "samsara") {
    pack = await syncSamsaraIdleSessions(device, since, until)
  } else if (prov === "motive") {
    pack = await syncMotiveIdleSessions(device, since, until)
  } else {
    pack = await syncGeotabIdleSessions(device, since, until)
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
  const persist = await persistIdleSessions(device.company_id, device, prov, pack.sessions)
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
