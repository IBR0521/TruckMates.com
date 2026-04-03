"use server"

/**
 * Dispatcher HOS Functions
 * Get real-time HOS status for all drivers for dispatcher dashboard
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { computeDailyRemainingFromEldLogs } from "@/lib/hos/compute-daily-remaining"

type EldLog = {
  driver_id: string
  log_date: string
  log_type: string
  duration_minutes: number | null
  start_time: string
  end_time: string | null
  created_at: string
}

export interface DriverHOSStatus {
  driver_id: string
  driver_name: string
  truck_id: string | null
  truck_number: string | null
  current_status: string
  remaining_drive_hours: number
  remaining_on_duty_hours: number
  weekly_on_duty_hours: number
  remaining_weekly_hours: number
  needs_break: boolean
  violations: string[]
  can_drive: boolean
  last_update: string
}

type DriverRow = {
  id: string
  user_id?: string | null
  name: string
  status: string
  truck_id: string | null
}

/**
 * `public.drivers` can contain multiple rows for the same person (mobile `ensureDriver` +
 * web reconciliation). HOS must show one card per logical driver and merge ELD logs keyed
 * by any of the duplicate `drivers.id` values.
 */
function clusterActiveDriversForHos(drivers: DriverRow[]): { canonical: DriverRow; allDriverIds: string[] }[] {
  const byUserId = new Map<string, DriverRow[]>()
  const noUser: DriverRow[] = []
  for (const d of drivers) {
    const u = d.user_id?.trim()
    if (u) {
      if (!byUserId.has(u)) byUserId.set(u, [])
      byUserId.get(u)!.push(d)
    } else {
      noUser.push(d)
    }
  }
  const clusters: { canonical: DriverRow; allDriverIds: string[] }[] = []
  for (const rows of byUserId.values()) {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id))
    clusters.push({ canonical: sorted[0], allDriverIds: sorted.map((r) => r.id) })
  }
  const namesWithUserId = new Set([...byUserId.values()].flat().map((d) => d.name.trim().toLowerCase()))
  const byName = new Map<string, DriverRow[]>()
  for (const d of noUser) {
    const nk = d.name.trim().toLowerCase()
    if (namesWithUserId.has(nk)) continue
    if (!byName.has(nk)) byName.set(nk, [])
    byName.get(nk)!.push(d)
  }
  for (const rows of byName.values()) {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id))
    clusters.push({ canonical: sorted[0], allDriverIds: sorted.map((r) => r.id) })
  }
  return clusters
}

function mergeClusterLogs(
  logsByDriver: Map<string, EldLog[]>,
  allDriverIds: string[],
  userId: string | null | undefined
): EldLog[] {
  const merged: EldLog[] = []
  const seen = new Set<string>()
  function take(logs: EldLog[] | undefined) {
    for (const log of logs || []) {
      const k = `${log.driver_id}|${log.start_time}|${log.log_type}|${log.log_date || ""}`
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(log)
    }
  }
  for (const id of allDriverIds) {
    take(logsByDriver.get(id))
  }
  if (userId) {
    take(logsByDriver.get(userId))
  }
  return merged
}

