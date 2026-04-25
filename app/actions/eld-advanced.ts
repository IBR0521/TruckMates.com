"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import {
  computeDailyRemainingFromEldLogs,
  getEightCalendarDayWindowYmd,
  type EldLogLike,
} from "@/lib/hos/compute-daily-remaining"
import { mapLegacyRole } from "@/lib/roles"
import { getDrivers } from "@/app/actions/drivers"
import * as Sentry from "@sentry/nextjs"
import { sanitizeError } from "@/lib/error-message"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/** `public.eld_logs` — supabase/eld_schema.sql */
const ELD_LOGS_SELECT =
  "id, company_id, eld_device_id, driver_id, truck_id, log_date, log_type, start_time, end_time, duration_minutes, location_start, location_end, odometer_start, odometer_end, miles_driven, engine_hours, violations, raw_data, created_at, updated_at"

/** `public.eld_events` — eld_schema.sql + fault columns in eld_fault_code_maintenance.sql */
const ELD_EVENTS_SELECT =
  "id, company_id, eld_device_id, driver_id, truck_id, event_type, severity, title, description, event_time, location, resolved, resolved_at, resolved_by, metadata, created_at, fault_code, fault_code_category, fault_code_description, maintenance_created, maintenance_id"

async function fetchLogsByDriverForHos(
  supabase: SupabaseClient,
  companyId: string,
  driverIds: string[],
  targetDate: string,
): Promise<Map<string, { today: EldLogLike[]; week: EldLogLike[] }>> {
  const { minYmd } = getEightCalendarDayWindowYmd(targetDate)
  const { data, error } = await supabase
    .from("eld_logs")
    .select(ELD_LOGS_SELECT)
    .eq("company_id", companyId)
    .in("driver_id", driverIds)
    .gte("log_date", minYmd)
    .lte("log_date", targetDate)
    .order("start_time", { ascending: true })
    .limit(25000)

  if (error) {
    throw new Error(error.message)
  }

  const map = new Map<string, { today: EldLogLike[]; week: EldLogLike[] }>()
  for (const id of driverIds) {
    map.set(id, { today: [], week: [] })
  }
  for (const row of data || []) {
    const did = (row as { driver_id?: string }).driver_id
    if (!did) continue
    const bucket = map.get(did)
    if (!bucket) continue
    const r = row as EldLogLike & { log_date?: string }
    bucket.week.push(r)
    if (r.log_date === targetDate) bucket.today.push(r)
  }
  return map
}

// Calculate remaining HOS hours for a driver
export async function calculateRemainingHOS(driverId: string, date?: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  const targetDate = date || calendarDateYmdLocal(new Date())

  const { minYmd } = getEightCalendarDayWindowYmd(targetDate)
  let query = supabase
    .from("eld_logs")
    .select(ELD_LOGS_SELECT)
    .eq("driver_id", driverId)
    .gte("log_date", minYmd)
    .lte("log_date", targetDate)
    .order("start_time", { ascending: true })
    .limit(5000)

  if (ctx.companyId) {
    query = query.eq("company_id", ctx.companyId)
  }

  const { data: logsAll, error } = await query

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  const todayLogs = (logsAll || []).filter((l: { log_date?: string }) => l.log_date === targetDate) as EldLogLike[]

  const computed = computeDailyRemainingFromEldLogs(todayLogs, Date.now(), (logsAll || []) as EldLogLike[])

  return {
    data: {
      drivingHours: computed.drivingHours,
      onDutyHours: computed.onDutyHours,
      offDutyHours: computed.offDutyHours,
      remainingDriving: computed.remainingDriving,
      remainingOnDuty: computed.remainingOnDuty,
      needsBreak: computed.needsBreak,
      violations: computed.violations,
      canDrive: computed.canDrive,
      weeklyOnDutyHours: computed.weeklyOnDutyHours,
      remainingWeeklyOnDuty: computed.remainingWeeklyOnDuty,
      weeklyCapViolation: computed.weeklyCapViolation,
    },
    error: null,
  }
}

