"use server"

/**
 * Dispatch Timeline & Gantt Chart Calculations
 * Phase 2: Dynamic Gantt Chart View with conflict detection
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { calculateRemainingHOS } from "./eld-advanced"

export interface TimelineJob {
  id: string
  type: "load" | "route"
  shipment_number?: string
  route_name?: string
  driver_id: string | null
  driver_name: string | null
  truck_id: string | null
  truck_number: string | null
  origin: string
  destination: string
  origin_coords: { lat: number; lng: number } | null
  destination_coords: { lat: number; lng: number } | null
  scheduled_start: Date
  scheduled_end: Date
  estimated_duration_minutes: number
  drive_time_minutes: number
  status: string
  priority: string
  urgency_score: number
  conflicts: string[]
  hos_violation: boolean
}

export interface DriverTimeline {
  driver_id: string
  driver_name: string
  truck_number: string | null
  jobs: TimelineJob[]
  total_drive_time_minutes: number
  total_duration_minutes: number
  conflicts: number
  hos_violations: number
}

/**
 * Calculate drive time between two coordinates using PostGIS
 */
async function calculateDriveTime(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number
): Promise<number> {
  const supabase = await createClient()

  try {
    // Use PostGIS ST_Distance to calculate distance
    const { data, error } = await supabase.rpc("calculate_drive_time", {
      origin_lat: originLat,
      origin_lng: originLng,
      destination_lat: destinationLat,
      destination_lng: destinationLng,
    })

    if (error || !data) {
      // Fallback to Haversine + average speed (55 mph)
      const distance = haversineDistance(originLat, originLng, destinationLat, destinationLng)
      return Math.ceil((distance / 55) * 60) // Convert to minutes
    }

    // Handle array response (PostgreSQL returns table as array)
    const result = Array.isArray(data) ? data[0] : data
    return result?.drive_time_minutes || Math.ceil((result?.distance_miles || 0) / 55 * 60)
  } catch (error) {
    // Fallback calculation
    const distance = haversineDistance(originLat, originLng, destinationLat, destinationLng)
    return Math.ceil((distance / 55) * 60)
  }
}

/**
 * Haversine distance calculation (fallback)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get coordinates from address (simplified - would use geocoding in production)
 */
async function getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
  // In production, use Google Maps Geocoding API
  // For now, return null and handle gracefully
  return null
}

/**
 * Check for HOS violations in a timeline
 */
async function checkHOSViolations(
  driverId: string,
  jobs: TimelineJob[]
): Promise<{ violations: string[]; canComplete: boolean }> {
  if (!driverId) {
    return { violations: [], canComplete: true }
  }

  try {
    const hosResult = await calculateRemainingHOS(driverId)
    const remainingDrive = hosResult.data?.remainingDriving || 0
    const remainingOnDuty = hosResult.data?.remainingOnDuty || 0

    const totalDriveTime = jobs.reduce((sum, job) => sum + job.drive_time_minutes, 0)
    const totalOnDutyTime = jobs.reduce((sum, job) => sum + job.estimated_duration_minutes, 0)

    const violations: string[] = []
    const driveHours = totalDriveTime / 60
    const onDutyHours = totalOnDutyTime / 60

    if (driveHours > remainingDrive) {
      violations.push(
        `Insufficient drive time: Need ${driveHours.toFixed(1)}h, have ${remainingDrive.toFixed(1)}h`
      )
    }

    if (onDutyHours > remainingOnDuty) {
      violations.push(
        `Insufficient on-duty time: Need ${onDutyHours.toFixed(1)}h, have ${remainingOnDuty.toFixed(1)}h`
      )
    }

    return {
      violations,
      canComplete: violations.length === 0,
    }
  } catch (error) {
    return { violations: [], canComplete: true }
  }
}

/**
 * Detect conflicts between jobs (overlapping times)
 */
function detectConflicts(jobs: TimelineJob[]): TimelineJob[] {
  const jobsWithConflicts = jobs.map((job) => ({
    ...job,
    conflicts: [] as string[],
  }))

  for (let i = 0; i < jobsWithConflicts.length; i++) {
    for (let j = i + 1; j < jobsWithConflicts.length; j++) {
      const job1 = jobsWithConflicts[i]
      const job2 = jobsWithConflicts[j]

      // Check if jobs overlap
      const job1Start = new Date(job1.scheduled_start).getTime()
      const job1End = new Date(job1.scheduled_end).getTime()
      const job2Start = new Date(job2.scheduled_start).getTime()
      const job2End = new Date(job2.scheduled_end).getTime()

      if (
        (job1Start <= job2Start && job2Start < job1End) ||
        (job2Start <= job1Start && job1Start < job2End)
      ) {
        job1.conflicts.push(
          job2.type === "load" ? job2.shipment_number || "Load" : job2.route_name || "Route"
        )
        job2.conflicts.push(
          job1.type === "load" ? job1.shipment_number || "Load" : job1.route_name || "Route"
        )
      }
    }
  }

  return jobsWithConflicts
}

/**
 * Get timeline for all drivers with assigned loads/routes
 */
