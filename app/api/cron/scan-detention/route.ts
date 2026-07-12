import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { haversineMiles } from "@/lib/promiles/geo"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchAllRowsByIdCursor } from "@/lib/supabase/fetch-all-by-id-cursor"
import { reportCronFailure } from "@/lib/cron/report"

export const maxDuration = 60

const RADIUS_MI = 0.5
const DWELL_LOOKBACK_MS = 6 * 60 * 60 * 1000
/** Break dwell if two consecutive in-radius pings are farther apart in time (likely left and returned). */
const MAX_IN_RADIUS_GAP_MINUTES = 45
const DEDUPE_LOOKBACK_MS = 60 * 60 * 1000
const DEFAULT_FREE_MINUTES = 120
const DEFAULT_DETENTION_HOURLY = 50
const LOCATIONS_CAP = 12000
const MAX_LOADS_PER_COMPANY = 550

const ACTIVE_LOAD_STATUSES = [
  "in_transit",
  "at_pickup",
  "at_delivery",
  "arrived_at_shipper",
  "arrived_at_delivery",
  "in_progress",
] as const

type LoadRow = {
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

type EldLocPoint = {
  id: string
  truck_id: string | null
  latitude: number
  longitude: number
  timestamp: string
}

type AiPayloadRow = { action_payload: Record<string, unknown> | null; triggered: boolean | null }

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickupCoords(row: LoadRow): { lat: number; lng: number } | null {
  const lat = num(row.pickup_latitude ?? row.shipper_latitude)
  const lng = num(row.pickup_longitude ?? row.shipper_longitude)
  return lat !== null && lng !== null ? { lat, lng } : null
}

function deliveryCoords(row: LoadRow): { lat: number; lng: number } | null {
  const lat = num(row.delivery_latitude ?? row.consignee_latitude)
  const lng = num(row.delivery_longitude ?? row.consignee_longitude)
  return lat !== null && lng !== null ? { lat, lng } : null
}

/**
 * Tier 1: over free through &lt;120 min excess; Tier 2: 2+h over; Tier 3: 4+h; Tier 4: 8+h.
 */
function detentionEscalationTier(excessMinutes: number): number {
  if (excessMinutes <= 0) return 0
  if (excessMinutes < 120) return 1
  if (excessMinutes < 240) return 2
  if (excessMinutes < 480) return 3
  return 4
}

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

function buildMaxDetentionTierByLoad(rows: AiPayloadRow[]): Map<string, number> {
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

function shouldFireDetentionAlert(
  loadId: string,
  excessMinutes: number,
  maxTierLastHour: number | undefined,
): boolean {
  const t = detentionEscalationTier(excessMinutes)
  if (t <= 0) return false
  return t > (maxTierLastHour ?? 0)
}

/**
 * Time in minutes from first ping of the current contiguous in-radius segment through latest ping.
 */
function contiguousDwellMinutesWithinRadius(
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

async function probeLoadsSelect(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const candidates = [
    "id, company_id, status, truck_id, driver_id, shipment_number, customer_id, origin, destination, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, shipper_latitude, shipper_longitude, consignee_latitude, consignee_longitude",
    "id, company_id, status, truck_id, driver_id, shipment_number, customer_id, origin, destination, shipper_latitude, shipper_longitude, consignee_latitude, consignee_longitude",
    "id, company_id, status, truck_id, driver_id, shipment_number, customer_id, origin, destination",
  ]
  for (const sel of candidates) {
    const { error } = await admin.from("loads").select(sel).limit(1)
    if (!error) return sel
  }
  return null
}

async function fetchCustomerDetentionDefaults(
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

/**
 * Superseded by `/api/cron/process-deadline-sweep` (deadline-tracking Phase 1).
 * Kept for reference — dwell logic lives in `lib/detention/dwell-scan.ts`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron scan-detention] CRON_SECRET not configured — disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const locationsSince = new Date(Date.now() - DWELL_LOOKBACK_MS).toISOString()
  const dedupeSince = new Date(Date.now() - DEDUPE_LOOKBACK_MS).toISOString()

  try {
    const admin = createAdminClient()
    const loadsSelect = await probeLoadsSelect(admin)

    let scanned = 0
    let detentions = 0

    if (!loadsSelect) {
      return NextResponse.json({ success: true, scanned: 0, detentions: 0 })
    }

    const hasGeoColumns =
      loadsSelect.includes("shipper_latitude") ||
      loadsSelect.includes("pickup_latitude") ||
      loadsSelect.includes("consignee_latitude")

    const { data: companyRows } = await admin.from("companies").select("id").limit(2000)
    const companies = (companyRows || []) as { id: string }[]

    for (const { id: companyRaw } of companies) {
      const companyId = String(companyRaw ?? "").trim()
      if (!companyId) continue

      const [{ data: recentLogsRaw }, loadsResult] = await Promise.all([
        admin
          .from("ai_automation_logs")
          .select("action_payload, triggered")
          .eq("company_id", companyId)
          .eq("automation_type", "detention_clock")
          .gte("created_at", dedupeSince)
          .order("created_at", { ascending: false })
          .limit(2500),
        fetchAllRowsByIdCursor<LoadRow>(
          async ({ lastId, pageSize }) => {
            let q = admin
              .from("loads")
              .select(loadsSelect)
              .eq("company_id", companyId)
              .in("status", [...ACTIVE_LOAD_STATUSES])
              .not("truck_id", "is", null)
              .order("id", { ascending: true })
              .limit(pageSize)
            if (lastId) q = q.gt("id", lastId)
            const res = await q
            return {
              data: (res.data ?? null) as LoadRow[] | null,
              error: res.error,
            }
          },
          { warnLabel: `cron.scan_detention.loads.${companyId}`, maxRows: MAX_LOADS_PER_COMPANY },
        ),
      ])

      const maxTierByLoad = buildMaxDetentionTierByLoad((recentLogsRaw || []) as AiPayloadRow[])

      const { rows: loads, error: loadsErr } = loadsResult
      if (loadsErr || loads.length === 0) {
        continue
      }

      scanned += loads.length

      if (!hasGeoColumns) {
        continue
      }

      const truckIds = [...new Set(loads.map((l) => String(l.truck_id || "").trim()).filter(Boolean))]
      if (truckIds.length === 0) continue

      const { data: locRowsRaw, error: locErr } = await admin
        .from("eld_locations")
        .select("id, truck_id, latitude, longitude, timestamp")
        .eq("company_id", companyId)
        .in("truck_id", truckIds)
        .gte("timestamp", locationsSince)
        .order("timestamp", { ascending: true })
        .limit(LOCATIONS_CAP)

      if (locErr || !locRowsRaw?.length) {
        continue
      }

      const byTruck = new Map<string, EldLocPoint[]>()
      for (const raw of locRowsRaw as EldLocPoint[]) {
        const tid = String(raw.truck_id ?? "").trim()
        if (!tid) continue
        const list = byTruck.get(tid) ?? []
        list.push(raw)
        byTruck.set(tid, list)
      }

      const customerIds = loads.map((l) => String(l.customer_id ?? "").trim()).filter(Boolean)
      const customerDefaults = await fetchCustomerDetentionDefaults(admin, companyId, customerIds)

      for (const load of loads) {
        const truckId = String(load.truck_id ?? "").trim()
        if (!truckId) continue

        const points = byTruck.get(truckId)
        if (!points?.length) continue

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
        if (candidates.length === 0) continue

        let best: {
          dwellMin: number
          locationType: "pickup" | "delivery"
          locationName: string
        } | null = null

        for (const c of candidates) {
          const dwell = contiguousDwellMinutesWithinRadius(points, c.coords, RADIUS_MI)
          if (dwell === null) continue
          if (!best || dwell > best.dwellMin) {
            best = { dwellMin: dwell, locationType: c.type, locationName: c.name }
          }
        }

        if (!best) continue

        const cid = String(load.customer_id ?? "").trim()
        const cust = cid ? customerDefaults.get(cid) : undefined
        const freeMinutes = cust?.freeMinutes ?? DEFAULT_FREE_MINUTES
        const hourlyRate = cust?.hourlyRate ?? DEFAULT_DETENTION_HOURLY

        const minutesStationary = best.dwellMin
        const excessMinutes = Math.max(0, Math.round(minutesStationary - freeMinutes))
        if (excessMinutes <= 0) continue

        const maxTierLastHour = maxTierByLoad.get(load.id)

        if (!shouldFireDetentionAlert(load.id, excessMinutes, maxTierLastHour)) {
          continue
        }

        const estimatedDetentionFee =
          Math.round((excessMinutes / 60) * hourlyRate * 100) / 100

        detentions += 1
        maxTierByLoad.set(load.id, Math.max(maxTierLastHour ?? 0, detentionEscalationTier(excessMinutes)))

        void runAgentEvaluation({
          companyId,
          trigger: "detention_clock",
          triggerData: {
            loadId: load.id,
            shipmentNumber: load.shipment_number ?? null,
            truckId,
            driverId: load.driver_id ?? null,
            locationType: best.locationType,
            locationName: best.locationName,
            minutesStationary: Math.round(minutesStationary),
            freeTimeMinutes: freeMinutes,
            excessMinutes,
            estimatedDetentionFee,
          },
          contextTypes: ["load", "driver"],
        }).catch((err: unknown) => console.error("[scan-detention runAgentEvaluation]", companyId, err))
      }
    }

    return NextResponse.json({
      success: true,
      scanned,
      detentions,
    })
  } catch (error: unknown) {
    console.error("[scan-detention] cron failed:", error)
    reportCronFailure("scan-detention", error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error, "Detention scan failed"),
        scanned: 0,
        detentions: 0,
      },
      { status: 500 },
    )
  }
}
