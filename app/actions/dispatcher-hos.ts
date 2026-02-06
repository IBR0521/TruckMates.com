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
    const truckIds = drivers.filter(d => d.truck_id).map(d => d.truck_id) as string[]
    const trucksMap = new Map<string, string>()
    
    if (truckIds.length > 0) {
      const { data: trucks } = await supabase
        .from("trucks")
        .select("id, truck_number")
        .in("id", truckIds)
      
      if (trucks) {
        trucks.forEach(truck => {
          trucksMap.set(truck.id, truck.truck_number)
        })
      }
    }

    // Get HOS status for each driver
    const driversWithHOS = await Promise.all(
      drivers.map(async (driver) => {
        const hosResult = await calculateRemainingHOS(driver.id)
        
        // Get current status from latest log
        const { data: latestLog } = await supabase
          .from("eld_logs")
          .select("log_type, end_time")
          .eq("driver_id", driver.id)
          .order("start_time", { ascending: false })
          .limit(1)
          .single()

        const currentStatus = latestLog?.end_time === null 
          ? latestLog?.log_type || "off_duty"
          : "off_duty"

        // Calculate weekly on-duty hours (70-hour/8-day rule)
        const eightDaysAgo = new Date()
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
        
        const { data: weeklyLogs } = await supabase
          .from("eld_logs")
          .select("log_type, duration_minutes, start_time, end_time")
          .eq("driver_id", driver.id)
          .gte("start_time", eightDaysAgo.toISOString())
          .in("log_type", ["driving", "on_duty"])

        let weeklyOnDutyMinutes = 0
        if (weeklyLogs) {
          weeklyOnDutyMinutes = weeklyLogs.reduce((sum, log) => {
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

