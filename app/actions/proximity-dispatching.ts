"use server"

/**
 * Proximity Dispatching with PostGIS + HOS Filtering
 * Find closest available drivers near a load pickup location
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { geocodeAddress } from "./integrations-google-maps"

export interface NearbyDriver {
  driver_id: string
  driver_name: string
  truck_id: string
  truck_number: string
  current_latitude: number
  current_longitude: number
  distance_meters: number
  distance_miles: number
  remaining_drive_hours: number
  remaining_on_duty_hours: number
  current_status: string
  last_location_timestamp: string
}

export interface ProximityDispatchingOptions {
  max_radius_km?: number // Maximum search radius in kilometers (default: 50km)
  min_drive_hours?: number // Minimum remaining drive time required (default: 4 hours)
  min_on_duty_hours?: number // Minimum remaining on-duty time required (default: 6 hours)
  limit?: number // Number of results to return (default: 3)
}

/**
 * Find nearby drivers for a load using PostGIS proximity + HOS filtering
 */
export async function findNearbyDriversForLoad(
  loadId: string,
  options?: ProximityDispatchingOptions
): Promise<{ data: NearbyDriver[] | null; error: string | null }> {
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
    // First, get the load and its pickup coordinates
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, origin, shipper_address, shipper_city, shipper_state, shipper_zip, shipper_latitude, shipper_longitude, origin_coordinates")
      .eq("id", loadId)
      .eq("company_id", company_id)
      .single()

    if (loadError || !load) {
      return { error: "Load not found", data: null }
    }

    // Get pickup coordinates
    let pickupLat: number | null = null
    let pickupLng: number | null = null

    // Try to get coordinates from various fields
    if (load.shipper_latitude && load.shipper_longitude) {
      pickupLat = load.shipper_latitude
      pickupLng = load.shipper_longitude
    } else if (load.origin_coordinates) {
      const coords = typeof load.origin_coordinates === 'string' 
        ? JSON.parse(load.origin_coordinates) 
        : load.origin_coordinates
      pickupLat = coords?.lat || coords?.latitude
      pickupLng = coords?.lng || coords?.longitude
    }

    // If no coordinates, try to geocode the address
    if (!pickupLat || !pickupLng) {
      const address = load.shipper_address 
        ? `${load.shipper_address}, ${load.shipper_city || ''}, ${load.shipper_state || ''} ${load.shipper_zip || ''}`.trim()
        : load.origin

      if (address) {
        const geocodeResult = await geocodeAddress(address)
        if (geocodeResult.data) {
          pickupLat = geocodeResult.data.lat
          pickupLng = geocodeResult.data.lng
        }
      }
    }

    if (!pickupLat || !pickupLng) {
      return { 
        error: "Could not determine pickup location coordinates. Please add coordinates to the load.", 
        data: null 
      }
    }

    // Set default options
    const maxRadiusMeters = (options?.max_radius_km || 50) * 1000
    const minDriveHours = options?.min_drive_hours || 4.0
    const minOnDutyHours = options?.min_on_duty_hours || 6.0
    const limit = options?.limit || 3

    // Call PostGIS function to find nearby drivers
    const { data: drivers, error } = await supabase.rpc('find_nearby_drivers_for_load', {
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      company_id_param: company_id,
      max_radius_meters: maxRadiusMeters,
      min_drive_hours: minDriveHours,
      min_on_duty_hours: minOnDutyHours,
      limit_results: limit
    })

    if (error) {
      console.error('Proximity dispatching error:', error)
      return { error: error.message || "Failed to find nearby drivers", data: null }
    }

    return { data: drivers || [], error: null }
  } catch (error: any) {
    console.error('Proximity dispatching exception:', error)
    return { error: error.message || "Failed to find nearby drivers", data: null }
  }
}

/**
 * Find nearby drivers by coordinates (for manual searches)
 */
export async function findNearbyDriversByCoordinates(
  latitude: number,
  longitude: number,
  options?: ProximityDispatchingOptions
): Promise<{ data: NearbyDriver[] | null; error: string | null }> {
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
    const maxRadiusMeters = (options?.max_radius_km || 50) * 1000
    const minDriveHours = options?.min_drive_hours || 4.0
    const minOnDutyHours = options?.min_on_duty_hours || 6.0
    const limit = options?.limit || 3

    const { data: drivers, error } = await supabase.rpc('find_nearby_drivers_for_load', {
      pickup_lat: latitude,
      pickup_lng: longitude,
      company_id_param: company_id,
      max_radius_meters: maxRadiusMeters,
      min_drive_hours: minDriveHours,
      min_on_duty_hours: minOnDutyHours,
      limit_results: limit
    })

    if (error) {
      return { error: error.message || "Failed to find nearby drivers", data: null }
    }

    return { data: drivers || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find nearby drivers", data: null }
  }
}

