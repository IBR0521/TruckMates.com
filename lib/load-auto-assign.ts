import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDailyRemainingFromEldLogs, type EldLogLike } from "@/lib/hos/compute-daily-remaining"
import { haversineMiles } from "@/lib/promiles/geo"
import type { OperationsWorkflowSettings } from "./load-workflow-settings"
import { resolveEffectiveAutoAssignSettings, type CompanyAutoAssignSettings } from "./operations-auto-assign-settings"

export type AutoAssignInput = {
  origin: string
  destination: string
  existingDriverId?: string | null
  existingTruckId?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
}

export type AutoAssignResult = {
  driverId: string | null
  truckId: string | null
}

function sanitizeForOr(str: string): string {
  return (str || "")
    .replace(/[,()]/g, "")
    .replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj|not)/gi, "")
    .replace(/%/g, "")
    .trim()
    .substring(0, 200)
}

function parseCoord(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

async function driverPassesHos(
  supabase: SupabaseClient,
  companyId: string,
  driverId: string,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]
  const { data: logs } = await supabase
    .from("eld_logs")
    .select("id, log_date, log_type, start_time, end_time, duration_minutes, miles_driven")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .gte("log_date", today)
    .lte("log_date", today)
    .limit(500)

  const todayLogs = (logs || []).filter((l: { log_date?: string }) => l.log_date === today) as EldLogLike[]
  const computed = computeDailyRemainingFromEldLogs(todayLogs, Date.now(), (logs || []) as EldLogLike[])
  return computed.canDrive && computed.violations.length === 0
}

async function truckHasOpenMaintenance(
  supabase: SupabaseClient,
  companyId: string,
  truckId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("maintenance")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("truck_id", truckId)
    .in("status", ["scheduled", "overdue"])
  return (count ?? 0) > 0
}

async function isDriverAvailable(
  supabase: SupabaseClient,
  companyId: string,
  driverId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("loads")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .in("status", ["scheduled", "in_transit"])
  return (count ?? 0) === 0
}

async function isTruckAssignable(
  supabase: SupabaseClient,
  companyId: string,
  truckId: string,
  considerMaintenance: boolean,
): Promise<boolean> {
  const { data: truck } = await supabase
    .from("trucks")
    .select("id, status")
    .eq("id", truckId)
    .eq("company_id", companyId)
    .maybeSingle()
  if (!truck || !["available", "in_use"].includes(String(truck.status || ""))) return false
  if (considerMaintenance && (await truckHasOpenMaintenance(supabase, companyId, truckId))) {
    return false
  }
  return true
}