export async function getDriverTimelines(filters?: {
  driver_id?: string
  start_date?: Date
  end_date?: Date
}): Promise<{
  data: DriverTimeline[] | null
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
    const startDate = filters?.start_date || new Date()
    const endDate = filters?.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Get all assigned loads
    const { data: loads, error: loadsError } = await supabase
      .from("loads")
      .select(
        `
        id,
        shipment_number,
        origin,
        destination,
        driver_id,
        truck_id,
        load_date,
        estimated_delivery,
        status,
        priority,
        urgency_score,
        coordinates,
        driver:driver_id (
          id,
          name
        ),
        truck:truck_id (
          id,
          truck_number
        )
      `
      )
      .eq("company_id", company_id)
      .not("driver_id", "is", null)
      .not("load_date", "is", null)
      .gte("load_date", startDate.toISOString().split("T")[0])
      .lte("estimated_delivery", endDate.toISOString().split("T")[0])
      .in("status", ["scheduled", "in_transit", "in_progress"])

    if (loadsError) {
      return { error: loadsError.message, data: null }
    }

    // Get all assigned routes
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select(
        `
        id,
        name,
        origin,
        destination,
        driver_id,
        truck_id,
        estimated_arrival,
        estimated_time,
        created_at,
        status,
        priority,
        driver:driver_id (
          id,
          name
        ),
        truck:truck_id (
          id,
          truck_number
        )
      `
      )
      .eq("company_id", company_id)
      .not("driver_id", "is", null)
      .in("status", ["scheduled", "in_progress", "in_transit"])

    if (routesError) {
      return { error: routesError.message, data: null }
    }

    // Convert to timeline jobs
    const allJobs: TimelineJob[] = []

    // Process loads
    for (const load of loads || []) {
      const loadDate = load.load_date ? new Date(load.load_date) : new Date()
      const deliveryDate = load.estimated_delivery
        ? new Date(load.estimated_delivery)
        : new Date(loadDate.getTime() + 24 * 60 * 60 * 1000)

      // Get coordinates if available
      let originCoords: { lat: number; lng: number } | null = null
      let destCoords: { lat: number; lng: number } | null = null

      if (load.coordinates) {
        try {
          const coords = typeof load.coordinates === "string" ? JSON.parse(load.coordinates) : load.coordinates
          if (coords.lat && coords.lng) {
            originCoords = { lat: coords.lat, lng: coords.lng }
          }
        } catch (error) {
          // Ignore coordinate parsing errors
        }
      }

      // Estimate drive time (simplified - would use PostGIS in production)
      const driveTimeMinutes = originCoords && destCoords
        ? await calculateDriveTime(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
        : 480 // Default 8 hours if no coordinates

      const durationMinutes = Math.max(
        Math.ceil((deliveryDate.getTime() - loadDate.getTime()) / (1000 * 60)),
        driveTimeMinutes
      )

      allJobs.push({
        id: load.id,
        type: "load",
        shipment_number: load.shipment_number,
        driver_id: load.driver_id,
        driver_name: (load.driver as any)?.name || null,
        truck_id: load.truck_id,
        truck_number: (load.truck as any)?.truck_number || null,
        origin: load.origin,
        destination: load.destination,
        origin_coords: originCoords,
        destination_coords: destCoords,
        scheduled_start: loadDate,
        scheduled_end: deliveryDate,
        estimated_duration_minutes: durationMinutes,
        drive_time_minutes: driveTimeMinutes,
        status: load.status,
        priority: load.priority || "normal",
        urgency_score: load.urgency_score || 0,
        conflicts: [],
        hos_violation: false,
      })
    }

    // Process routes
    for (const route of routes || []) {
      // Use created_at as start date, or current date if not available
      const startDate = route.created_at ? new Date(route.created_at) : new Date()
      
      // Use estimated_arrival as end date, or calculate from estimated_time, or default to 24 hours later
      let endDate: Date
      if (route.estimated_arrival) {
        endDate = new Date(route.estimated_arrival)
      } else if (route.estimated_time) {
        // Parse estimated_time (e.g., "3h 30m") and add to start date
        const timeMatch = route.estimated_time.match(/(\d+)h\s*(\d+)?m?/)
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]) || 0
          const minutes = parseInt(timeMatch[2]) || 0
          endDate = new Date(startDate.getTime() + (hours * 60 + minutes) * 60 * 1000)
        } else {
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        }
      } else {
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      }

      // Estimate drive time
      const driveTimeMinutes = 480 // Default 8 hours

      const durationMinutes = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60))

      allJobs.push({
        id: route.id,
        type: "route",
        route_name: route.name,
        driver_id: route.driver_id,
        driver_name: (route.driver as any)?.name || null,
        truck_id: route.truck_id,
        truck_number: (route.truck as any)?.truck_number || null,
        origin: route.origin,
        destination: route.destination,
        origin_coords: null,
        destination_coords: null,
        scheduled_start: startDate,
        scheduled_end: endDate,
        estimated_duration_minutes: durationMinutes,
        drive_time_minutes: driveTimeMinutes,
        status: route.status,
        priority: route.priority || "normal",
        urgency_score: 0,
        conflicts: [],
        hos_violation: false,
      })
    }

    // Group by driver and detect conflicts
    const driverMap = new Map<string, DriverTimeline>()

    for (const job of allJobs) {
      if (!job.driver_id) continue

      if (!driverMap.has(job.driver_id)) {
        driverMap.set(job.driver_id, {
          driver_id: job.driver_id,
          driver_name: job.driver_name || "Unknown Driver",
          truck_number: job.truck_number,
          jobs: [],
          total_drive_time_minutes: 0,
          total_duration_minutes: 0,
          conflicts: 0,
          hos_violations: 0,
        })
      }

      const timeline = driverMap.get(job.driver_id)!
      timeline.jobs.push(job)
    }

    // Detect conflicts and HOS violations for each driver
    const timelines: DriverTimeline[] = []

    for (const [driverId, timeline] of driverMap.entries()) {
      // Sort jobs by scheduled start time
      timeline.jobs.sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      )

      // Detect conflicts
      const jobsWithConflicts = detectConflicts(timeline.jobs)
      timeline.jobs = jobsWithConflicts
      timeline.conflicts = jobsWithConflicts.filter((j) => j.conflicts.length > 0).length

      // Check HOS violations
      const hosCheck = await checkHOSViolations(driverId, timeline.jobs)
      timeline.hos_violations = hosCheck.violations.length

      // Mark jobs with HOS violations
      if (hosCheck.violations.length > 0) {
        timeline.jobs = timeline.jobs.map((job) => ({
          ...job,
          hos_violation: true,
        }))
      }

      // Calculate totals
      timeline.total_drive_time_minutes = timeline.jobs.reduce(
        (sum, job) => sum + job.drive_time_minutes,
        0
      )
      timeline.total_duration_minutes = timeline.jobs.reduce(
        (sum, job) => sum + job.estimated_duration_minutes,
        0
      )

      timelines.push(timeline)
    }

    // Filter by driver_id if specified
    if (filters?.driver_id) {
      return {
        data: timelines.filter((t) => t.driver_id === filters.driver_id),
        error: null,
      }
    }

    return { data: timelines, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get driver timelines", data: null }
  }
}

