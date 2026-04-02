"use server"

/**
 * Dispatcher HOS Functions
 * Get real-time HOS status for all drivers for dispatcher dashboard
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { calculateRemainingHOS } from "./eld-advanced"

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

async function computeDriversHOSStatusWithCompany(
  companyId: string,
  clientFactory: () => Promise<any> | any
): Promise<{ data: DriverHOSStatus[] | null; error: string | null }> {
  const supabase = await clientFactory()
  // Get all active drivers
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, user_id, name, status, truck_id")
    .eq("company_id", companyId)
    .eq("status", "active")

  if (driversError) {
    return { error: driversError.message, data: null }
  }

  if (!drivers || drivers.length === 0) {
    return { data: [], error: null }
  }

  // Get truck numbers for drivers that have trucks assigned
  const truckIds = drivers.filter((d: { id: string; truck_id: string | null }) => d.truck_id).map((d: { id: string; truck_id: string | null }) => d.truck_id) as string[]
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

  // Batch fetch all ELD logs for all drivers to avoid N+1 queries
  const driverIds = drivers.map((d: { id: string; user_id?: string | null; truck_id: string | null }) => d.id)
  const driverUserIds = drivers
    .map((d: { id: string; user_id?: string | null; truck_id: string | null }) => d.user_id)
    .filter((id: string | null | undefined): id is string => typeof id === "string" && id.length > 0)
  const logDriverIds = Array.from(new Set([...driverIds, ...driverUserIds]))
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

  // Get HOS status for each driver (now using batched data)
  const driversWithHOS = await Promise.all(
    drivers.map(async (driver: { id: string; user_id?: string | null; name: string; truck_id: string | null }) => {
      // Get current status from latest log (from batched data)
      const idLogs = logsByDriver.get(driver.id) || []
      const userLogs = driver.user_id ? logsByDriver.get(driver.user_id) || [] : []
      const driverLogs = [...idLogs, ...userLogs].sort(
        (a, b) => {
          const byStart = new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
          if (byStart !== 0) return byStart
          return new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime()
        }
      )
      const latestOpenLog = driverLogs.find((log) => log.end_time === null)
      const latestLog = latestOpenLog || driverLogs[0]
      const today = new Date().toISOString().split("T")[0]
      const hasTodayByDriverId = idLogs.some((log) => log.log_date === today)
      const hasTodayByUserId = userLogs.some((log) => log.log_date === today)
      const hosSourceId =
        hasTodayByDriverId
          ? driver.id
          : hasTodayByUserId && driver.user_id
            ? driver.user_id
            : driver.id
      const hosResult = await calculateRemainingHOS(hosSourceId)
      
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
        remaining_drive_hours: hosResult.data?.remainingDriving || 0,
        remaining_on_duty_hours: hosResult.data?.remainingOnDuty || 0,
        weekly_on_duty_hours: parseFloat(weeklyOnDutyHours.toFixed(2)),
        remaining_weekly_hours: parseFloat(remainingWeeklyHours.toFixed(2)),
        needs_break: hosResult.data?.needsBreak || false,
        violations: hosResult.data?.violations || [],
        can_drive: hosResult.data?.canDrive || false,
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
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    return await computeDriversHOSStatusWithCompany(ctx.companyId, () => supabase)
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get drivers HOS status"), data: null }
  }
}

