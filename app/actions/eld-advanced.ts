"use server"

import { createClient } from "@/lib/supabase/server"

// HOS Rules (Hours of Service)
const HOS_RULES = {
  MAX_DRIVING_HOURS: 11, // Maximum driving hours in a day
  MAX_ON_DUTY_HOURS: 14, // Maximum on-duty hours in a day
  MIN_OFF_DUTY_HOURS: 10, // Minimum off-duty hours before next shift
  MIN_BREAK_HOURS: 0.5, // Minimum break (30 minutes) after 8 hours driving
  MAX_DRIVING_WEEK: 60, // Maximum driving hours in 7 days
  MAX_DRIVING_WEEK_8: 70, // Maximum driving hours in 8 days
}

// Calculate remaining HOS hours for a driver
export async function calculateRemainingHOS(driverId: string, date?: string) {
  const supabase = await createClient()
  const targetDate = date || new Date().toISOString().split('T')[0]

  // Get all logs for the driver for the current day
  const { data: logs, error } = await supabase
    .from("eld_logs")
    .select("*")
    .eq("driver_id", driverId)
    .eq("log_date", targetDate)
    .order("start_time", { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  // Calculate totals
  let drivingMinutes = 0
  let onDutyMinutes = 0
  let offDutyMinutes = 0
  let sleeperMinutes = 0

  logs?.forEach((log) => {
    const duration = log.duration_minutes || 0
    switch (log.log_type) {
      case "driving":
        drivingMinutes += duration
        onDutyMinutes += duration
        break
      case "on_duty":
        onDutyMinutes += duration
        break
      case "off_duty":
        offDutyMinutes += duration
        break
      case "sleeper_berth":
        sleeperMinutes += duration
        break
    }
  })

  const drivingHours = drivingMinutes / 60
  const onDutyHours = onDutyMinutes / 60
  const offDutyHours = (offDutyMinutes + sleeperMinutes) / 60

  // Calculate remaining hours
  const remainingDriving = Math.max(0, HOS_RULES.MAX_DRIVING_HOURS - drivingHours)
  const remainingOnDuty = Math.max(0, HOS_RULES.MAX_ON_DUTY_HOURS - onDutyHours)
  const needsBreak = drivingHours >= 8 && offDutyHours < HOS_RULES.MIN_BREAK_HOURS

  // Check for violations
  const violations: string[] = []
  if (drivingHours > HOS_RULES.MAX_DRIVING_HOURS) {
    violations.push(`Exceeded ${HOS_RULES.MAX_DRIVING_HOURS}-hour driving limit`)
  }
  if (onDutyHours > HOS_RULES.MAX_ON_DUTY_HOURS) {
    violations.push(`Exceeded ${HOS_RULES.MAX_ON_DUTY_HOURS}-hour on-duty limit`)
  }
  if (needsBreak) {
    violations.push("Break required: 30 minutes off-duty needed after 8 hours driving")
  }

  return {
    data: {
      drivingHours: parseFloat(drivingHours.toFixed(2)),
      onDutyHours: parseFloat(onDutyHours.toFixed(2)),
      offDutyHours: parseFloat(offDutyHours.toFixed(2)),
      remainingDriving: parseFloat(remainingDriving.toFixed(2)),
      remainingOnDuty: parseFloat(remainingOnDuty.toFixed(2)),
      needsBreak,
      violations,
      canDrive: remainingDriving > 0 && remainingOnDuty > 0 && !needsBreak,
    },
    error: null,
  }
}

// Get driver scorecard/performance metrics
export async function getDriverScorecard(driverId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end = endDate || new Date().toISOString().split('T')[0]

  // Get logs
  const { data: logs, error: logsError } = await supabase
    .from("eld_logs")
    .select("*")
    .eq("driver_id", driverId)
    .eq("company_id", userData.company_id)
    .gte("log_date", start)
    .lte("log_date", end)

  if (logsError) {
    return { error: logsError.message, data: null }
  }

  // Get violations
  const { data: violations, error: violationsError } = await supabase
    .from("eld_events")
    .select("*")
    .eq("driver_id", driverId)
    .eq("company_id", userData.company_id)
    .gte("event_time", start)
    .lte("event_time", end)

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  // Calculate metrics
  const totalDrivingHours = logs
    ?.filter((log) => log.log_type === "driving")
    .reduce((sum, log) => sum + (log.duration_minutes || 0) / 60, 0) || 0

  const totalMiles = logs
    ?.filter((log) => log.log_type === "driving")
    .reduce((sum, log) => sum + (Number(log.miles_driven) || 0), 0) || 0

  const hosViolations = violations?.filter((v) => v.event_type === "hos_violation").length || 0
  const speedingEvents = violations?.filter((v) => v.event_type === "speeding").length || 0
  const hardBraking = violations?.filter((v) => v.event_type === "hard_brake").length || 0
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get all devices
  const { data: devices, error: devicesError } = await supabase
    .from("eld_devices")
    .select("id, status, truck_id")
    .eq("company_id", userData.company_id)

  if (devicesError) {
    return { error: devicesError.message, data: null }
  }

  // Get active violations (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: activeViolations, error: violationsError } = await supabase
    .from("eld_events")
    .select("id, severity, resolved")
    .eq("company_id", userData.company_id)
    .eq("resolved", false)
    .gte("event_time", yesterday)

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  // Get drivers approaching limits
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id")
    .eq("company_id", userData.company_id)
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
  const activeDevices = devices?.filter((d) => d.status === "active").length || 0
  const totalViolations = activeViolations?.length || 0
  const criticalViolations = activeViolations?.filter((v) => v.severity === "critical").length || 0

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get latest location for each device (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

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
    .eq("company_id", userData.company_id)
    .gte("timestamp", fiveMinutesAgo)
    .order("timestamp", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  // Get most recent location per device
  const latestByDevice = new Map()
  locations?.forEach((loc) => {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get all active drivers
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("company_id", userData.company_id)
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