// Get driver scorecard/performance metrics
export async function getDriverScorecard(driverId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end = endDate || new Date().toISOString().split('T')[0]

  // Get logs
  // V3-007 FIX: Add LIMIT to prevent OOM on large date ranges
  const { data: logs, error: logsError } = await supabase
    .from("eld_logs")
    .select(ELD_LOGS_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .gte("log_date", start)
    .lte("log_date", end)
    .limit(10000) // V3-007: Limit to 10k records to prevent OOM

  if (logsError) {
    return { error: logsError.message, data: null }
  }

  // Get violations
  const { data: violations, error: violationsError } = await supabase
    .from("eld_events")
    .select(ELD_EVENTS_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .gte("event_time", start)
    .lte("event_time", end)

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  // Calculate metrics
  const totalDrivingHours = logs
    ?.filter((log: { log_type: string; duration_minutes: number | null }) => log.log_type === "driving")
    .reduce((sum: number, log: { log_type: string; duration_minutes: number | null }) => sum + (log.duration_minutes || 0) / 60, 0) || 0

  const totalMiles = logs
    ?.filter((log: { log_type: string; miles_driven: number | string | null }) => log.log_type === "driving")
    .reduce((sum: number, log: { log_type: string; miles_driven: number | string | null }) => sum + (Number(log.miles_driven) || 0), 0) || 0

  const hosViolations = violations?.filter((v: { event_type: string }) => v.event_type === "hos_violation").length || 0
  const speedingEvents = violations?.filter((v: { event_type: string }) => v.event_type === "speeding").length || 0
  const hardBraking = violations?.filter((v: { event_type: string }) => v.event_type === "hard_brake").length || 0
  const totalViolations = violations?.length || 0

  // Calculate scores (0-100)
  const safetyScore = Math.max(0, 100 - (hosViolations * 10) - (speedingEvents * 5) - (hardBraking * 3))
  const complianceScore = Math.max(0, 100 - (hosViolations * 15))
  const efficiencyScore = totalMiles > 0 ? Math.min(100, (totalMiles / 1000) * 10) : 0
  const overallScore = (safetyScore + complianceScore + efficiencyScore) / 3

  return {
    data: {
      driverId,
      period: { start, end },
      metrics: {
        totalDrivingHours: parseFloat(totalDrivingHours.toFixed(2)),
        totalMiles: parseFloat(totalMiles.toFixed(2)),
        totalViolations,
        hosViolations,
        speedingEvents,
        hardBraking,
      },
      scores: {
        safety: parseFloat(safetyScore.toFixed(1)),
        compliance: parseFloat(complianceScore.toFixed(1)),
        efficiency: parseFloat(efficiencyScore.toFixed(1)),
        overall: parseFloat(overallScore.toFixed(1)),
      },
    },
    error: null,
  }
}

type HosDailyComputed = ReturnType<typeof computeDailyRemainingFromEldLogs>

/** Batched logs already in `logMap` — compute HOS once per driver in memory (single DB round-trip for logs). */
function computeHosMapForDrivers(
  driverIds: string[],
  logMap: Map<string, { today: EldLogLike[]; week: EldLogLike[] }>,
  nowMs: number,
): Map<string, HosDailyComputed> {
  const m = new Map<string, HosDailyComputed>()
  for (const id of driverIds) {
    const buckets = logMap.get(id) || { today: [], week: [] }
    m.set(id, computeDailyRemainingFromEldLogs(buckets.today, nowMs, buckets.week))
  }
  return m
}

function countApproachingFromHosMap(driverIds: string[], hosMap: Map<string, HosDailyComputed>): number {
  let n = 0
  for (const id of driverIds) {
    const computed = hosMap.get(id)
    if (!computed) continue
    if (computed.remainingDriving < 2 || computed.needsBreak || computed.remainingWeeklyOnDuty < 2) {
      n++
    }
  }
  return n
}

// Get fleet health metrics
export async function getFleetHealth() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [devicesRes, violationsRes, driversRes] = await Promise.all([
    supabase.from("eld_devices").select("id, status, truck_id").eq("company_id", ctx.companyId),
    supabase
      .from("eld_events")
      .select("id, severity, resolved")
      .eq("company_id", ctx.companyId)
      .eq("event_type", "hos_violation")
      .eq("resolved", false)
      .gte("event_time", yesterday),
    supabase.from("drivers").select("id").eq("company_id", ctx.companyId).eq("status", "active"),
  ])

  if (devicesRes.error) {
    return { error: devicesRes.error.message, data: null }
  }
  if (violationsRes.error) {
    return { error: violationsRes.error.message, data: null }
  }
  if (driversRes.error) {
    return { error: driversRes.error.message, data: null }
  }

  const devices = devicesRes.data
  const activeViolations = violationsRes.data
  const drivers = driversRes.data

  const driverIds = (drivers || []).map((d: { id: string }) => d.id)
  const targetDate = calendarDateYmdLocal(new Date())
  const nowMs = Date.now()
  let driversApproachingLimit = 0
  if (driverIds.length > 0) {
    try {
      const logMap = await fetchLogsByDriverForHos(supabase, ctx.companyId, driverIds, targetDate)
      const hosMap = computeHosMapForDrivers(driverIds, logMap, nowMs)
      driversApproachingLimit = countApproachingFromHosMap(driverIds, hosMap)
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Failed to load HOS logs", data: null }
    }
  }

  // Calculate metrics
  const totalDevices = devices?.length || 0
  const activeDevices = devices?.filter((d: { id: string; status: string; truck_id: string | null }) => d.status === "active").length || 0
  const totalViolations = activeViolations?.length || 0
  const criticalViolations = activeViolations?.filter((v: { id: string; severity: string; resolved: boolean }) => v.severity === "critical").length || 0

  // Calculate compliance score
  const totalDrivers = drivers?.length || 0
  const complianceScore = totalDrivers > 0
    ? Math.max(0, 100 - (totalViolations / totalDrivers) * 10)
    : 100

  return {
    data: {
      devices: {
        total: totalDevices,
        active: activeDevices,
        inactive: totalDevices - activeDevices,
      },
      violations: {
        total: totalViolations,
        critical: criticalViolations,
        warning: totalViolations - criticalViolations,
      },
      drivers: {
        total: totalDrivers,
        approachingLimit: driversApproachingLimit,
      },
      complianceScore: parseFloat(complianceScore.toFixed(1)),
      status: complianceScore >= 90 ? "excellent" : complianceScore >= 70 ? "good" : complianceScore >= 50 ? "fair" : "poor",
    },
    error: null,
  }
}

// Get real-time locations for map
export async function getRealtimeLocations() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get latest location for each device (last 5 minutes)
  // V3-007 FIX: Add LIMIT and restrict to last 24 hours to prevent OOM
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: locations, error } = await supabase
    .from("eld_locations")
    .select(`
      *,
      eld_devices:eld_device_id (
        id,
        device_name,
        status,
        trucks:truck_id (
          id,
          truck_number
        )
      ),
      drivers:driver_id (
        id,
        name
      )
    `)
    .eq("company_id", ctx.companyId)
    .gte("timestamp", oneDayAgo) // V3-007: Restrict to last 24 hours max
    .order("timestamp", { ascending: false })
    .limit(1000) // V3-007: Limit to prevent OOM

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Get most recent location per device
  const latestByDevice = new Map()
  locations?.forEach((loc: { eld_device_id: string; timestamp: string; [key: string]: any }) => {
    const deviceId = loc.eld_device_id
    if (!latestByDevice.has(deviceId) || new Date(loc.timestamp) > new Date(latestByDevice.get(deviceId).timestamp)) {
      latestByDevice.set(deviceId, loc)
    }
  })

  return {
    data: Array.from(latestByDevice.values()),
    error: null,
  }
}