/** Latest driver positions from ELD (miles from pickup). Missing drivers are omitted. */
async function driverDistanceMilesFromPickup(
  supabase: SupabaseClient,
  companyId: string,
  driverIds: string[],
  pickup: { lat: number; lng: number },
): Promise<Map<string, number>> {
  const unique = [...new Set(driverIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("eld_locations")
    .select("driver_id, latitude, longitude, timestamp")
    .eq("company_id", companyId)
    .in("driver_id", unique)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(500)

  const distances = new Map<string, number>()
  for (const row of data || []) {
    const driverId = String(row.driver_id || "")
    if (!driverId || distances.has(driverId)) continue
    const lat = parseCoord(row.latitude)
    const lng = parseCoord(row.longitude)
    if (lat === null || lng === null) continue
    distances.set(driverId, haversineMiles({ lat, lng }, pickup))
  }
  return distances
}

function filterByMaxDistance(
  driverIds: string[],
  distances: Map<string, number>,
  maxMiles: number,
): string[] {
  if (maxMiles <= 0) return driverIds
  return driverIds.filter((id) => {
    const miles = distances.get(id)
    return miles !== undefined && miles <= maxMiles
  })
}

/**
 * Pick driver/truck for auto-assignment using company Operations settings.
 * Returns existing IDs when already set or when auto-assign is disabled.
 */
export async function pickAutoAssignDriverAndTruck(
  supabase: SupabaseClient,
  companyId: string,
  settings: CompanyAutoAssignSettings,
  input: AutoAssignInput,
): Promise<AutoAssignResult> {
  const effective = resolveEffectiveAutoAssignSettings(settings)
  let driverId = input.existingDriverId ?? null
  let truckId = input.existingTruckId ?? null

  const priority = String(effective.assignment_priority || "proximity").toLowerCase()
  if (priority === "manual") {
    return { driverId, truckId }
  }

  const autoDriver = Boolean(effective.auto_assign_driver) && !driverId
  const autoTruck = Boolean(effective.auto_assign_truck) && !truckId
  if (!autoDriver && !autoTruck) {
    return { driverId, truckId }
  }

  if (!input.origin?.trim() || !input.destination?.trim()) {
    return { driverId, truckId }
  }

  const safeOrigin = sanitizeForOr(input.origin)
  const safeDest = sanitizeForOr(input.destination)

  const { data: recentLoads } = await supabase
    .from("loads")
    .select("driver_id, truck_id")
    .eq("company_id", companyId)
    .or(`origin.ilike.%${safeOrigin}%,destination.ilike.%${safeDest}%`)
    .order("created_at", { ascending: false })
    .limit(20)

  const driverCounts: Record<string, number> = {}
  const truckCounts: Record<string, number> = {}
  for (const row of recentLoads || []) {
    if (row.driver_id) driverCounts[row.driver_id] = (driverCounts[row.driver_id] || 0) + 1
    if (row.truck_id) truckCounts[row.truck_id] = (truckCounts[row.truck_id] || 0) + 1
  }

  const considerHos = effective.consider_driver_hours !== false
  const considerMaintenance = Boolean(effective.consider_truck_maintenance)
  const maxDistance = parseCoord(effective.max_distance_for_auto_assign) ?? 0
  const pickupLat = parseCoord(input.pickupLat)
  const pickupLng = parseCoord(input.pickupLng)
  const useDistanceFilter =
    priority === "proximity" && maxDistance > 0 && pickupLat !== null && pickupLng !== null

  let driverDistances = new Map<string, number>()
  if (useDistanceFilter) {
    const allDriverIds = Object.keys(driverCounts)
    driverDistances = await driverDistanceMilesFromPickup(supabase, companyId, allDriverIds, {
      lat: pickupLat,
      lng: pickupLng,
    })
  }

  async function pickDriver(candidateIds: string[]): Promise<string | null> {
    let unique = [...new Set(candidateIds.filter(Boolean))]
    if (unique.length === 0) return null

    if (useDistanceFilter) {
      unique = filterByMaxDistance(unique, driverDistances, maxDistance)
      if (unique.length === 0) return null
    }

    if (priority === "availability") {
      let bestId: string | null = null
      let bestCount = Number.POSITIVE_INFINITY
      for (const id of unique) {
        const { count } = await supabase
          .from("loads")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("driver_id", id)
          .in("status", ["scheduled", "in_transit", "pending", "confirmed"])
        const active = count ?? 0
        if (active < bestCount) {
          bestCount = active
          bestId = id
        }
      }
      if (!bestId) return null
      unique = [bestId]
    } else if (priority === "proximity" && useDistanceFilter) {
      unique.sort((a, b) => (driverDistances.get(a) ?? Infinity) - (driverDistances.get(b) ?? Infinity))
    } else if (priority === "experience") {
      unique.sort((a, b) => (driverCounts[b] || 0) - (driverCounts[a] || 0))
    }

    for (const id of unique) {
      const { data: driver } = await supabase
        .from("drivers")
        .select("id, status")
        .eq("id", id)
        .eq("company_id", companyId)
        .eq("status", "active")
        .maybeSingle()
      if (!driver) continue
      if (!(await isDriverAvailable(supabase, companyId, id))) continue
      if (considerHos && !(await driverPassesHos(supabase, companyId, id))) continue
      return id
    }
    return null
  }

  async function pickTruck(candidateIds: string[]): Promise<string | null> {
    for (const id of [...new Set(candidateIds.filter(Boolean))]) {
      if (await isTruckAssignable(supabase, companyId, id, considerMaintenance)) return id
    }
    return null
  }

  const sortedDrivers = Object.entries(driverCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const sortedTrucks = Object.entries(truckCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id)

  if (autoDriver) {
    driverId = await pickDriver(sortedDrivers)
  }
  if (autoTruck) {
    truckId = await pickTruck(sortedTrucks)
  }

  return { driverId, truckId }
}
