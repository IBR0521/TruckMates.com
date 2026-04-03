"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import { computeDailyRemainingFromEldLogs } from "@/lib/hos/compute-daily-remaining"

/** `public.eld_logs` — supabase/eld_schema.sql */
const ELD_LOGS_SELECT =
  "id, company_id, eld_device_id, driver_id, truck_id, log_date, log_type, start_time, end_time, duration_minutes, location_start, location_end, odometer_start, odometer_end, miles_driven, engine_hours, violations, raw_data, created_at, updated_at"

/** `public.eld_events` — eld_schema.sql + fault columns in eld_fault_code_maintenance.sql */
const ELD_EVENTS_SELECT =
  "id, company_id, eld_device_id, driver_id, truck_id, event_type, severity, title, description, event_time, location, resolved, resolved_at, resolved_by, metadata, created_at, fault_code, fault_code_category, fault_code_description, maintenance_created, maintenance_id"

// Calculate remaining HOS hours for a driver
export async function calculateRemainingHOS(driverId: string, date?: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  const targetDate = date || calendarDateYmdLocal(new Date())

  // Get all logs for the driver for the current day (same calendar day as duty inserts)
  // V3-007 FIX: Add LIMIT (single day should be safe, but add limit for safety)
  let query = supabase
    .from("eld_logs")
    .select(ELD_LOGS_SELECT)
    .eq("driver_id", driverId)
    .eq("log_date", targetDate)
    .order("start_time", { ascending: true })
    .limit(500) // V3-007: Limit per day (should be more than enough for one day)

  if (ctx.companyId) {
    query = query.eq("company_id", ctx.companyId)
  }

  const { data: logs, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  const computed = computeDailyRemainingFromEldLogs(logs || [], Date.now())

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

// Get fleet health metrics
export async function getFleetHealth() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get all devices
  const { data: devices, error: devicesError } = await supabase
    .from("eld_devices")
    .select("id, status, truck_id")
    .eq("company_id", ctx.companyId)

  if (devicesError) {
    return { error: devicesError.message, data: null }
  }

  // Get active violations (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: activeViolations, error: violationsError } = await supabase
    .from("eld_events")
    .select("id, severity, resolved")
    .eq("company_id", ctx.companyId)
    .eq("event_type", "hos_violation")
    .eq("resolved", false)
    .gte("event_time", yesterday)

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  // Get drivers approaching limits
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")

  if (driversError) {
    return { error: driversError.message, data: null }
  }

  // Calculate drivers approaching limits
  let driversApproachingLimit = 0
  for (const driver of drivers || []) {
    const hos = await calculateRemainingHOS(driver.id)
    if (hos.data && (hos.data.remainingDriving < 2 || hos.data.needsBreak)) {
      driversApproachingLimit++
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
    return { error: error.message, data: null }
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

  // Check each driver
  for (const driver of drivers || []) {
    const hos = await calculateRemainingHOS(driver.id)
    if (hos.data) {
      // Alert if less than 2 hours remaining
      if (hos.data.remainingDriving < 2 && hos.data.remainingDriving > 0) {
        alerts.push({
          type: "warning",
          severity: "warning",
          title: "Driver Approaching Driving Limit",
          description: `${driver.name} has ${hos.data.remainingDriving.toFixed(1)} hours of driving time remaining`,
          driverId: driver.id,
          driverName: driver.name,
          remainingHours: hos.data.remainingDriving,
        })
      }

      // Alert if break needed
      if (hos.data.needsBreak) {
        alerts.push({
          type: "critical",
          severity: "critical",
          title: "Break Required",
          description: `${driver.name} needs a 30-minute break (has driven 8+ hours)`,
          driverId: driver.id,
          driverName: driver.name,
        })
      }

      // Alert if limit reached
      if (hos.data.remainingDriving <= 0) {
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
  }

  return {
    data: alerts,
    error: null,
  }
}