// Get predictive alerts (drivers approaching limits)
export async function getPredictiveAlerts() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get all active drivers
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")

  if (driversError) {
    return { error: driversError.message, data: null }
  }

  const alerts: any[] = []
  const driverIds = (drivers || []).map((d: { id: string }) => d.id)
  const targetDate = calendarDateYmdLocal(new Date())
  const nowMs = Date.now()

  if (driverIds.length > 0) {
    try {
      const logMap = await fetchLogsByDriverForHos(supabase, ctx.companyId, driverIds, targetDate)
      const hosMap = computeHosMapForDrivers(driverIds, logMap, nowMs)
      for (const driver of drivers || []) {
        const computed = hosMap.get(driver.id)
        if (!computed) continue

        if (computed.remainingDriving < 2 && computed.remainingDriving > 0) {
          alerts.push({
            type: "warning",
            severity: "warning",
            title: "Driver Approaching Driving Limit",
            description: `${driver.name} has ${computed.remainingDriving.toFixed(1)} hours of driving time remaining`,
            driverId: driver.id,
            driverName: driver.name,
            remainingHours: computed.remainingDriving,
          })
        }

        if (computed.needsBreak) {
          alerts.push({
            type: "critical",
            severity: "critical",
            title: "Break Required",
            description: `${driver.name} needs a 30-minute qualifying break (8+ hours driving since last 30+ min off/sleeper)`,
            driverId: driver.id,
            driverName: driver.name,
          })
        }

        if (computed.remainingWeeklyOnDuty < 2 && computed.remainingWeeklyOnDuty > 0) {
          alerts.push({
            type: "warning",
            severity: "warning",
            title: "Approaching weekly on-duty limit",
            description: `${driver.name} has about ${computed.remainingWeeklyOnDuty.toFixed(1)} hours left in the 70-hour / 8-day window`,
            driverId: driver.id,
            driverName: driver.name,
          })
        }

        if (computed.weeklyCapViolation) {
          alerts.push({
            type: "critical",
            severity: "critical",
            title: "Weekly on-duty limit",
            description: `${driver.name} exceeds the 70-hour / 8-day on-duty cap (simplified calculation)`,
            driverId: driver.id,
            driverName: driver.name,
          })
        }

        if (computed.remainingDriving <= 0) {
          alerts.push({
            type: "critical",
            severity: "critical",
            title: "Driving Limit Reached",
            description: `${driver.name} has reached the 11-hour driving limit`,
            driverId: driver.id,
            driverName: driver.name,
          })
        }
      }
    } catch {
      return { error: "Failed to load HOS data for alerts", data: null }
    }
  }

  return {
    data: alerts,
    error: null,
  }
}

