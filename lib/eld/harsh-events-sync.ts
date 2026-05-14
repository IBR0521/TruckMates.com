import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { clearEldDeviceProviderAuthError, markEldDeviceProviderAuthFailed } from "@/lib/eld/eld-device-auth-helpers"
import { geotabAuthenticate, geotabGet } from "@/lib/eld/geotab-jsonrpc"
import { parseTimestampMs } from "@/lib/eld/parse-provider-time"
import { canonicalEldProvider, mappingProviderKeys, type EldProviderCanonical } from "@/lib/eld/provider-normalize"

export type HarshEventNormalized = {
  truck_external_id: string
  driver_external_id: string | null
  event_type:
    | "harsh_brake"
    | "harsh_acceleration"
    | "harsh_cornering"
    | "speeding"
    | "mobile_usage"
    | "seatbelt_violation"
    | "following_distance"
    | "rolling_stop"
    | "other"
  severity: "low" | "medium" | "high" | "critical"
  occurred_at: string
  location_lat: number | null
  location_lng: number | null
  speed_mph: number | null
  speed_limit_mph: number | null
  g_force: number | null
  duration_seconds: number | null
  provider_event_id: string
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
  if (t.includes("not licensed") || t.includes("not entitled") || t.includes("subscription")) return true
  if (t.includes("permission") && t.includes("safety")) return true
  return false
}

function mapSamsaraSeverity(raw: string | null | undefined): HarshEventNormalized["severity"] {
  const s = String(raw || "").toLowerCase()
  if (s.includes("critical") || s.includes("severe")) return "critical"
  if (s.includes("high")) return "high"
  if (s.includes("low")) return "low"
  return "medium"
}

function mapSamsaraEventType(raw: string | null | undefined): HarshEventNormalized["event_type"] {
  const t = String(raw || "").replace(/\s+/g, "")
  const k = t.toLowerCase()
  if (k.includes("harshbrake") || k === "harsh_brake") return "harsh_brake"
  if (k.includes("harshaccel") || k === "harsh_acceleration" || k.includes("hardaccel")) return "harsh_acceleration"
  if (k.includes("harshturn") || k.includes("harssharp") || k === "harsh_cornering") return "harsh_cornering"
  if (k.includes("speed")) return "speeding"
  if (k.includes("mobile") || k.includes("distract")) return "mobile_usage"
  if (k.includes("seat")) return "seatbelt_violation"
  if (k.includes("following") || k.includes("tailgating")) return "following_distance"
  if (k.includes("rolling") || k.includes("stop")) return "rolling_stop"
  return "other"
}

export async function syncSamsaraHarshEvents(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ events: HarshEventNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  if (!device.api_key) {
    return { events: [], httpStatus: null, error: "Samsara API key not configured", softSkip: false }
  }
  const vehicleId = encodeURIComponent(device.provider_device_id)
  const baseUrl = "https://api.samsara.com"
  const startIso = since.toISOString()
  const endIso = until.toISOString()
  const url = `${baseUrl}/v2/fleet/safety/events?vehicleIds=${vehicleId}&startTime=${encodeURIComponent(startIso)}&endTime=${encodeURIComponent(endIso)}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${device.api_key}`,
        Accept: "application/json",
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Samsara request failed"
    return { events: [], httpStatus: null, error: msg, softSkip: false }
  }
  const text = await res.text()
  if (!res.ok) {
    if (isFeatureNotLicensed(res.status, text)) {
      Sentry.captureMessage(`Samsara safety events unavailable (plan/add-on): device ${device.id}`, { level: "warning" })
      return { events: [], httpStatus: res.status, error: null, softSkip: true }
    }
    return { events: [], httpStatus: res.status, error: text.slice(0, 500), softSkip: false }
  }
  let parsed: { data?: unknown }
  try {
    parsed = JSON.parse(text) as { data?: unknown }
  } catch {
    return { events: [], httpStatus: res.status, error: "Invalid JSON from Samsara", softSkip: false }
  }
  const rows = Array.isArray(parsed.data) ? parsed.data : []
  const events: HarshEventNormalized[] = []
  for (const row of rows) {
    const o = asRecord(row)
    const timeRaw = pickString(o, ["time", "timestamp", "eventTime", "occurredAt", "startTime"])
    const ms = timeRaw ? parseTimestampMs(timeRaw) : null
    if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
    const typeRaw = pickString(o, ["safetyEventType", "eventType", "type", "name"])
    const severityRaw = pickString(o, ["severity", "riskLevel", "level"])
    const idRaw = pickString(o, ["id", "safetyEventId", "uuid"])
    if (!idRaw) continue
    const loc = asRecord(o.location ?? o.coordinates)
    const lat = pickNum(loc, ["latitude", "lat"])
    const lng = pickNum(loc, ["longitude", "lng", "lon"])
    const vehicle = asRecord(o.vehicle)
    const truckExt = pickString(vehicle, ["id", "externalIds", "serial"]) || device.provider_device_id
    const driverObj = asRecord(o.driver ?? o.driverInfo)
    const driverExt = pickString(driverObj, ["id", "driverId", "name"])
    events.push({
      truck_external_id: truckExt || device.provider_device_id,
      driver_external_id: driverExt,
      event_type: mapSamsaraEventType(typeRaw),
      severity: mapSamsaraSeverity(severityRaw),
      occurred_at: timeRaw ? new Date(parseTimestampMs(timeRaw) ?? timeRaw).toISOString() : new Date(ms ?? until).toISOString(),
      location_lat: lat,
      location_lng: lng,
      speed_mph: pickNum(o, ["speedMph", "vehicleSpeedMph", "speed"]),
      speed_limit_mph: pickNum(o, ["speedLimitMph", "postedSpeedLimitMph"]),
      g_force: pickNum(o, ["gForce", "gforce", "accelGForce"]),
      duration_seconds: (() => {
        const n = pickNum(o, ["durationMs", "duration"])
        if (n == null) return null
        if (n > 1000) return Math.round(n / 1000)
        return Math.round(n)
      })(),
      provider_event_id: `samsara:${idRaw}`,
      raw: o,
    })
  }
  return { events, httpStatus: res.status, error: null, softSkip: false }
}

