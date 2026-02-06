"use server"

/**
 * PostGIS Location Queries
 * Advanced spatial queries using PostGIS functions
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Find all locations within a radius using PostGIS
 */
export async function findLocationsWithinRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  filters?: {
    device_id?: string
    truck_id?: string
    driver_id?: string
    start_time?: string
    end_time?: string
    limit?: number
  }
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
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Use PostGIS function for spatial query
    const { data, error } = await supabase.rpc('find_locations_within_radius', {
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: radiusMeters
    })

    if (error) {
      return { error: error.message, data: null }
    }

    // Apply additional filters if provided
    let filteredData = data || []

    if (filters?.device_id) {
      // Need to join with eld_locations to filter by device_id
      const { data: locations } = await supabase
        .from('eld_locations')
        .select('id, eld_device_id, truck_id, driver_id, timestamp')
        .in('id', filteredData.map((d: any) => d.id))
        .eq('eld_device_id', filters.device_id)
      
      if (locations) {
        const locationIds = new Set(locations.map(l => l.id))
        filteredData = filteredData.filter((d: any) => locationIds.has(d.id))
      }
    }

    if (filters?.truck_id) {
      const { data: locations } = await supabase
        .from('eld_locations')
        .select('id, truck_id')
        .in('id', filteredData.map((d: any) => d.id))
        .eq('truck_id', filters.truck_id)
      
      if (locations) {
        const locationIds = new Set(locations.map(l => l.id))
        filteredData = filteredData.filter((d: any) => locationIds.has(d.id))
      }
    }

    if (filters?.start_time) {
      filteredData = filteredData.filter((d: any) => 
        new Date(d.timestamp) >= new Date(filters.start_time!)
      )
    }

    if (filters?.end_time) {
      filteredData = filteredData.filter((d: any) => 
        new Date(d.timestamp) <= new Date(filters.end_time!)
      )
    }

    if (filters?.limit) {
      filteredData = filteredData.slice(0, filters.limit)
    }

    return { data: filteredData, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find locations", data: null }
  }
}

/**
 * Calculate distance between two points using PostGIS
 */
export async function calculateDistancePostGIS(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<{ distance_meters: number; distance_miles: number } | null> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('calculate_distance_postgis', {
      lat1,
      lng1,
      lat2,
      lng2
    })

    if (error) {
      console.warn('PostGIS distance calculation failed:', error)
      return null
    }

    return {
      distance_meters: data.distance_meters,
      distance_miles: data.distance_meters / 1609.34
    }
  } catch (error) {
    console.warn('PostGIS distance calculation error:', error)
    return null
  }
}

/**
 * Get nearest locations to a point using PostGIS
 */
export async function findNearestLocations(
  centerLat: number,
  centerLng: number,
  limit: number = 10,
  filters?: {
    device_id?: string
    truck_id?: string
    company_id?: string
  }
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
  const company_id = filters?.company_id || result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Use PostGIS RPC function for nearest locations
    // First get all locations, then calculate distances using PostGIS
    let query = supabase
      .from('eld_locations')
      .select('id, latitude, longitude, timestamp, speed, heading, eld_device_id, truck_id, driver_id')
      .eq('company_id', company_id)
      .not('location_geography', 'is', null)

    if (filters?.device_id) {
      query = query.eq('eld_device_id', filters.device_id)
    }

    if (filters?.truck_id) {
      query = query.eq('truck_id', filters.truck_id)
    }

    const { data: locations, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    if (!locations || locations.length === 0) {
      return { data: [], error: null }
    }

    // Calculate distances using PostGIS for each location
    const locationsWithDistance = await Promise.all(
      locations.map(async (loc) => {
        const distanceResult = await calculateDistancePostGIS(
          centerLat,
          centerLng,
          loc.latitude,
          loc.longitude
        )
        return {
          ...loc,
          distance_meters: distanceResult?.distance_meters || 0,
          distance_miles: distanceResult?.distance_miles || 0
        }
      })
    )

    // Sort by distance and limit
    locationsWithDistance.sort((a, b) => a.distance_meters - b.distance_meters)
    const limited = locationsWithDistance.slice(0, limit)

    return { data: limited, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find nearest locations", data: null }
  }
}