/**
 * Get timeline for a specific load/route to check for conflicts before assignment
 */
export async function checkAssignmentConflicts(
  driverId: string,
  loadId?: string,
  routeId?: string
): Promise<{
  data: {
    conflicts: string[]
    hos_violations: string[]
    can_assign: boolean
  } | null
  error: string | null
}> {
  if (!driverId || (!loadId && !routeId)) {
    return { error: "Driver ID and load/route ID required", data: null }
  }

  try {
    // Get existing timeline for driver
    const timelineResult = await getDriverTimelines({ driver_id: driverId })
    if (timelineResult.error || !timelineResult.data) {
      return { error: timelineResult.error || "Failed to get timeline", data: null }
    }

    const existingTimeline = timelineResult.data[0]
    if (!existingTimeline) {
      return {
        data: {
          conflicts: [],
          hos_violations: [],
          can_assign: true,
        },
        error: null,
      }
    }

    // Get the new job details
    const supabase = await createClient()
    let newJob: TimelineJob | null = null

    if (loadId) {
      const { data: load } = await supabase
        .from("loads")
        .select("*")
        .eq("id", loadId)
        .single()

      if (load) {
        const loadDate = load.load_date ? new Date(load.load_date) : new Date()
        const deliveryDate = load.estimated_delivery
          ? new Date(load.estimated_delivery)
          : new Date(loadDate.getTime() + 24 * 60 * 60 * 1000)

        newJob = {
          id: load.id,
          type: "load",
          shipment_number: load.shipment_number,
          driver_id: driverId,
          driver_name: null,
          truck_id: null,
          truck_number: null,
          origin: load.origin,
          destination: load.destination,
          origin_coords: null,
          destination_coords: null,
          scheduled_start: loadDate,
          scheduled_end: deliveryDate,
          estimated_duration_minutes: Math.ceil(
            (deliveryDate.getTime() - loadDate.getTime()) / (1000 * 60)
          ),
          drive_time_minutes: 480,
          status: load.status,
          priority: load.priority || "normal",
          urgency_score: load.urgency_score || 0,
          conflicts: [],
          hos_violation: false,
        }
      }
    }

    if (!newJob) {
      return { error: "Load/route not found", data: null }
    }

    // Check for conflicts with existing jobs
    const allJobs = [...existingTimeline.jobs, newJob]
    const jobsWithConflicts = detectConflicts(allJobs)
    const newJobConflicts = jobsWithConflicts.find((j) => j.id === newJob!.id)?.conflicts || []

    // Check HOS violations
    const hosCheck = await checkHOSViolations(driverId, allJobs)
    const hosViolations = hosCheck.violations

    return {
      data: {
        conflicts: newJobConflicts,
        hos_violations: hosViolations,
        can_assign: newJobConflicts.length === 0 && hosViolations.length === 0,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to check conflicts", data: null }
  }
}

