/**
 * Sync ECM fault codes from ELD providers into eld_fault_codes.
 * Provider formats vary — codes are normalized before translation lookup.
 * Also ingests recent rows from eld_diagnostics when API fault feeds are empty.
 */

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeDbError } from "@/lib/utils/error"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { clearEldDeviceProviderAuthError, markEldDeviceProviderAuthFailed } from "@/lib/eld/eld-device-auth-helpers"
import { geotabAuthenticate, geotabGet } from "@/lib/eld/geotab-jsonrpc"
import { parseTimestampMs } from "@/lib/eld/parse-provider-time"
import { canonicalEldProvider, mappingProviderKeys, type EldProviderCanonical } from "@/lib/eld/provider-normalize"
import { resolveDriverId, resolveTruckId } from "@/lib/eld/harsh-events-sync"
import {
  detectCodeProtocol,
  lookupDtcTranslation,
  normalizeFaultCode,
} from "@/lib/eld/fault-code-translations"
import { handleNewFaultCode, type FaultCodeRow } from "@/lib/eld/fault-code-actions"
import { hasFeatureAccess } from "@/lib/plan-limits"
import { getCompanyTier } from "@/lib/plan-enforcement"

export type FaultCodeNormalized = {
  truck_external_id: string
  driver_external_id: string | null
  code: string
  code_protocol: "OBD2" | "J1939" | "J1708" | "manufacturer" | "unknown"
  first_seen_at: string
  last_seen_at: string
  location_lat: number | null
  location_lng: number | null
  is_active: boolean
  provider_fault_id: string
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

function isFeatureNotLicensed(status: number, bodyText: string): boolean {
  const t = bodyText.toLowerCase()
  if (status === 402) return true
  if (t.includes("not licensed") || t.includes("not entitled")) return true
  return false
}

async function fetchMotiveJson(
  path: string,
  device: EldDeviceSyncRow,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const headers: Record<string, string> = {
    "X-Api-Key": device.api_key || "",
    "X-Api-Secret": device.api_secret || "",
    Accept: "application/json",
  }
  let res = await fetch(`https://api.gomotive.com${path}`, { headers })
  if (!res.ok && res.status === 404) {
    res = await fetch(`https://api.keeptruckin.com${path}`, { headers })
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

export async function syncSamsaraFaultCodes(
  device: EldDeviceSyncRow,
  since: Date,
): Promise<{ codes: FaultCodeNormalized[]; error: string | null; softSkip: boolean }> {
  if (!device.api_key) {
    return { codes: [], error: "Samsara API key not configured", softSkip: false }
  }
  const vehicleId = encodeURIComponent(device.provider_device_id)
  const url = `https://api.samsara.com/fleet/vehicles/stats?vehicleIds=${vehicleId}&types=faultCodes`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${device.api_key}`, Accept: "application/json" },
    })
  } catch (e: unknown) {
    return { codes: [], error: e instanceof Error ? e.message : "Samsara fault request failed", softSkip: false }
  }
  const text = await res.text()
  if (!res.ok) {
    if (isFeatureNotLicensed(res.status, text)) {
      return { codes: [], error: null, softSkip: true }
    }
    return { codes: [], error: `Samsara fault codes HTTP ${res.status}`, softSkip: false }
  }
  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    return { codes: [], error: "Invalid Samsara JSON", softSkip: false }
  }
  const root = asRecord(json)
  const data = Array.isArray(root.data) ? root.data : []
  const codes: FaultCodeNormalized[] = []
  const now = new Date().toISOString()
  for (const item of data) {
    const row = asRecord(item)
    const faultList = Array.isArray(row.faultCodes)
      ? row.faultCodes
      : Array.isArray(row.fault_codes)
        ? row.fault_codes
        : []
    for (const fc of faultList) {
      const f = asRecord(fc)
      const rawCode = pickString(f, ["code", "faultCode", "id", "dtcCode"])
      if (!rawCode) continue
      const code = normalizeFaultCode(rawCode)
      const ts =
        pickString(f, ["time", "timestamp", "reportedAt"]) ||
        pickString(row, ["time", "timestamp"]) ||
        now
      codes.push({
        truck_external_id: device.provider_device_id,
        driver_external_id: null,
        code,
        code_protocol: detectCodeProtocol(code),
        first_seen_at: ts,
        last_seen_at: ts,
        location_lat: null,
        location_lng: null,
        is_active: true,
        provider_fault_id: pickString(f, ["id", "code"]) || `${code}-${ts}`,
        raw: f,
      })
    }
  }
  if (codes.length === 0 && since.getTime() < Date.now() - 60000) {
    return syncSamsaraFaultCodesFromHistory(device, since)
  }
  return { codes, error: null, softSkip: false }
}

async function syncSamsaraFaultCodesFromHistory(
  device: EldDeviceSyncRow,
  since: Date,
): Promise<{ codes: FaultCodeNormalized[]; error: string | null; softSkip: boolean }> {
  const vehicleId = encodeURIComponent(device.provider_device_id)
  const url = `https://api.samsara.com/fleet/vehicles/stats/history?vehicleIds=${vehicleId}&types=faultCodes&startTime=${encodeURIComponent(
    since.toISOString(),
  )}&endTime=${encodeURIComponent(new Date().toISOString())}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${device.api_key}`, Accept: "application/json" },
  })
  const text = await res.text()
  if (!res.ok) return { codes: [], error: null, softSkip: true }
  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    return { codes: [], error: null, softSkip: true }
  }
  const root = asRecord(json)
  const data = Array.isArray(root.data) ? root.data : []
  const codes: FaultCodeNormalized[] = []
  for (const item of data) {
    const row = asRecord(item)
    const faultList = Array.isArray(row.faultCodes) ? row.faultCodes : []
    for (const fc of faultList) {
      const f = asRecord(fc)
      const rawCode = pickString(f, ["code", "faultCode", "id"])
      if (!rawCode) continue
      const code = normalizeFaultCode(rawCode)
      const ts = pickString(f, ["time", "timestamp"]) || new Date().toISOString()
      codes.push({
        truck_external_id: device.provider_device_id,
        driver_external_id: null,
        code,
        code_protocol: detectCodeProtocol(code),
        first_seen_at: ts,
        last_seen_at: ts,
        location_lat: null,
        location_lng: null,
        is_active: true,
        provider_fault_id: pickString(f, ["id", "code"]) || code,
        raw: f,
      })
    }
  }
  return { codes, error: null, softSkip: false }
}

export async function syncMotiveFaultCodes(
  device: EldDeviceSyncRow,
  since: Date,
): Promise<{ codes: FaultCodeNormalized[]; error: string | null; softSkip: boolean }> {
  const start = since.toISOString()
  const end = new Date().toISOString()
  const path = `/v1/diagnostic_events?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}&per_page=100`
  const { ok, status, json, text } = await fetchMotiveJson(path, device)
  if (!ok) {
    if (isFeatureNotLicensed(status, text)) return { codes: [], error: null, softSkip: true }
    return { codes: [], error: `Motive diagnostics HTTP ${status}`, softSkip: false }
  }
  const root = asRecord(json)
  const events = Array.isArray(root.diagnostic_events)
    ? root.diagnostic_events
    : Array.isArray(root.events)
      ? root.events
      : []
  const codes: FaultCodeNormalized[] = []
  for (const ev of events) {
    const e = asRecord(ev)
    const type = pickString(e, ["type", "event_type", "diagnostic_type"]) || ""
    if (!type.toLowerCase().includes("fault") && !pickString(e, ["fault_code", "code", "dtc"])) continue
    const rawCode = pickString(e, ["fault_code", "code", "dtc", "diagnostic_code"])
    if (!rawCode) continue
    const code = normalizeFaultCode(rawCode)
    const ts = pickString(e, ["start_time", "occurred_at", "time"]) || end
    codes.push({
      truck_external_id: pickString(e, ["vehicle_id", "truck_id"]) || device.provider_device_id,
      driver_external_id: pickString(e, ["driver_id"]),
      code,
      code_protocol: detectCodeProtocol(code),
      first_seen_at: ts,
      last_seen_at: ts,
      location_lat: null,
      location_lng: null,
      is_active: pickString(e, ["status"])?.toLowerCase() !== "cleared",
      provider_fault_id: pickString(e, ["id"]) || `${code}-${ts}`,
      raw: e,
    })
  }
  return { codes, error: null, softSkip: false }
}

export async function syncGeotabFaultCodes(
  device: EldDeviceSyncRow,
  since: Date,
): Promise<{ codes: FaultCodeNormalized[]; error: string | null; softSkip: boolean }> {
  const auth = await geotabAuthenticate(device)
  if ("error" in auth) {
    await markEldDeviceProviderAuthFailed(device.id, auth.error)
    return { codes: [], error: auth.error, softSkip: false }
  }
  await clearEldDeviceProviderAuthError(device.id)
  const search = {
    fromDate: since.toISOString(),
    deviceSearch: { id: device.provider_device_id },
  }
  const result = await geotabGet<unknown[]>(device, auth.sessionId, "FaultData", search)
  if (result.error) {
    return { codes: [], error: result.error, softSkip: false }
  }
  const rows = Array.isArray(result.result) ? result.result : []
  const codes: FaultCodeNormalized[] = []
  for (const item of rows) {
    const f = asRecord(item)
    const spn = f.suspectParameterNumber ?? f.SuspectParameterNumber
    const fmi = f.failureModeIdentifier ?? f.FailureModeIdentifier
    let rawCode = pickString(f, ["diagnosticCode", "code", "faultCode"])
    if (spn != null && fmi != null) {
      rawCode = `SPN-${spn}-FMI-${fmi}`
    }
    if (!rawCode) continue
    const code = normalizeFaultCode(rawCode)
    const tsMs = parseTimestampMs(f.dateTime ?? f.DateTime ?? f.activeFrom)
    const ts = tsMs ? new Date(tsMs).toISOString() : new Date().toISOString()
    const dismissMs = parseTimestampMs(f.dismissDateTime ?? f.DismissDateTime)
    const isActive = dismissMs == null || dismissMs > Date.now()
    codes.push({
      truck_external_id: device.provider_device_id,
      driver_external_id: null,
      code,
      code_protocol: detectCodeProtocol(code),
      first_seen_at: ts,
      last_seen_at: ts,
      location_lat: null,
      location_lng: null,
      is_active: isActive,
      provider_fault_id: pickString(f, ["id", "Id"]) || `${code}-${ts}`,
      raw: f,
    })
  }
  return { codes, error: null, softSkip: false }
}

async function syncFaultCodesFromDiagnostics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  since: Date,
): Promise<FaultCodeNormalized[]> {
  const { data } = await admin
    .from("eld_diagnostics")
    .select("truck_id, driver_id, fault_code, occurred_at, raw_data, eld_devices(provider_device_id)")
    .eq("company_id", companyId)
    .eq("diagnostic_type", "fault_code")
    .gte("occurred_at", since.toISOString())
    .not("fault_code", "is", null)
    .limit(500)

  const codes: FaultCodeNormalized[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const fc = String(r.fault_code ?? "")
    if (!fc) continue
    const code = normalizeFaultCode(fc)
    const devices = asRecord(r.eld_devices)
    const extId = pickString(devices, ["provider_device_id"]) || ""
    const ts = String(r.occurred_at ?? new Date().toISOString())
    codes.push({
      truck_external_id: extId,
      driver_external_id: r.driver_id == null ? null : String(r.driver_id),
      code,
      code_protocol: detectCodeProtocol(code),
      first_seen_at: ts,
      last_seen_at: ts,
      location_lat: null,
      location_lng: null,
      is_active: true,
      provider_fault_id: `diag-${code}-${ts}`,
      raw: asRecord(r.raw_data),
    })
  }
  return codes
}

type PersistResult = { inserted: number; updated: number; cleared: number; newIds: string[] }

async function persistFaultCodesForDevice(params: {
  admin: ReturnType<typeof createAdminClient>
  companyId: string
  device: EldDeviceSyncRow
  provider: EldProviderCanonical
  normalized: FaultCodeNormalized[]
  applyTranslations: boolean
}): Promise<PersistResult> {
  const { admin, companyId, device, provider, normalized, applyTranslations } = params
  let inserted = 0
  let updated = 0
  let cleared = 0
  const newIds: string[] = []
  const activeKeys = new Set<string>()

  const truckId =
    device.truck_id ||
    (await resolveTruckId(
      admin,
      companyId,
      device,
      normalized[0]?.truck_external_id || device.provider_device_id,
    ))

  for (const n of normalized) {
    if (!n.code || n.code === "UNKNOWN") continue
    const code = normalizeFaultCode(n.code)
    const protocol = n.code_protocol === "unknown" ? detectCodeProtocol(code) : n.code_protocol
    activeKeys.add(code)

    if (!n.is_active) {
      if (!truckId) continue
      const { data: clearedRows } = await admin
        .from("eld_fault_codes")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("truck_id", truckId)
        .eq("code", code)
        .eq("provider", provider)
        .eq("is_active", true)
        .select("id")
      cleared += (clearedRows ?? []).length
      continue
    }

    let translation = null
    if (applyTranslations) {
      translation = await lookupDtcTranslation(admin, code, protocol)
    }

    const description = applyTranslations ? translation?.short_description ?? null : null
    const severity = applyTranslations
      ? translation?.severity ?? "unknown"
      : "unknown"
    const category = applyTranslations ? translation?.category ?? null : null
    const recommended_action = applyTranslations ? translation?.recommended_action ?? null : null

    if (!truckId) continue

    const { data: existing } = await admin
      .from("eld_fault_codes")
      .select("id, occurrence_count, first_seen_at, linked_maintenance_id")
      .eq("company_id", companyId)
      .eq("truck_id", truckId)
      .eq("code", code)
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle()

    if (existing) {
      const ex = existing as {
        id: string
        occurrence_count: number
        first_seen_at: string
        linked_maintenance_id: string | null
      }
      await admin
        .from("eld_fault_codes")
        .update({
          last_seen_at: n.last_seen_at,
          occurrence_count: ex.occurrence_count + 1,
          driver_id: device.driver_id ?? null,
          location_lat: n.location_lat,
          location_lng: n.location_lng,
          description,
          severity,
          category,
          recommended_action,
          raw_payload: n.raw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ex.id)
      updated += 1
    } else {
      const driverId =
        device.driver_id ||
        (n.driver_external_id
          ? await resolveDriverId(admin, device, n.driver_external_id, mappingProviderKeys(device))
          : null)
      const { data: created, error } = await admin
        .from("eld_fault_codes")
        .insert({
          company_id: companyId,
          truck_id: truckId,
          driver_id: driverId,
          eld_device_id: device.id,
          code,
          code_protocol: protocol,
          description,
          severity,
          category,
          recommended_action,
          first_seen_at: n.first_seen_at,
          last_seen_at: n.last_seen_at,
          occurrence_count: 1,
          is_active: true,
          provider,
          provider_fault_id: n.provider_fault_id,
          raw_payload: n.raw,
          location_lat: n.location_lat,
          location_lng: n.location_lng,
        })
        .select("id")
        .maybeSingle()
      if (!error && created) {
        inserted += 1
        newIds.push((created as { id: string }).id)
      }
    }
  }

  if (truckId && activeKeys.size > 0) {
    const { data: stale } = await admin
      .from("eld_fault_codes")
      .select("id, code")
      .eq("company_id", companyId)
      .eq("truck_id", truckId)
      .eq("provider", provider)
      .eq("is_active", true)

    for (const row of stale ?? []) {
      const r = row as { id: string; code: string }
      if (!activeKeys.has(r.code)) {
        await admin
          .from("eld_fault_codes")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", r.id)
        cleared += 1
      }
    }
  }

  return { inserted, updated, cleared, newIds }
}

export async function syncFaultCodesForCompany(companyId: string): Promise<{
  ok: boolean
  error?: string
  devices: number
  inserted: number
  updated: number
  cleared: number
}> {
  const admin = createAdminClient()
  const tier = await getCompanyTier(companyId)
  const hasBasic = hasFeatureAccess(tier, "eld_fault_codes_basic")
  if (!hasBasic) {
    return { ok: true, devices: 0, inserted: 0, updated: 0, cleared: 0 }
  }
  const applyTranslations = hasFeatureAccess(tier, "eld_fault_codes_advanced")

  const { data: devices, error: dErr } = await admin
    .from("eld_devices")
    .select(
      "id, company_id, truck_id, driver_id, api_key, api_secret, api_endpoint, provider_device_id, provider, status",
    )
    .eq("company_id", companyId)
    .eq("status", "active")

  if (dErr) return { ok: false, error: safeDbError(dErr), devices: 0, inserted: 0, updated: 0, cleared: 0 }

  let inserted = 0
  let updated = 0
  let cleared = 0
  const allNewIds: string[] = []

  for (const raw of devices ?? []) {
    const device = raw as EldDeviceSyncRow
    const provider = canonicalEldProvider(device.provider)
    if (!provider) continue

    const { data: cursor } = await admin
      .from("eld_fault_sync_cursors")
      .select("last_synced_through, consecutive_failures")
      .eq("company_id", companyId)
      .eq("provider", provider)
      .maybeSingle()

    const since = new Date(
      (cursor as { last_synced_through?: string } | null)?.last_synced_through ??
        new Date(Date.now() - 7 * 86400000).toISOString(),
    )
    const until = new Date()

    let normalized: FaultCodeNormalized[] = []
    let syncError: string | null = null
    let softSkip = false

    try {
      if (provider === "samsara") {
        const r = await syncSamsaraFaultCodes(device, since)
        normalized = r.codes
        syncError = r.error
        softSkip = r.softSkip
      } else if (provider === "motive") {
        const r = await syncMotiveFaultCodes(device, since)
        normalized = r.codes
        syncError = r.error
        softSkip = r.softSkip
      } else if (provider === "geotab") {
        const r = await syncGeotabFaultCodes(device, since)
        normalized = r.codes
        syncError = r.error
        softSkip = r.softSkip
      }
    } catch (e: unknown) {
      syncError = e instanceof Error ? e.message : "Fault sync failed"
    }

    if (normalized.length === 0 && !syncError) {
      const diag = await syncFaultCodesFromDiagnostics(admin, companyId, since)
      normalized = diag
    }

    const pr = await persistFaultCodesForDevice({
      admin,
      companyId,
      device,
      provider,
      normalized,
      applyTranslations,
    })
    inserted += pr.inserted
    updated += pr.updated
    cleared += pr.cleared
    allNewIds.push(...pr.newIds)

    const failures = syncError && !softSkip ? ((cursor as { consecutive_failures?: number } | null)?.consecutive_failures ?? 0) + 1 : 0
    await admin.from("eld_fault_sync_cursors").upsert(
      {
        company_id: companyId,
        provider,
        last_synced_through: until.toISOString(),
        last_run_at: until.toISOString(),
        consecutive_failures: failures,
      },
      { onConflict: "company_id,provider" },
    )

    if (syncError && !softSkip) {
      Sentry.captureMessage(`fault sync ${provider} company ${companyId}: ${syncError}`, { level: "warning" })
    }
  }

  if (applyTranslations) {
    for (const id of allNewIds) {
      const { data: fault } = await admin
        .from("eld_fault_codes")
        .select(
          "id, company_id, truck_id, driver_id, code, description, severity, recommended_action, occurrence_count, first_seen_at, linked_maintenance_id",
        )
        .eq("id", id)
        .maybeSingle()
      if (fault) {
        await handleNewFaultCode({ fault: fault as FaultCodeRow, isNewOccurrence: true })
      }
    }
  }

  return {
    ok: true,
    devices: (devices ?? []).length,
    inserted,
    updated,
    cleared,
  }
}