function formatHoursParts(hours: number): string {
  const h = Math.max(0, Math.floor(hours))
  const m = Math.round((hours - h) * 60)
  return `${h}h ${String(m).padStart(2, "0")}m`
}

function deriveDutyFromTodayLogs(logs: EldLogLike[]): {
  dutyKey: string
  label: string
} {
  if (!logs.length) {
    return { dutyKey: "unknown", label: "No duty today" }
  }
  const sorted = [...logs].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  const open = [...sorted].reverse().find((l) => !l.end_time)
  if (open) {
    const key = open.log_type || "unknown"
    return {
      dutyKey: key,
      label:
        key === "driving"
          ? "Driving"
          : key === "on_duty"
            ? "On duty"
            : key === "sleeper_berth"
              ? "Sleeper"
              : key === "off_duty"
                ? "Off duty"
                : key.replace(/_/g, " "),
    }
  }
  return { dutyKey: "off_duty", label: "Off duty" }
}

type LogWithLocation = EldLogLike & {
  location_start?: unknown
  location_end?: unknown
}

function locationLineFromLogOrLoc(
  logs: EldLogLike[],
  loc: { address?: string | null; latitude?: number | string | null; longitude?: number | string | null } | null
): string | null {
  if (loc?.address && String(loc.address).trim()) {
    return String(loc.address).trim()
  }
  const last = [...logs].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )[0] as LogWithLocation | undefined
  const end = last?.location_end as { address?: string } | undefined
  const start = last?.location_start as { address?: string } | undefined
  if (end?.address) return String(end.address)
  if (start?.address) return String(start.address)
  if (loc && loc.latitude != null && loc.longitude != null) {
    return `${Number(loc.latitude).toFixed(3)}, ${Number(loc.longitude).toFixed(3)}`
  }
  return null
}

