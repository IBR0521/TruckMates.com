"use server"

/**
 * Dispatcher HOS Functions
 * Get real-time HOS status for all drivers for dispatcher dashboard
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { calculateRemainingHOS } from "./eld-advanced"

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

/**
 * Get HOS status for all active drivers
 */
export async function getAllDriversHOSStatus(): Promise<{
  data: DriverHOSStatus[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get all active drivers
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name, status, truck_id")
      .eq("company_id", company_id)
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
    const driverIds = drivers.map((d: { id: string; truck_id: string | null }) => d.id)
    const eightDaysAgo = new Date()
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
    
    // Fetch all logs for all drivers in one query
    const { data: allLogs } = await supabase
      .from("eld_logs")
      .select("driver_id, log_type, duration_minutes, start_time, end_time")
      .in("driver_id", driverIds)
      .gte("start_time", eightDaysAgo.toISOString())
      .order("start_time", { ascending: false })
    
    // Group logs by driver_id
    const logsByDriver = new Map<string, typeof allLogs>()
    if (allLogs) {
      allLogs.forEach((log: { driver_id: string; log_type: string; duration_minutes: number | null; start_time: string; end_time: string | null }) => {
        if (!logsByDriver.has(log.driver_id)) {
          logsByDriver.set(log.driver_id, [])
        }
        logsByDriver.get(log.driver_id)!.push(log)
      })
    }

    // Get HOS status for each driver (now using batched data)
    const driversWithHOS = await Promise.all(
      drivers.map(async (driver: { id: string; name: string; truck_id: string | null }) => {
        const hosResult = await calculateRemainingHOS(driver.id)
        
        // Get current status from latest log (from batched data)
        const driverLogs = logsByDriver.get(driver.id) || []
        const latestLog = driverLogs[0] // Already sorted by start_time desc
        
        const currentStatus = latestLog?.end_time === null 
          ? latestLog?.log_type || "off_duty"
          : "off_duty"

        // Calculate weekly on-duty hours (70-hour/8-day rule) from batched data
        const weeklyLogs = driverLogs.filter((log: { driver_id: string; log_type: string; duration_minutes: number | null; start_time: string; end_time: string | null }) => 
          ["driving", "on_duty"].includes(log.log_type)
        )

        let weeklyOnDutyMinutes = 0
        if (weeklyLogs) {
          weeklyOnDutyMinutes = weeklyLogs.reduce((sum: number, log: { driver_id: string; log_type: string; duration_minutes: number | null; start_time: string; end_time: string | null }) => {
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
  } catch (error: any) {
    return { error: error.message || "Failed to get drivers HOS status", data: null }
  }
}

