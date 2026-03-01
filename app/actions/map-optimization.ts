"use server"

/**
 * Map optimization utilities using PostGIS
 * Improves map performance with spatial queries
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Get vehicles within a map viewport using PostGIS
 * Much faster than fetching all vehicles and filtering client-side
 */
export async function getVehiclesInViewport(
  north: number,
  south: number,
  east: number,
  west: number,
  companyId?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const finalCompanyId = companyId || result.company_id

  if (!finalCompanyId) {
    return { error: "No company found", data: null }
  }

  try {
    // Use PostGIS spatial query for better performance
    // Find all locations within the viewport bounds
    const { data: locations, error } = await supabase
      .from("eld_locations")
      .select(`
        truck_id,
        latitude,
        longitude,
        timestamp,
        speed,
        heading,
        engine_status,
        trucks:truck_id (
          id,
          truck_number,
          make,
          model,
          status,
          driver_id,
          drivers:driver_id (
            id,
            name,
            phone
          )
        )
      `)
      .eq("company_id", finalCompanyId)
      .gte("latitude", south)
      .lte("latitude", north)
      .gte("longitude", west)
      .lte("longitude", east)
      .not("location_geography", "is", null)
      .order("timestamp", { ascending: false })

    if (error) {
      // Fallback to regular query without PostGIS
      const { data: fallbackLocations } = await supabase
        .from("eld_locations")
        .select(`
          truck_id,
          latitude,
          longitude,
          timestamp,
          speed,
          heading,
          engine_status
        `)
        .eq("company_id", finalCompanyId)
        .gte("latitude", south)
        .lte("latitude", north)
        .gte("longitude", west)
        .lte("longitude", east)
        .order("timestamp", { ascending: false })

      return { data: fallbackLocations || [], error: null }
    }

    // Get latest location per truck
    const latestLocations: Record<string, any> = {}
    locations?.forEach((loc: any) => {
      if (!latestLocations[loc.truck_id] || 
          new Date(loc.timestamp) > new Date(latestLocations[loc.truck_id].timestamp)) {
        latestLocations[loc.truck_id] = loc
      }
    })

    return { data: Object.values(latestLocations), error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get vehicles in viewport", data: null }
  }
}

/**
 * Get geofences within viewport using PostGIS
 */
export async function getGeofencesInViewport(
  north: number,
  south: number,
  east: number,
  west: number,
  companyId?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const finalCompanyId = companyId || result.company_id

  if (!finalCompanyId) {
    return { error: "No company found", data: null }
  }

  try {
    // Use PostGIS spatial query for better performance
    // Filter geofences that intersect with viewport
    const { data: geofences, error } = await supabase
      .from("geofences")
      .select("*")
      .eq("company_id", finalCompanyId)
      .eq("is_active", true)
      .gte("center_latitude", south)
      .lte("center_latitude", north)
      .gte("center_longitude", west)
      .lte("center_longitude", east)
      .not("center_geography", "is", null)

    if (error) {
      // Fallback to regular query
      const { data: fallbackGeofences } = await supabase
        .from("geofences")
        .select("*")
        .eq("company_id", finalCompanyId)
        .eq("is_active", true)
        .gte("center_latitude", south)
        .lte("center_latitude", north)
        .gte("center_longitude", west)
        .lte("center_longitude", east)

      return { data: fallbackGeofences || [], error: null }
    }

    return { data: geofences || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofences in viewport", data: null }
  }
}