export type FleetHosSnapshotRow = {
  driverId: string
  driverName: string
  truckLabel: string
  dutyKey: string
  statusLabel: string
  rowTone: "driving" | "on_duty" | "off" | "violation"
  drivingLeftDisplay: string
  onDutyLeftDisplay: string
  lastLocation: string | null
  openViolationCount: number
  approachingLimit: boolean
}

/**
 * Fleet-wide HOS snapshot for the ELD overview: one row per driver with clocks, duty, location, violations.
 */
export async function getFleetHOSSnapshot() {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null as FleetHosSnapshotRow[] | null }
    }

    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    if (role === "driver") {
      return { error: "Fleet view is not available for driver accounts", data: null }
    }

    const driversResult = await getDrivers({ limit: 100 })
    if (driversResult.error || !driversResult.data) {
      return { error: driversResult.error || "Could not load drivers", data: null }
    }

    const drivers = driversResult.data
    if (drivers.length === 0) {
      return { data: [], error: null }
    }

    const supabase = await createClient()
    const targetDate = calendarDateYmdLocal(new Date())
    const driverIds = drivers.map((d: { id: string }) => d.id)

    const truckIds = [
      ...new Set(
        drivers
          .map((d: { truck_id?: string | null }) => d.truck_id)
          .filter((id: string | null | undefined): id is string => Boolean(id))
      ),
    ]

    const [trucksRes, eventsRes] = await Promise.all([
      truckIds.length
        ? supabase.from("trucks").select("id, truck_number").eq("company_id", ctx.companyId).in("id", truckIds)
        : Promise.resolve({ data: [] as { id: string; truck_number: string }[], error: null as null }),
      supabase
        .from("eld_events")
        .select("driver_id")
        .eq("company_id", ctx.companyId)
        .eq("event_type", "hos_violation")
        .eq("resolved", false)
        .in("driver_id", driverIds),
    ])

    if (eventsRes.error) {
      return { error: eventsRes.error.message, data: null }
    }
    if (trucksRes.error) {
      return { error: trucksRes.error.message, data: null }
    }

    let logsByDriverHos: Map<string, { today: EldLogLike[]; week: EldLogLike[] }>
    try {
      logsByDriverHos = await fetchLogsByDriverForHos(supabase, ctx.companyId, driverIds, targetDate)
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Failed to load ELD logs", data: null }
    }

    const nowMs = Date.now()
    const hosMap = computeHosMapForDrivers(driverIds, logsByDriverHos, nowMs)

    const truckMap = new Map<string, string>()
    for (const t of trucksRes.data || []) {
      truckMap.set(t.id, t.truck_number)
    }

    const openViolationsByDriver = new Map<string, number>()
    for (const e of eventsRes.data || []) {
      const did = (e as { driver_id?: string | null }).driver_id
      if (!did) continue
      openViolationsByDriver.set(did, (openViolationsByDriver.get(did) || 0) + 1)
    }

    const latestLocByDriver = new Map<string, { address?: string | null; latitude?: number | string | null; longitude?: number | string | null }>()
    const { data: locRpc, error: locRpcErr } = await supabase.rpc("get_latest_eld_locations_for_drivers", {
      p_company_id: ctx.companyId,
      p_driver_ids: driverIds,
    })
    if (!locRpcErr && Array.isArray(locRpc)) {
      for (const loc of locRpc) {
        const row = loc as {
          driver_id: string
          address?: string | null
          latitude?: number | string | null
          longitude?: number | string | null
        }
        if (row.driver_id) {
          latestLocByDriver.set(String(row.driver_id), row)
        }
      }
    } else {
      const { data: locRows, error: locErr } = await supabase
        .from("eld_locations")
        .select("driver_id, timestamp, address, latitude, longitude")
        .eq("company_id", ctx.companyId)
        .in("driver_id", driverIds)
        .order("timestamp", { ascending: false })
        .limit(800)
      if (!locErr) {
        for (const loc of locRows || []) {
          const did = (loc as { driver_id?: string | null }).driver_id
          if (!did || latestLocByDriver.has(did)) continue
          latestLocByDriver.set(did, loc as { address?: string | null; latitude?: number | string | null; longitude?: number | string | null })
        }
      }
    }

    const rows: FleetHosSnapshotRow[] = []

    for (const d of drivers) {
      const driverId = d.id as string
      const name = (d.name as string) || "Driver"
      const tid = d.truck_id as string | null | undefined
      const truckLabel = tid ? truckMap.get(tid) || "—" : "—"

      const buckets = logsByDriverHos.get(driverId) || { today: [], week: [] }
      const computed = hosMap.get(driverId)!
      const duty = deriveDutyFromTodayLogs(buckets.today)
      const openCount = openViolationsByDriver.get(driverId) || 0

      const inViolation = computed.violations.length > 0 || openCount > 0

      const approachingLimit =
        !inViolation &&
        (computed.remainingDriving < 1 ||
          computed.remainingOnDuty < 1 ||
          computed.remainingWeeklyOnDuty < 1 ||
          computed.needsBreak ||
          computed.weeklyCapViolation)

      let rowTone: FleetHosSnapshotRow["rowTone"] = "off"
      if (inViolation) rowTone = "violation"
      else if (duty.dutyKey === "driving") rowTone = "driving"
      else if (duty.dutyKey === "on_duty") rowTone = "on_duty"

      const hideClocks = computed.violations.length > 0
      const drivingLeftDisplay = hideClocks ? "—" : formatHoursParts(computed.remainingDriving)
      const onDutyLeftDisplay = hideClocks ? "—" : formatHoursParts(computed.remainingOnDuty)

      const lastLocation = locationLineFromLogOrLoc(buckets.today, latestLocByDriver.get(driverId) || null)

      rows.push({
        driverId,
        driverName: name,
        truckLabel,
        dutyKey: duty.dutyKey,
        statusLabel: inViolation ? "In violation" : duty.label,
        rowTone,
        drivingLeftDisplay,
        onDutyLeftDisplay,
        lastLocation,
        openViolationCount: openCount,
        approachingLimit,
      })
    }

    return { data: rows, error: null }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load fleet HOS"
    return { error: message, data: null }
  }
}

