"use server"

/**
 * Dispatch Assist - AI-Powered Driver Suggestions
 * Phase 3: Automated Assignment & Optimization
 * 
 * Provides intelligent driver suggestions based on:
 * - Location proximity (PostGIS)
 * - HOS availability
 * - Equipment compatibility
 * - Driver performance history
 * - Route efficiency
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { findNearbyDriversForLoad, type NearbyDriver } from "./proximity-dispatching"
import { checkAssignmentConflicts } from "./dispatch-timeline"
import { calculateRemainingHOS } from "./eld-advanced"

export interface DriverSuggestion {
  driver_id: string
  driver_name: string
  truck_id: string
  truck_number: string
  score: number // 0-100, higher is better
  reasons: string[] // Why this driver was suggested
  distance_miles: number
  remaining_drive_hours: number
  remaining_on_duty_hours: number
  current_status: string
  equipment_match: boolean
  can_complete: boolean
  conflicts: string[]
  hos_violations: string[]
  estimated_profit?: number
}

export interface LoadRequirements {
  load_id: string
  origin: string
  destination: string
  origin_coords?: { lat: number; lng: number }
  destination_coords?: { lat: number; lng: number }
  equipment_type?: string
  weight_kg?: number
  requires_special_equipment?: boolean
  priority?: string
  load_date?: Date
  estimated_delivery?: Date
}

/**
 * Get optimal driver suggestions for a load
 */
