/**
 * Discover fleet vehicles from connected ELD providers (cap 1000).
 */

import { fetchWithTimeout } from "@/lib/eld/fetch-with-timeout"
import { validateGeotabServerUrl, geotabDatabaseFromNotes } from "@/lib/eld/geotab-url"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"

export type DiscoveredVehicle = {
  provider_vehicle_id: string
  name: string
  vin: string | null
  license_plate: string | null
  make: string | null
  model: string | null
  year: number | null
}

const MAX_VEHICLES = 1000

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const n = parseInt(v, 10)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export async function discoverSamsaraVehicles(params: {
  apiKey: string
}): Promise<{ data: DiscoveredVehicle[] | null; error: string | null }> {
  const vehicles: DiscoveredVehicle[] = []
  let after: string | undefined
  try {
    while (vehicles.length < MAX_VEHICLES) {
      const qs = new URLSearchParams({ limit: "100" })
      if (after) qs.set("after", after)
      const res = await fetchWithTimeout(`https://api.samsara.com/fleet/vehicles?${qs}`, {
        headers: { Authorization: `Bearer ${params.apiKey.trim()}`, Accept: "application/json" },
      })
      if (!res.ok) {
        return { data: null, error: `Samsara vehicles HTTP ${res.status}` }
      }
      const json = (await res.json()) as unknown
      const root = asRecord(json)
      const data = Array.isArray(root.data) ? root.data : []
      for (const item of data) {
        const o = asRecord(item)
        const id = pickString(o, ["id", "vehicleId"])
        if (!id) continue
        vehicles.push({
          provider_vehicle_id: id,
          name: pickString(o, ["name", "vehicleName"]) || `Vehicle ${id}`,
          vin: pickString(o, ["vin", "vehicleVin"]),
          license_plate: pickString(o, ["licensePlate", "license_plate"]),
          make: pickString(o, ["make"]),
          model: pickString(o, ["model"]),
          year: pickNum(o, ["year"]),
        })
        if (vehicles.length >= MAX_VEHICLES) break
      }
      const pagination = asRecord(root.pagination)
      after = pickString(pagination, ["endCursor", "end_cursor"]) || undefined
      if (!after || data.length === 0) break
    }
    return { data: vehicles, error: null }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : "Samsara discovery failed" }
  }
}

export async function discoverMotiveVehicles(params: {
  apiKey: string
  apiSecret?: string
}): Promise<{ data: DiscoveredVehicle[] | null; error: string | null }> {
  const headers: Record<string, string> = {
    "X-Api-Key": params.apiKey.trim(),
    Accept: "application/json",
  }
  if (params.apiSecret?.trim()) headers["X-Api-Secret"] = params.apiSecret.trim()

  const urls = [
    "https://api.gomotive.com/v1/vehicles?per_page=100",
    "https://api.keeptruckin.com/v1/vehicles?per_page=100",
  ]

  try {
    for (const url of urls) {
      const res = await fetchWithTimeout(url, { headers })
      if (!res.ok && res.status === 404) continue
      if (!res.ok) return { data: null, error: `Motive vehicles HTTP ${res.status}` }
      const json = (await res.json()) as unknown
      const root = asRecord(json)
      const list = Array.isArray(root.vehicles) ? root.vehicles : Array.isArray(root.data) ? root.data : []
      const vehicles: DiscoveredVehicle[] = []
      for (const item of list.slice(0, MAX_VEHICLES)) {
        const o = asRecord(item)
        const id = pickString(o, ["id", "vehicle_id"])
        if (!id) continue
        vehicles.push({
          provider_vehicle_id: id,
          name: pickString(o, ["number", "name", "unit_number"]) || `Vehicle ${id}`,
          vin: pickString(o, ["vin"]),
          license_plate: pickString(o, ["license_plate", "licensePlate"]),
          make: pickString(o, ["make"]),
          model: pickString(o, ["model"]),
          year: pickNum(o, ["year"]),
        })
      }
      return { data: vehicles, error: null }
    }
    return { data: [], error: null }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : "Motive discovery failed" }
  }
}

export async function discoverGeotabVehicles(params: {
  username: string
  password: string
  database: string
  serverUrl?: string
}): Promise<{ data: DiscoveredVehicle[] | null; error: string | null }> {
  const urlCheck = validateGeotabServerUrl(params.serverUrl)
  if (!urlCheck.ok || !urlCheck.apiv1Base) {
    return { data: null, error: urlCheck.error || "Invalid server URL" }
  }

  try {
    const authRes = await fetchWithTimeout(`${urlCheck.apiv1Base}/Authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Authenticate",
        params: {
          userName: params.username.trim(),
          password: params.password,
          database: params.database.trim(),
        },
      }),
    })
    const authJson = (await authRes.json()) as {
      result?: { credentials?: { sessionId?: string } }
      error?: { message?: string }
    }
    const sessionId = authJson.result?.credentials?.sessionId
    if (!sessionId) {
      return { data: null, error: authJson.error?.message || "Geotab auth failed" }
    }

    const devRes = await fetchWithTimeout(`${urlCheck.apiv1Base}/Get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: { typeName: "Device", credentials: { sessionId } },
      }),
    })
    const devJson = (await devRes.json()) as { result?: unknown[] }
    const rows = Array.isArray(devJson.result) ? devJson.result.slice(0, MAX_VEHICLES) : []
    const vehicles: DiscoveredVehicle[] = rows.map((item) => {
      const o = asRecord(item)
      const id = pickString(o, ["id", "Id"]) || ""
      return {
        provider_vehicle_id: id,
        name: pickString(o, ["name", "Name", "vehicleIdentificationNumber"]) || `Device ${id}`,
        vin: pickString(o, ["vehicleIdentificationNumber", "vin"]),
        license_plate: pickString(o, ["licensePlate", "licensePlate"]),
        make: null,
        model: null,
        year: null,
      }
    })
    return { data: vehicles.filter((v) => v.provider_vehicle_id), error: null }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : "Geotab discovery failed" }
  }
}

export async function discoverVehiclesForDevice(
  device: EldDeviceSyncRow & { notes?: string | null },
): Promise<{ data: DiscoveredVehicle[] | null; error: string | null }> {
  const provider = String(device.provider || "").toLowerCase()
  if (provider === "samsara" && device.api_key) {
    return discoverSamsaraVehicles({ apiKey: device.api_key })
  }
  if ((provider === "motive" || provider === "keeptruckin") && device.api_key) {
    return discoverMotiveVehicles({
      apiKey: device.api_key,
      apiSecret: device.api_secret ?? undefined,
    })
  }
  if (provider === "geotab" && device.api_key && device.api_secret) {
    const db =
      geotabDatabaseFromNotes(device.notes) ||
      (device.provider_device_id && device.provider_device_id !== "fleet"
        ? device.provider_device_id
        : null)
    if (!db) return { data: null, error: "Geotab database name missing on device record." }
    return discoverGeotabVehicles({
      username: device.api_key,
      password: device.api_secret,
      database: db,
      serverUrl: device.api_endpoint || undefined,
    })
  }
  return { data: null, error: "Unsupported provider or missing credentials." }
}
