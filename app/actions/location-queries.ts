"use server"

/**
 * PostGIS Location Queries
 * Advanced spatial queries using PostGIS functions
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Prevent unbounded `eld_locations` growth:
    // Always query only a recent time window, even if caller didn't pass it.
    const nowISO = new Date().toISOString()
    const defaultStartISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // last 24 hours
    const startTime = filters?.start_time || defaultStartISO
    const endTime = filters?.end_time || nowISO
    const limit = filters?.limit ?? 200

    // Prefer the newer, bounded RPC (if deployed); fall back to the legacy RPC.
    let data: any[] = []
    let rpcError: any = null
    try {
      const rpcResult = await supabase.rpc('find_locations_within_radius_filtered', {
        center_lat: centerLat,
        center_lng: centerLng,
        radius_meters: radiusMeters,
        start_time: startTime,
        end_time: endTime,
        p_limit: limit
      })
      if (rpcResult.error) {
        rpcError = rpcResult.error
      } else {
        data = rpcResult.data || []
      }
    } catch (err: any) {
      rpcError = err
    }

    if (rpcError) {
      const legacyResult = await supabase.rpc('find_locations_within_radius', {
        center_lat: centerLat,
        center_lng: centerLng,
        radius_meters: radiusMeters
      })

      if (legacyResult.error) {
        return { error: legacyResult.error.message, data: null }
      }

      data = legacyResult.data || []
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
        const locationIds = new Set(locations.map((l: { id: string; [key: string]: any }) => l.id))
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
        const locationIds = new Set(locations.map((l: { id: string; [key: string]: any }) => l.id))
        filteredData = filteredData.filter((d: any) => locationIds.has(d.id))
      }
    }

    // Filter by time window (handles both `timestamp` and `location_timestamp` fields).
    filteredData = filteredData.filter((d: any) => {
      const ts = d.timestamp ?? d.location_timestamp
      if (!ts) return false
      const ms = new Date(ts).getTime()
      if (!Number.isFinite(ms)) return false
      return ms >= new Date(startTime).getTime() && ms <= new Date(endTime).getTime()
    })

    filteredData = filteredData.slice(0, limit)

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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const company_id = filters?.company_id || ctx.companyId
  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Use PostGIS native ST_Distance with ORDER BY LIMIT for efficient nearest neighbor query
    // This replaces the N+1 query pattern with a single spatial query
    const { data, error } = await supabase.rpc('find_nearest_locations', {
      center_lat: centerLat,
      center_lng: centerLng,
      p_company_id: company_id,
      p_device_id: filters?.device_id || null,
      p_truck_id: filters?.truck_id || null,
      p_limit: limit
    })

    if (error) {
      // Fallback to old method if RPC function doesn't exist
      console.warn('PostGIS nearest locations RPC failed, using fallback:', error)
      
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

      const { data: locations, error: fallbackError } = await query

      if (fallbackError) {
        return { error: fallbackError.message, data: null }
      }

      if (!locations || locations.length === 0) {
        return { data: [], error: null }
      }

      // Calculate distances using PostGIS for each location (fallback only)
      const locationsWithDistance = await Promise.all(
        locations.map(async (loc: { id: string; latitude: number; longitude: number; timestamp: string; speed: number | null; heading: number | null; eld_device_id: string | null; truck_id: string | null; driver_id: string | null; [key: string]: any }) => {
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
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find nearest locations", data: null }
  }
}

