/**
 * Shared detention dwell logic (extracted from scan-detention cron).
 */

import { haversineMiles } from "@/lib/promiles/geo"
import { createAdminClient } from "@/lib/supabase/admin"

export const DETENTION_ACTIVE_LOAD_STATUSES = [
  "in_transit",
  "at_pickup",
  "at_delivery",
  "arrived_at_shipper",
  "arrived_at_delivery",
  "in_progress",
] as const

export const LOAD_ARRIVAL_STATUSES = new Set([
  "at_pickup",
  "at_delivery",
  "arrived_at_shipper",
  "arrived_at_delivery",
])

export const LOAD_DEPARTURE_OR_DONE_STATUSES = new Set([
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
])

export const RADIUS_MI = 0.5
export const DWELL_LOOKBACK_MS = 6 * 60 * 60 * 1000
export const MAX_IN_RADIUS_GAP_MINUTES = 45
export const DEDUPE_LOOKBACK_MS = 60 * 60 * 1000
export const DEFAULT_FREE_MINUTES = 120
export const DEFAULT_DETENTION_HOURLY = 50
export const DETENTION_RECHECK_MINUTES = 15

export type DetentionLoadRow = {
  id: string
  company_id: string
  status: string
  truck_id: string | null
  driver_id: string | null
  shipment_number: string | null
  customer_id: string | null
  origin: string | null
  destination: string | null
  pickup_latitude?: number | string | null
  pickup_longitude?: number | string | null
  delivery_latitude?: number | string | null
  delivery_longitude?: number | string | null
  shipper_latitude?: number | string | null
  shipper_longitude?: number | string | null
  consignee_latitude?: number | string | null
  consignee_longitude?: number | string | null
}

export type EldLocPoint = {
  id: string
  truck_id: string | null
  latitude: number
  longitude: number
  timestamp: string
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function pickupCoords(row: DetentionLoadRow): { lat: number; lng: number } | null {
  const lat = num(row.pickup_latitude ?? row.shipper_latitude)
  const lng = num(row.pickup_longitude ?? row.shipper_longitude)
  return lat !== null && lng !== null ? { lat, lng } : null
}

export function deliveryCoords(row: DetentionLoadRow): { lat: number; lng: number } | null {
  const lat = num(row.delivery_latitude ?? row.consignee_latitude)
  const lng = num(row.delivery_longitude ?? row.consignee_longitude)
  return lat !== null && lng !== null ? { lat, lng } : null
}

export function detentionEscalationTier(excessMinutes: number): number {
  if (excessMinutes <= 0) return 0
  if (excessMinutes < 120) return 1
  if (excessMinutes < 240) return 2
  if (excessMinutes < 480) return 3
  return 4
}

export function contiguousDwellMinutesWithinRadius(
  sortedAsc: EldLocPoint[],
  stop: { lat: number; lng: number },
  radiusMi: number,
): number | null {
  if (sortedAsc.length === 0) return null
  const last = sortedAsc[sortedAsc.length - 1]
  const lastLat = Number(last.latitude)
  const lastLng = Number(last.longitude)
  if (!Number.isFinite(lastLat) || !Number.isFinite(lastLng)) return null
  if (haversineMiles({ lat: lastLat, lng: lastLng }, { lat: stop.lat, lng: stop.lng }) > radiusMi) {
    return null
  }

  let startIdx = sortedAsc.length - 1
  for (let i = sortedAsc.length - 2; i >= 0; i--) {
    const p = sortedAsc[i]
    const lat = Number(p.latitude)
    const lng = Number(p.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) break
    if (haversineMiles({ lat, lng }, { lat: stop.lat, lng: stop.lng }) > radiusMi) break

    const tNext = new Date(sortedAsc[i + 1].timestamp).getTime()
    const tCur = new Date(p.timestamp).getTime()
    const gapMin = (tNext - tCur) / 60000
    if (gapMin > MAX_IN_RADIUS_GAP_MINUTES) break

    startIdx = i
  }

  const t0 = new Date(sortedAsc[startIdx].timestamp).getTime()
  const tEnd = new Date(last.timestamp).getTime()
  return Math.max(0, (tEnd - t0) / 60000)
}

export async function fetchCustomerDetentionDefaults(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  customerIds: string[],
): Promise<Map<string, { freeMinutes: number; hourlyRate: number }>> {
  const out = new Map<string, { freeMinutes: number; hourlyRate: number }>()
  const uniq = [...new Set(customerIds.filter(Boolean))]
  if (uniq.length === 0) return out

  const chunkSize = 80
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize)
    let sel = "id, detention_free_time_minutes, detention_hourly_rate"
    let { data, error } = await admin.from("customers").select(sel).eq("company_id", companyId).in("id", chunk)

    if (error?.message?.toLowerCase().includes("column") || error?.code === "42703") {
      sel = "id"
      const r = await admin.from("customers").select(sel).eq("company_id", companyId).in("id", chunk)
      data = r.data
      error = r.error
    }

    if (error || !data) continue

    for (const row of data as unknown as Record<string, unknown>[]) {
      const id = String(row.id ?? "").trim()
      if (!id) continue
      const freeRaw = num(row.detention_free_time_minutes)
      const rateRaw = num(row.detention_hourly_rate)
      out.set(id, {
        freeMinutes:
          freeRaw !== null && freeRaw > 0 && freeRaw < 48 * 60 ? Math.round(freeRaw) : DEFAULT_FREE_MINUTES,
        hourlyRate:
          rateRaw !== null && rateRaw >= 0 && rateRaw < 5000 ? rateRaw : DEFAULT_DETENTION_HOURLY,
      })
    }
  }

  return out
}