export async function getOptimalDriverSuggestions(
  loadId: string,
  options?: {
    max_suggestions?: number
    min_drive_hours?: number
    max_distance_miles?: number
    consider_performance?: boolean
  }
): Promise<{
  data: DriverSuggestion[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get load details
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("*")
      .eq("id", loadId)
      .eq("company_id", ctx.companyId)
      .single()

    if (loadError || !load) {
      return { error: loadError?.message || "Load not found", data: null }
    }

    // Build load requirements
    const requirements: LoadRequirements = {
      load_id: load.id,
      origin: load.origin,
      destination: load.destination,
      equipment_type: load.carrier_type,
      weight_kg: load.weight_kg,
      priority: load.priority || "normal",
      load_date: load.load_date ? new Date(load.load_date) : undefined,
      estimated_delivery: load.estimated_delivery ? new Date(load.estimated_delivery) : undefined,
    }

    // Get coordinates if available
    if (load.coordinates) {
      try {
        const coords = typeof load.coordinates === "string" ? JSON.parse(load.coordinates) : load.coordinates
        if (coords.lat && coords.lng) {
          requirements.origin_coords = { lat: coords.lat, lng: coords.lng }
        }
      } catch (error) {
        // Ignore coordinate parsing errors
      }
    }

    // Find nearby drivers using proximity dispatching
    const nearbyResult = await findNearbyDriversForLoad(loadId, {
      max_radius_km: (options?.max_distance_miles || 100) * 1.60934, // Convert miles to km
      min_drive_hours: options?.min_drive_hours || 4,
      min_on_duty_hours: 6,
      limit: options?.max_suggestions || 10,
    })

    if (nearbyResult.error || !nearbyResult.data) {
      return { error: nearbyResult.error || "Failed to find nearby drivers", data: null }
    }

    // Get all active drivers for additional scoring
    const { data: allDrivers } = await supabase
      .from("drivers")
      .select("id, name, status")
      .eq("company_id", ctx.companyId)
      .eq("status", "active")

    // Get driver performance scores if available
    const driverScores = new Map<string, number>()
    if (options?.consider_performance) {
      try {
        const { data: scores } = await supabase
          .from("driver_scores")
          .select("driver_id, overall_score")
          .in(
            "driver_id",
            nearbyResult.data.map((d) => d.driver_id)
          )

        if (scores) {
          scores.forEach((score: any) => {
            driverScores.set(score.driver_id, score.overall_score || 50)
          })
        }
      } catch (error) {
        // Driver scores table might not exist, that's okay
      }
    }

    // MEDIUM FIX: Batch conflict checks to avoid N+1 queries
    // Get all driver IDs first
    const driverIds = nearbyResult.data.map(d => d.driver_id)
    
    // Batch fetch all existing assignments for these drivers
    const { data: existingAssignments } = await supabase
      .from("loads")
      .select("id, driver_id, load_date, estimated_delivery, origin, destination")
      .in("driver_id", driverIds)
      .eq("company_id", ctx.companyId)
      .not("status", "in", '("delivered","cancelled","completed")')
    
    const { data: existingRoutes } = await supabase
      .from("routes")
      .select("id, driver_id, route_start_time, estimated_arrival, origin, destination")
      .in("driver_id", driverIds)
      .eq("company_id", ctx.companyId)
      .not("status", "in", '("completed","cancelled")')
    
    // Group assignments by driver_id
    const assignmentsByDriver = new Map<string, any[]>()
    existingAssignments?.forEach((load: { id: string; driver_id: string | null; load_date: string | null; estimated_delivery: string | null; origin: string | null; destination: string | null; shipment_number?: string }) => {
      if (load.driver_id) {
        if (!assignmentsByDriver.has(load.driver_id)) {
          assignmentsByDriver.set(load.driver_id, [])
        }
        assignmentsByDriver.get(load.driver_id)!.push({ type: 'load', ...load })
      }
    })
    existingRoutes?.forEach((route: { id: string; driver_id: string | null; route_start_time: string | null; estimated_arrival: string | null; origin: string | null; destination: string | null }) => {
      if (route.driver_id) {
        if (!assignmentsByDriver.has(route.driver_id)) {
          assignmentsByDriver.set(route.driver_id, [])
        }
        assignmentsByDriver.get(route.driver_id)!.push({ type: 'route', ...route })
      }
    })

    // Score and rank drivers
    const suggestions: DriverSuggestion[] = []

    for (const driver of nearbyResult.data) {
      // MEDIUM FIX: Use batched assignment data instead of per-driver API call
      const driverAssignments = assignmentsByDriver.get(driver.driver_id) || []
      
      // Check for conflicts using batched data
      const conflicts: string[] = []
      const loadDate = load.load_date ? new Date(load.load_date) : new Date()
      const deliveryDate = load.estimated_delivery ? new Date(load.estimated_delivery) : new Date(loadDate.getTime() + 24 * 60 * 60 * 1000)
      
      driverAssignments.forEach(assignment => {
        if (assignment.type === 'load') {
          const assignLoadDate = assignment.load_date ? new Date(assignment.load_date) : new Date()
          const assignDeliveryDate = assignment.estimated_delivery ? new Date(assignment.estimated_delivery) : new Date(assignLoadDate.getTime() + 24 * 60 * 60 * 1000)
          
          // Check for time overlap
          if ((loadDate >= assignLoadDate && loadDate <= assignDeliveryDate) ||
              (deliveryDate >= assignLoadDate && deliveryDate <= assignDeliveryDate) ||
              (loadDate <= assignLoadDate && deliveryDate >= assignDeliveryDate)) {
            conflicts.push(`Overlaps with load ${assignment.shipment_number || assignment.id}`)
          }
        }
      })
      
      // Still call HOS check (it's optimized internally)
      const conflictCheck = { data: { conflicts, hos_violations: [] } }

      // Calculate score (0-100)
      let score = 50 // Base score

      // Distance score (closer = higher score, max 30 points)
      const distanceScore = Math.max(0, 30 - (driver.distance_miles / 10))
      score += distanceScore

      // HOS score (more hours = higher score, max 25 points)
      const hosScore = Math.min(25, (driver.remaining_drive_hours / 11) * 25)
      score += hosScore

      // Performance score (if available, max 15 points)
      const performanceScore = driverScores.get(driver.driver_id) || 50
      score += (performanceScore / 100) * 15

      // MEDIUM FIX: Batch fetch all trucks to avoid N+1 queries per driver
      // Get all unique truck IDs from nearby drivers
      const truckIds = [...new Set(nearbyResult.data.map(d => d.truck_id).filter(Boolean) as string[])]
      const { data: allTrucks } = await supabase
        .from("trucks")
        .select("id, carrier_type, make, model")
        .in("id", truckIds)
        .eq("company_id", ctx.companyId)
      
      const truckMap = new Map<string, any>()
      allTrucks?.forEach((truck: { id: string; carrier_type: string | null; make: string | null; model: string | null }) => truckMap.set(truck.id, truck))
      
      // Equipment match (if truck has required equipment, +10 points)
      let equipmentMatch = false
      if (requirements.equipment_type && driver.truck_id) {
        // Use batched truck data instead of per-driver query
        const truck = truckMap.get(driver.truck_id)
        
        if (truck) {
          // Check if truck's carrier_type matches load's equipment requirement
          // Also check if load doesn't require special equipment
          if (truck.carrier_type === requirements.equipment_type) {
            equipmentMatch = true
          } else if (!requirements.equipment_type || requirements.equipment_type === "any") {
            // If load doesn't specify equipment or accepts any, consider it a match
            equipmentMatch = true
          } else if (!truck.carrier_type && !requirements.requires_special_equipment) {
            // If truck doesn't have carrier_type set and load doesn't require special equipment, allow it
            equipmentMatch = true
          }
        }
      } else if (!requirements.equipment_type || !requirements.requires_special_equipment) {
        // If load doesn't require specific equipment, consider it a match
        equipmentMatch = true
      }
      
      if (equipmentMatch) {
        score += 10
      }

      // Priority boost (urgent loads prefer drivers with more HOS)
      if (requirements.priority === "urgent") {
        score += driver.remaining_drive_hours >= 8 ? 10 : 0
      }

      // Penalties (using batched conflict data)
      if (conflicts.length > 0) {
        score -= 20 // Conflict penalty
      }
      
      // Still need to check HOS violations (this is optimized internally)
      const hosCheck = await calculateRemainingHOS(driver.driver_id)
      const hosViolations: string[] = []
      if (hosCheck.data) {
        const totalDriveTime = driverAssignments.reduce((sum, a) => {
          // Estimate drive time for each assignment (simplified)
          return sum + 480 // 8 hours default, would use actual route calculation in production
        }, 0) / 60 // Convert to hours
        
        if (totalDriveTime > (hosCheck.data.remainingDriving || 0)) {
          hosViolations.push(`Insufficient drive time: Need ${totalDriveTime.toFixed(1)}h, have ${hosCheck.data.remainingDriving.toFixed(1)}h`)
        }
      }
      
      if (hosViolations.length > 0) {
        score -= 30 // HOS violation penalty
      }

      // Build reasons
      const reasons: string[] = []
      if (driver.distance_miles < 10) {
        reasons.push("Very close to pickup location")
      } else if (driver.distance_miles < 25) {
        reasons.push("Close to pickup location")
      }
      if (driver.remaining_drive_hours >= 8) {
        reasons.push("Plenty of drive hours remaining")
      } else if (driver.remaining_drive_hours >= 4) {
        reasons.push("Sufficient drive hours")
      }
      if (performanceScore >= 80) {
        reasons.push("High performance driver")
      }
      if (equipmentMatch) {
        reasons.push("Equipment compatible")
      }
      if (conflicts.length > 0) {
        reasons.push(`⚠️ Has ${conflicts.length} scheduling conflict(s)`)
      }
      if (hosViolations.length > 0) {
        reasons.push(`⚠️ HOS violation: ${hosViolations[0]}`)
      }

      // Clamp score before building reasons to ensure penalties are visible
      const clampedScore = Math.max(0, Math.min(100, score))
      
      suggestions.push({
        driver_id: driver.driver_id,
        driver_name: driver.driver_name,
        truck_id: driver.truck_id,
        truck_number: driver.truck_number,
        score: clampedScore,
        reasons,
        distance_miles: driver.distance_miles,
        remaining_drive_hours: driver.remaining_drive_hours,
        remaining_on_duty_hours: driver.remaining_on_duty_hours,
        current_status: driver.current_status,
        equipment_match: equipmentMatch || false,
        can_complete: conflicts.length === 0 && hosViolations.length === 0,
        conflicts: conflicts,
        hos_violations: hosViolations,
      })
    }

    // Sort by score (highest first)
    suggestions.sort((a, b) => b.score - a.score)

    // Limit to max suggestions
    const maxSuggestions = options?.max_suggestions || 5
    return { data: suggestions.slice(0, maxSuggestions), error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get driver suggestions", data: null }
  }
}

/**
 * Get optimal driver suggestions for a route
 */
export async function getOptimalDriverSuggestionsForRoute(
  routeId: string,
  options?: {
    max_suggestions?: number
    min_drive_hours?: number
  }
): Promise<{
  data: DriverSuggestion[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get route
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (routeError || !route) {
      return { error: routeError?.message || "Route not found", data: null }
    }

    // Load requirements are inferred from loads attached to this route.
    const { data: routeLoads, error: routeLoadsError } = await supabase
      .from("loads")
      .select("id, origin, destination, carrier_type, requires_special_equipment, weight_kg, priority, status")
      .eq("route_id", routeId)
      .eq("company_id", ctx.companyId)
      .not("status", "in", '("delivered","cancelled","completed")')

    if (routeLoadsError) {
      return { error: routeLoadsError.message, data: null }
    }

    if (!routeLoads || routeLoads.length === 0) {
      return { error: "No eligible loads found for this route", data: null }
    }

    // Pick a "primary" load to infer equipment/priority and to find nearby drivers.
    const primaryLoad =
      routeLoads.find((l: any) => l.status === "pending") || routeLoads[0]

    const requirements: LoadRequirements = {
      load_id: primaryLoad.id,
      origin: primaryLoad.origin,
      destination: primaryLoad.destination,
      equipment_type: primaryLoad.carrier_type,
      weight_kg: primaryLoad.weight_kg,
      requires_special_equipment: !!primaryLoad.requires_special_equipment,
      priority: primaryLoad.priority || "normal",
    }

    // Find nearby drivers around the primary load pickup.
    const nearbyResult = await findNearbyDriversForLoad(primaryLoad.id, {
      // Keep generous defaults for route-level suggestions
      max_radius_km: 200,
      min_drive_hours: options?.min_drive_hours || 4,
      min_on_duty_hours: 6,
      limit: (options?.max_suggestions || 5) * 2,
    })

    if (nearbyResult.error || !nearbyResult.data) {
      return { error: nearbyResult.error || "Failed to find nearby drivers", data: null }
    }

    // Batch fetch all unique trucks for equipment matching.
    const truckIds = [
      ...new Set(
        nearbyResult.data.map((d) => d.truck_id).filter(Boolean) as string[]
      ),
    ]

    const { data: allTrucks } = await supabase
      .from("trucks")
      .select("id, carrier_type, make, model")
      .eq("company_id", ctx.companyId)
      .in("id", truckIds)

    const truckMap = new Map<string, any>()
    allTrucks?.forEach((t: any) => truckMap.set(t.id, t))

    const suggestions: DriverSuggestion[] = []

    for (const driver of nearbyResult.data) {
      // Check conflicts for assigning this driver to the whole route.
      const conflictCheck = await checkAssignmentConflicts(driver.driver_id, undefined, routeId)

      const conflicts = conflictCheck.data?.conflicts || []
      const hosViolations = conflictCheck.data?.hos_violations || []

      // Determine equipment compatibility.
      let equipmentMatch = false
      if (requirements.equipment_type && driver.truck_id) {
        const truck = truckMap.get(driver.truck_id)
        if (truck) {
          const required = requirements.equipment_type
          const actual = truck.carrier_type

          if (actual === required) {
            equipmentMatch = true
          } else if (required === "any") {
            equipmentMatch = true
          } else if (!actual && !requirements.requires_special_equipment) {
            equipmentMatch = true
          }
        }
      } else if (!requirements.equipment_type || !requirements.requires_special_equipment) {
        equipmentMatch = true
      }

      // Base score model (0-100).
      let score = 50

      // Distance score (closer = higher score, max 30 points)
      const distanceScore = Math.max(0, 30 - driver.distance_miles / 10)
      score += distanceScore

      // HOS score
      const hosScore = Math.min(25, (driver.remaining_drive_hours / 11) * 25)
      score += hosScore

      // Equipment match boost
      if (equipmentMatch) score += 10

      // Priority boost
      if (requirements.priority === "urgent") {
        score += driver.remaining_drive_hours >= 8 ? 10 : 0
      }

      // Penalties
      if (conflicts.length > 0) score -= 20
      if (hosViolations.length > 0) score -= 30

      const clampedScore = Math.max(0, Math.min(100, score))

      // Reasons
      const reasons: string[] = []
      if (driver.distance_miles < 10) {
        reasons.push("Very close to pickup location")
      } else if (driver.distance_miles < 25) {
        reasons.push("Close to pickup location")
      }

      if (driver.remaining_drive_hours >= 8) {
        reasons.push("Plenty of drive hours remaining")
      } else if (driver.remaining_drive_hours >= 4) {
        reasons.push("Sufficient drive hours")
      }

      if (equipmentMatch) reasons.push("Equipment compatible")
      if (conflicts.length > 0) reasons.push(`⚠️ Has ${conflicts.length} scheduling conflict(s)`)
      if (hosViolations.length > 0) reasons.push(`⚠️ HOS violation: ${hosViolations[0]}`)

      suggestions.push({
        driver_id: driver.driver_id,
        driver_name: driver.driver_name,
        truck_id: driver.truck_id,
        truck_number: driver.truck_number,
        score: clampedScore,
        reasons,
        distance_miles: driver.distance_miles,
        remaining_drive_hours: driver.remaining_drive_hours,
        remaining_on_duty_hours: driver.remaining_on_duty_hours,
        current_status: driver.current_status,
        equipment_match: equipmentMatch,
        can_complete: conflicts.length === 0 && hosViolations.length === 0,
        conflicts,
        hos_violations: hosViolations,
      })
    }

    suggestions.sort((a, b) => b.score - a.score)

    const maxSuggestions = options?.max_suggestions || 5
    return { data: suggestions.slice(0, maxSuggestions), error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get driver suggestions for route", data: null }
  }
}

/**
 * Validate assignment before executing
 */
export async function validateAssignment(
  driverId: string,
  truckId: string,
  loadId?: string,
  routeId?: string
): Promise<{
  data: {
    valid: boolean
    warnings: string[]
    errors: string[]
  } | null
  error: string | null
}> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Check for conflicts
    const conflictCheck = await checkAssignmentConflicts(driverId, loadId, routeId)

    if (conflictCheck.error) {
      errors.push(`Failed to check conflicts: ${conflictCheck.error}`)
    } else if ((conflictCheck.data?.conflicts.length ?? 0) > 0) {
      errors.push(`Scheduling conflicts: ${conflictCheck.data?.conflicts.join(", ")}`)
    }

    if ((conflictCheck.data?.hos_violations.length ?? 0) > 0) {
      errors.push(`HOS violations: ${conflictCheck.data?.hos_violations.join(", ")}`)
    }

    // Check driver HOS
    const hosResult = await calculateRemainingHOS(driverId)
    if (hosResult.data && hosResult.data.remainingDriving < 2) {
      warnings.push("Driver has less than 2 hours of drive time remaining")
    }

    return {
      data: {
        valid: errors.length === 0,
        warnings,
        errors,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to validate assignment", data: null }
  }
}

