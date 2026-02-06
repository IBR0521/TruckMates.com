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
import { getCachedUserCompany } from "@/lib/query-optimizer"
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
    // Get load details
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("*")
      .eq("id", loadId)
      .eq("company_id", company_id)
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
      .eq("company_id", company_id)
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

    // Score and rank drivers
    const suggestions: DriverSuggestion[] = []

    for (const driver of nearbyResult.data) {
      // Check for conflicts
      const conflictCheck = await checkAssignmentConflicts(driver.driver_id, loadId, undefined)

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

      // Equipment match (if truck has required equipment, +10 points)
      let equipmentMatch = false
      if (requirements.equipment_type && driver.truck_id) {
        // Get truck details to check equipment type
        const { data: truck } = await supabase
          .from("trucks")
          .select("carrier_type, make, model")
          .eq("id", driver.truck_id)
          .single()
        
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

      // Penalties
      if (conflictCheck.data?.conflicts.length || 0 > 0) {
        score -= 20 // Conflict penalty
      }
      if (conflictCheck.data?.hos_violations.length || 0 > 0) {
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
      if (conflictCheck.data?.conflicts.length || 0 > 0) {
        reasons.push(`⚠️ Has ${conflictCheck.data.conflicts.length} scheduling conflict(s)`)
      }
      if (conflictCheck.data?.hos_violations.length || 0 > 0) {
        reasons.push(`⚠️ HOS violation: ${conflictCheck.data.hos_violations[0]}`)
      }

      suggestions.push({
        driver_id: driver.driver_id,
        driver_name: driver.driver_name,
        truck_id: driver.truck_id,
        truck_number: driver.truck_number,
        score: Math.max(0, Math.min(100, score)),
        reasons,
        distance_miles: driver.distance_miles,
        remaining_drive_hours: driver.remaining_drive_hours,
        remaining_on_duty_hours: driver.remaining_on_duty_hours,
        current_status: driver.current_status,
        equipment_match: equipmentMatch || false,
        can_complete: conflictCheck.data?.can_assign || false,
        conflicts: conflictCheck.data?.conflicts || [],
        hos_violations: conflictCheck.data?.hos_violations || [],
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
  // Similar to load suggestions but for routes
  // Simplified for now - can be enhanced later
  return { error: "Route suggestions not yet implemented", data: null }
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

    if (conflictCheck.data?.conflicts.length || 0 > 0) {
      errors.push(`Scheduling conflicts: ${conflictCheck.data?.conflicts.join(", ")}`)
    }

    if (conflictCheck.data?.hos_violations.length || 0 > 0) {
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