export type DetentionEvalResult = {
  active: boolean
  minutesStationary: number
  excessMinutes: number
  freeMinutes: number
  hourlyRate: number
  locationType: "pickup" | "delivery"
  locationName: string
  escalationTier: number
}

export async function evaluateLoadDetention(
  load: DetentionLoadRow,
  customerDefaults: Map<string, { freeMinutes: number; hourlyRate: number }>,
  pointsByTruck: Map<string, EldLocPoint[]>,
): Promise<DetentionEvalResult | null> {
  const truckId = String(load.truck_id ?? "").trim()
  if (!truckId) return null

  const points = pointsByTruck.get(truckId)
  if (!points?.length) return null

  const pickup = pickupCoords(load)
  const delivery = deliveryCoords(load)
  const candidates: Array<{
    type: "pickup" | "delivery"
    coords: { lat: number; lng: number }
    name: string
  }> = []
  const originName = String(load.origin ?? "").trim() || "Pickup"
  const destName = String(load.destination ?? "").trim() || "Delivery"
  if (pickup) candidates.push({ type: "pickup", coords: pickup, name: originName })
  if (delivery) candidates.push({ type: "delivery", coords: delivery, name: destName })
  if (candidates.length === 0) return null

  let best: { dwellMin: number; locationType: "pickup" | "delivery"; locationName: string } | null = null

  for (const c of candidates) {
    const dwell = contiguousDwellMinutesWithinRadius(points, c.coords, RADIUS_MI)
    if (dwell === null) continue
    if (!best || dwell > best.dwellMin) {
      best = { dwellMin: dwell, locationType: c.type, locationName: c.name }
    }
  }

  if (!best) return null

  const cid = String(load.customer_id ?? "").trim()
  const cust = cid ? customerDefaults.get(cid) : undefined
  const freeMinutes = cust?.freeMinutes ?? DEFAULT_FREE_MINUTES
  const hourlyRate = cust?.hourlyRate ?? DEFAULT_DETENTION_HOURLY
  const minutesStationary = best.dwellMin
  const excessMinutes = Math.max(0, Math.round(minutesStationary - freeMinutes))

  return {
    active: excessMinutes > 0,
    minutesStationary,
    excessMinutes,
    freeMinutes,
    hourlyRate,
    locationType: best.locationType,
    locationName: best.locationName,
    escalationTier: detentionEscalationTier(excessMinutes),
  }
}

type AiPayloadRow = { action_payload: Record<string, unknown> | null; triggered: boolean | null }

function extractTriggerData(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null
  const td = payload.triggerData
  return td && typeof td === "object" && !Array.isArray(td) ? (td as Record<string, unknown>) : null
}

function excessFromAutomationPayload(payload: Record<string, unknown> | null): number | null {
  const td = extractTriggerData(payload)
  if (td) {
    const direct = num(td.excessMinutes)
    if (direct !== null && direct >= 0) return direct
    const ms = num(td.minutesStationary)
    const free = num(td.freeTimeMinutes)
    if (ms !== null && free !== null) return Math.max(0, ms - free)
  }
  return null
}

function loadIdFromAutomationPayload(payload: Record<string, unknown> | null): string | null {
  const td = extractTriggerData(payload)
  const id = td?.loadId ?? td?.load_id ?? payload?.loadId ?? payload?.load_id
  const s = String(id ?? "").trim()
  return s || null
}

export function buildMaxDetentionTierByLoad(rows: AiPayloadRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (row.triggered !== true) continue
    const payload = row.action_payload
    const loadId = loadIdFromAutomationPayload(payload)
    if (!loadId) continue
    const excess = excessFromAutomationPayload(payload)
    if (excess === null) continue
    const tier = detentionEscalationTier(excess)
    map.set(loadId, Math.max(map.get(loadId) ?? 0, tier))
  }
  return map
}

export function shouldFireDetentionAlert(
  loadId: string,
  excessMinutes: number,
  maxTierLastHour: number | undefined,
): boolean {
  const t = detentionEscalationTier(excessMinutes)
  if (t <= 0) return false
  return t > (maxTierLastHour ?? 0)
}