function mapMotiveType(raw: string | null | undefined): HarshEventNormalized["event_type"] {
  const k = String(raw || "").toLowerCase().replace(/\s+/g, "_")
  if (k.includes("hard_brake") || k.includes("hardbrake")) return "harsh_brake"
  if (k.includes("hard_accel") || k.includes("hardaccel")) return "harsh_acceleration"
  if (k.includes("hard_turn") || k.includes("hardturn") || k.includes("hard_corner")) return "harsh_cornering"
  if (k.includes("speed")) return "speeding"
  return "other"
}

function mapMotiveSeverity(raw: string | null | undefined): HarshEventNormalized["severity"] {
  return mapSamsaraSeverity(raw)
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

export async function syncMotiveHarshEvents(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ events: HarshEventNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  if (!device.api_key || !device.api_secret) {
    return { events: [], httpStatus: null, error: "Motive API credentials not configured", softSkip: false }
  }
  const dev = encodeURIComponent(device.provider_device_id)
  const sinceSec = Math.floor(since.getTime() / 1000)
  const untilSec = Math.floor(until.getTime() / 1000)

  const v2Path = `/v2/driver_performance_events?vehicle_id=${dev}&start_time=${sinceSec}&end_time=${untilSec}`
  let { ok, status, json, text } = await fetchMotiveJson(v2Path, device)

  let list: unknown[] = []
  if (ok && json && typeof json === "object") {
    const r = json as Record<string, unknown>
    list = Array.isArray(r.driver_performance_events)
      ? (r.driver_performance_events as unknown[])
      : Array.isArray(r.events)
        ? (r.events as unknown[])
        : Array.isArray(r.data)
          ? (r.data as unknown[])
          : []
  }

  if (!ok || list.length === 0) {
    const v1Path = `/v1/safety_events?device_id=${dev}`
    const fallback = await fetchMotiveJson(v1Path, device)
    if (!fallback.ok) {
      if (isFeatureNotLicensed(fallback.status, fallback.text)) {
        Sentry.captureMessage(`Motive driver performance / safety unavailable: device ${device.id}`, { level: "warning" })
        return { events: [], httpStatus: fallback.status, error: null, softSkip: true }
      }
      return { events: [], httpStatus: fallback.status, error: fallback.text.slice(0, 500), softSkip: false }
    }
    const fj = fallback.json
    if (fj && typeof fj === "object") {
      const r = fj as Record<string, unknown>
      list = Array.isArray(r.safety_events) ? (r.safety_events as unknown[]) : Array.isArray(r.events) ? (r.events as unknown[]) : []
    }
    ok = fallback.ok
    status = fallback.status
    text = fallback.text
    json = fallback.json
  }

  if (!ok) {
    if (isFeatureNotLicensed(status, text)) {
      return { events: [], httpStatus: status, error: null, softSkip: true }
    }
    return { events: [], httpStatus: status, error: text.slice(0, 500), softSkip: false }
  }

  const events: HarshEventNormalized[] = []
  for (const row of list) {
    const o = asRecord(row)
    const ts = pickString(o, ["start_time", "event_time", "datetime", "occurred_at", "timestamp", "time"])
    const ms = ts ? parseTimestampMs(ts) : null
    if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
    const idRaw = pickString(o, ["id", "event_id", "identifier"])
    const typeRaw = pickString(o, ["type", "event_type", "performance_event_type", "name"])
    const sevRaw = pickString(o, ["severity", "risk_level"])
    const driver = asRecord(o.driver ?? o.driver_details)
    const driverExt = pickString(driver, ["id", "driver_id", "number"])
    const vehicle = asRecord(o.vehicle ?? o.vehicle_details)
    const truckExt = pickString(vehicle, ["id", "number", "vehicle_id"]) || device.provider_device_id
    const lat = pickNum(o, ["lat", "latitude"])
    const lng = pickNum(o, ["lon", "lng", "longitude"])
    if (!idRaw) continue
    events.push({
      truck_external_id: truckExt,
      driver_external_id: driverExt,
      event_type: mapMotiveType(typeRaw),
      severity: mapMotiveSeverity(sevRaw),
      occurred_at: ts ? new Date(parseTimestampMs(ts) ?? ts).toISOString() : new Date(ms ?? until).toISOString(),
      location_lat: lat,
      location_lng: lng,
      speed_mph: pickNum(o, ["speed_mph", "vehicle_speed_mph"]),
      speed_limit_mph: pickNum(o, ["speed_limit_mph"]),
      g_force: pickNum(o, ["g_force", "gforce"]),
      duration_seconds: (() => {
        const n = pickNum(o, ["duration_sec", "duration_seconds", "duration"])
        if (n == null) return null
        if (n > 10_000) return Math.round(n / 1000)
        return Math.round(n)
      })(),
      provider_event_id: `motive:${idRaw}`,
      raw: o,
    })
  }
  return { events, httpStatus: status, error: null, softSkip: false }
}

function mapGeotabRuleToEvent(ruleName: string): HarshEventNormalized["event_type"] {
  const n = ruleName.toLowerCase()
  if (n.includes("brake") || n.includes("braking")) return "harsh_brake"
  if (n.includes("accel")) return "harsh_acceleration"
  if (n.includes("corner") || n.includes("turn")) return "harsh_cornering"
  if (n.includes("speed")) return "speeding"
  if (n.includes("seat")) return "seatbelt_violation"
  return "other"
}

export async function syncGeotabHarshEvents(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<{ events: HarshEventNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }> {
  const auth = await geotabAuthenticate(device)
  if ("error" in auth) {
    return { events: [], httpStatus: 401, error: auth.error, softSkip: false }
  }
  const sessionId = auth.sessionId
  const fromDate = since.toISOString()
  const toDate = until.toISOString()
  const deviceId = device.provider_device_id.trim()
  const search: Record<string, unknown> = {
    fromDate,
    toDate,
  }
  if (deviceId) {
    search.deviceSearch = { id: deviceId }
  }

  const ex = await geotabGet<unknown[]>(device, sessionId, "ExceptionEvent", search)
  if (ex.error) {
    if (isFeatureNotLicensed(ex.status, ex.error)) {
      return { events: [], httpStatus: ex.status, error: null, softSkip: true }
    }
    return { events: [], httpStatus: ex.status, error: ex.error, softSkip: false }
  }
  const rows = Array.isArray(ex.result) ? ex.result : []
  const ruleCache = new Map<string, string>()

  async function ruleNameFor(id: string | null): Promise<string> {
    if (!id) return ""
    if (ruleCache.has(id)) return ruleCache.get(id) || ""
    const rule = await geotabGet<unknown>(device, sessionId, "Rule", { id })
    const res = rule.result
    const rec = res && typeof res === "object" && !Array.isArray(res) ? (res as Record<string, unknown>) : null
    const arr = Array.isArray(res) ? (res as unknown[])[0] : null
    const obj = rec ?? (arr && typeof arr === "object" ? (arr as Record<string, unknown>) : null)
    const name = obj ? pickString(obj, ["name"]) : null
    const n = name || ""
    ruleCache.set(id, n)
    return n
  }

  const events: HarshEventNormalized[] = []
  for (const row of rows) {
    const o = asRecord(row)
    const dt = pickString(o, ["activeFrom", "dateTime", "start", "startDate"])
    const ms = dt ? parseTimestampMs(dt) : null
    if (ms != null && (ms < since.getTime() || ms > until.getTime())) continue
    const rule = asRecord(o.rule)
    const ruleId = pickString(rule, ["id"])
    const rn = ruleId ? await ruleNameFor(ruleId) : pickString(rule, ["name"]) || ""
    if (!rn && !ruleId) continue
    const mapped = mapGeotabRuleToEvent(rn || "")
    if (mapped === "other" && rn && !/(harsh|hard|speed|brake|accel|corner|belt)/i.test(rn)) {
      continue
    }
    const idRaw = pickString(o, ["id"])
    if (!idRaw) continue
    const deviceObj = asRecord(o.device)
    const truckExt = pickString(deviceObj, ["id", "name"]) || device.provider_device_id
    const driverObj = asRecord(o.driver)
    const driverExt = pickString(driverObj, ["id"])
    const lat = pickNum(o, ["latitude"])
    const lng = pickNum(o, ["longitude"])
    events.push({
      truck_external_id: truckExt,
      driver_external_id: driverExt,
      event_type: mapped,
      severity: "medium",
      occurred_at: dt ? new Date(parseTimestampMs(dt) ?? dt).toISOString() : new Date(ms ?? until).toISOString(),
      location_lat: lat,
      location_lng: lng,
      speed_mph: null,
      speed_limit_mph: null,
      g_force: null,
      duration_seconds: null,
      provider_event_id: `geotab:${idRaw}`,
      raw: o,
    })
  }
  return { events, httpStatus: 200, error: null, softSkip: false }
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

export async function persistHarshEvents(
  companyId: string,
  device: EldDeviceSyncRow,
  provider: EldProviderCanonical,
  events: HarshEventNormalized[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const admin = createAdminClient()
  let inserted = 0
  let skipped = 0
  let errors = 0
  const keys = mappingProviderKeys(device)

  for (const ev of events) {
    const truckId = await resolveTruckId(admin, companyId, device, ev.truck_external_id)
    const driverId = await resolveDriverId(admin, device, ev.driver_external_id, keys)
    const strippedId = ev.provider_event_id.replace(/^(samsara|motive|geotab):/, "")
    const row = {
      company_id: companyId,
      truck_id: truckId,
      driver_id: driverId,
      eld_device_id: device.id,
      event_type: ev.event_type,
      severity: ev.severity,
      occurred_at: ev.occurred_at,
      location_lat: ev.location_lat,
      location_lng: ev.location_lng,
      location_address: null as string | null,
      speed_mph: ev.speed_mph,
      speed_limit_mph: ev.speed_limit_mph,
      g_force: ev.g_force,
      duration_seconds: ev.duration_seconds,
      provider,
      provider_event_id: strippedId,
      raw_payload: ev.raw,
    }
    const { error } = await admin.from("eld_harsh_events").insert(row)
    if (error) {
      if (error.code === "23505") {
        skipped += 1
      } else {
        errors += 1
        Sentry.captureMessage(`persistHarshEvents insert: ${error.message}`, { level: "warning", extra: { companyId } })
      }
    } else {
      inserted += 1
    }
  }
  return { inserted, skipped, errors }
}

export type HarshSyncOutcome = {
  httpStatus: number | null
  error: string | null
  softSkip: boolean
  rateLimited: boolean
  inserted: number
  skipped: number
  errors: number
}

export async function syncHarshEventsForDevice(
  device: EldDeviceSyncRow,
  since: Date,
  until: Date,
): Promise<HarshSyncOutcome> {
  const prov = canonicalEldProvider(device.provider)
  if (!prov) {
    return { httpStatus: null, error: "Unsupported provider", softSkip: false, rateLimited: false, inserted: 0, skipped: 0, errors: 0 }
  }
  let pack: { events: HarshEventNormalized[]; httpStatus: number | null; error: string | null; softSkip: boolean }
  if (prov === "samsara") {
    pack = await syncSamsaraHarshEvents(device, since, until)
  } else if (prov === "motive") {
    pack = await syncMotiveHarshEvents(device, since, until)
  } else {
    pack = await syncGeotabHarshEvents(device, since, until)
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
  const persist = await persistHarshEvents(device.company_id, device, prov, pack.events)
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