/** Shared by dispatcher UI and `GET /api/dispatch/hos` so numbers always match. */
export async function computeDriversHOSStatusWithCompany(
  companyId: string,
  clientFactory: () => Promise<any> | any
): Promise<{ data: DriverHOSStatus[] | null; error: string | null }> {
  const supabase = await clientFactory()
  // Get all active drivers
  const { data: driversRaw, error: driversError } = await supabase
    .from("drivers")
    .select("id, user_id, name, status, truck_id")
    .eq("company_id", companyId)
    .eq("status", "active")

  if (driversError) {
    return { error: driversError.message, data: null }
  }

  if (!driversRaw || driversRaw.length === 0) {
    return { data: [], error: null }
  }

  const drivers = driversRaw as DriverRow[]
  const clusters = clusterActiveDriversForHos(drivers)

  // Get truck numbers for drivers that have trucks assigned
  const truckIds = clusters
    .map((c) => c.canonical.truck_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  const trucksMap = new Map<string, string>()
  
  if (truckIds.length > 0) {
    const { data: trucks } = await supabase
      .from("trucks")
      .select("id, truck_number")
      .in("id", truckIds)
    
    if (trucks) {
      trucks.forEach((truck: { id: string; truck_number: string | null }) => {
        trucksMap.set(truck.id, truck.truck_number || "")
      })
    }
  }

  // Batch fetch all ELD logs for all drivers to avoid N+1 queries (include every duplicate id)
  const allPhysicalDriverIds = clusters.flatMap((c) => c.allDriverIds)
  const driverUserIds = clusters
    .map((c) => c.canonical.user_id)
    .filter((id: string | null | undefined): id is string => typeof id === "string" && id.length > 0)
  const logDriverIds = Array.from(new Set([...allPhysicalDriverIds, ...driverUserIds]))
  const eightDaysAgo = new Date()
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
  
  // Fetch all logs for all drivers in one query
  const { data: allLogs } = await supabase
    .from("eld_logs")
    .select("driver_id, log_date, log_type, duration_minutes, start_time, end_time, created_at")
    .in("driver_id", logDriverIds)
    .gte("start_time", eightDaysAgo.toISOString())
    .order("start_time", { ascending: false })
  
  // Group logs by driver_id
  const logsByDriver = new Map<string, EldLog[]>()
  if (allLogs) {
    allLogs.forEach((log: EldLog) => {
      if (!logsByDriver.has(log.driver_id)) {
        logsByDriver.set(log.driver_id, [])
      }
      logsByDriver.get(log.driver_id)!.push(log)
    })
  }

  // Get HOS status for each logical driver (one card per cluster; logs merged across duplicate rows)
  const driversWithHOS = await Promise.all(
    clusters.map(async ({ canonical: driver, allDriverIds }) => {
      const merged = mergeClusterLogs(logsByDriver, allDriverIds, driver.user_id)
      const driverLogs = merged.sort((a, b) => {
        const byStart = new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        if (byStart !== 0) return byStart
        return new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime()
      })
      const latestOpenLog = driverLogs.find((log) => log.end_time === null)
      const latestLog = latestOpenLog || driverLogs[0]
      const today = new Date().toISOString().split("T")[0]
      // Same math as `/api/eld/mobile/logs` + `calculateRemainingHOS`: use today's logs for this driver only.
      // Match on `log_date` and fall back to `start_time` UTC date so rows still count if `log_date` was wrong/missing.
      const todayLogs = driverLogs.filter((log) => {
        if (log.log_date === today) return true
        const startDay = typeof log.start_time === "string" ? log.start_time.slice(0, 10) : ""
        return startDay === today
      })
      const hosComputed = computeDailyRemainingFromEldLogs(todayLogs, Date.now())

      const currentStatus = latestLog?.log_type || "off_duty"

      // Calculate weekly on-duty hours (70-hour/8-day rule) from batched data
      const weeklyLogs = driverLogs.filter((log) => 
        ["driving", "on_duty"].includes(log.log_type)
      )

      let weeklyOnDutyMinutes = 0
      if (weeklyLogs) {
        weeklyOnDutyMinutes = weeklyLogs.reduce((sum: number, log) => {
          let duration = log.duration_minutes
          if (!duration && log.start_time && log.end_time) {
            duration = Math.floor((new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 60000)
          }
          return sum + (duration || 0)
        }, 0)
      }

      const weeklyOnDutyHours = weeklyOnDutyMinutes / 60
      const remainingWeeklyHours = Math.max(0, 70 - weeklyOnDutyHours)

      return {
        driver_id: driver.id,
        driver_name: driver.name,
        truck_id: driver.truck_id,
        truck_number: driver.truck_id ? trucksMap.get(driver.truck_id) || null : null,
        current_status: currentStatus,
        remaining_drive_hours: hosComputed.remainingDriving,
        remaining_on_duty_hours: hosComputed.remainingOnDuty,
        weekly_on_duty_hours: parseFloat(weeklyOnDutyHours.toFixed(2)),
        remaining_weekly_hours: parseFloat(remainingWeeklyHours.toFixed(2)),
        needs_break: hosComputed.needsBreak,
        violations: hosComputed.violations,
        can_drive: hosComputed.canDrive,
        last_update: new Date().toISOString(),
      } as DriverHOSStatus
    })
  )

  return { data: driversWithHOS, error: null }
}

export async function getAllDriversHOSStatusByCompany(companyId: string): Promise<{
  data: DriverHOSStatus[] | null
  error: string | null
}> {
  try {
    return await computeDriversHOSStatusWithCompany(companyId, () => createAdminClient())
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get drivers HOS status"), data: null }
  }
}

/**
 * Get HOS status for all active drivers
 */
export async function getAllDriversHOSStatus(): Promise<{
  data: DriverHOSStatus[] | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Same admin client as `/api/dispatch/hos` so RLS never hides `eld_logs` rows the API can see.
    return await computeDriversHOSStatusWithCompany(ctx.companyId, () => createAdminClient())
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get drivers HOS status"), data: null }
  }
}