export type ViolationRepeatOffenderRow = {
  driverId: string
  driverName: string
  count: number
}

/** Drivers with 2+ HOS violation events in the last 30 days (all severities). */
export async function getViolationRepeatOffendersLast30Days() {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null as ViolationRepeatOffenderRow[] | null }
    }

    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    if (role === "driver") {
      return { error: "Not available for driver accounts", data: null }
    }

    const supabase = await createClient()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await supabase
      .from("eld_events")
      .select("driver_id")
      .eq("company_id", ctx.companyId)
      .eq("event_type", "hos_violation")
      .gte("event_time", since)
      .not("driver_id", "is", null)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    const counts = new Map<string, number>()
    for (const e of events || []) {
      const id = (e as { driver_id: string }).driver_id
      counts.set(id, (counts.get(id) || 0) + 1)
    }

    const repeatIds = [...counts.entries()].filter(([, n]) => n >= 2).map(([id]) => id)
    if (repeatIds.length === 0) {
      return { data: [], error: null }
    }

    const { data: driverRows, error: dErr } = await supabase
      .from("drivers")
      .select("id, name")
      .eq("company_id", ctx.companyId)
      .in("id", repeatIds)

    if (dErr) {
      return { error: dErr.message, data: null }
    }

    const nameById = new Map<string, string>()
    for (const r of driverRows || []) {
      nameById.set((r as { id: string }).id, (r as { name: string }).name || "Driver")
    }

    const data: ViolationRepeatOffenderRow[] = repeatIds
      .map((driverId: string) => ({
        driverId,
        driverName: nameById.get(driverId) || "Unknown driver",
        count: counts.get(driverId) || 0,
      }))
      .sort((a, b) => b.count - a.count)

    return { data, error: null }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load repeat offenders"
    return { error: message, data: null }
  }
}
