"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * IFTA State Line Crossing Detection
 * Automatically detects and logs state line crossings from GPS location data
 */

/**
 * Reverse geocode coordinates to get state information
 * Uses Google Maps Geocoding API
 */
async function reverseGeocodeCoordinates(latitude: number, longitude: number) {
  try {
    const { getGoogleMapsApiKey } = await import("./integrations-google-maps")
    const apiKey = await getGoogleMapsApiKey()

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&result_type=administrative_area_level_1`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to reverse geocode coordinates")
    }

    const data = await response.json()

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return { error: `Reverse geocoding failed: ${data.status}`, data: null }
    }

    // Extract state information from address components
    const result = data.results[0]
    let stateCode: string | null = null
    let stateName: string | null = null
    let address: string | null = result.formatted_address || null

    for (const component of result.address_components || []) {
      if (component.types.includes("administrative_area_level_1")) {
        stateCode = component.short_name || null
        stateName = component.long_name || null
        break
      }
    }

    if (!stateCode || !stateName) {
      return { error: "State information not found in geocoding result", data: null }
    }

    return {
      data: {
        state_code: stateCode,
        state_name: stateName,
        address: address,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[IFTA State Crossing] Reverse geocoding error:", error)
    return { error: error?.message || "Failed to reverse geocode coordinates", data: null }
  }
}

/**
 * Detect and log state line crossing
 * Called automatically when location updates are received
 */
export async function detectStateCrossing(params: {
  company_id: string
  truck_id: string | null
  driver_id: string | null
  eld_device_id: string | null
  latitude: number
  longitude: number
  timestamp: string
  route_id?: string | null
  load_id?: string | null
  speed?: number | null
  odometer?: number | null
  address?: string | null
}) {
  const supabase = await createClient()

  try {
    // Reverse geocode to get state information
    const geocodeResult = await reverseGeocodeCoordinates(params.latitude, params.longitude)

    if (geocodeResult.error || !geocodeResult.data) {
      // If reverse geocoding fails, we can't detect state crossing
      // Log error but don't fail (location is still saved)
      console.warn("[IFTA State Crossing] Failed to get state:", geocodeResult.error)
      return { error: geocodeResult.error, data: null }
    }

    const { state_code, state_name, address } = geocodeResult.data

    // Get the most recent state crossing for this truck/driver
    const { data: previousCrossing } = await supabase
      .from("state_crossings")
      .select("state_code, state_name, timestamp")
      .eq("truck_id", params.truck_id)
      .eq("driver_id", params.driver_id)
      .lt("timestamp", params.timestamp)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()

    // Check if state has changed
    if (previousCrossing && previousCrossing.state_code === state_code) {
      // Same state - no crossing detected
      return { data: null, error: null } // Not an error, just no crossing
    }

    // State has changed or this is the first crossing - log it
    const crossingType = previousCrossing ? "entry" : "entry" // First crossing is also an entry
    const previousStateCode = previousCrossing?.state_code || null
    const previousStateName = previousCrossing?.state_name || null

    // Call the database function to insert the crossing
    const { data: crossingId, error: crossingError } = await supabase.rpc(
      "detect_state_crossing",
      {
        p_company_id: params.company_id,
        p_truck_id: params.truck_id,
        p_driver_id: params.driver_id,
        p_eld_device_id: params.eld_device_id,
        p_latitude: params.latitude,
        p_longitude: params.longitude,
        p_timestamp: params.timestamp,
        p_route_id: params.route_id || null,
        p_load_id: params.load_id || null,
        p_speed: params.speed || null,
        p_odometer: params.odometer || null,
        p_state_code: state_code,
        p_state_name: state_name,
        p_address: address || params.address || null,
      }
    )

    if (crossingError) {
      console.error("[IFTA State Crossing] Database error:", crossingError)
      return { error: crossingError.message, data: null }
    }

    return {
      data: {
        crossing_id: crossingId,
        state_code,
        state_name,
        crossing_type: crossingType,
        previous_state_code: previousStateCode,
        previous_state_name: previousStateName,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[IFTA State Crossing] Error:", error)
    return { error: error?.message || "Failed to detect state crossing", data: null }
  }
}

/**
 * Get state-by-state mileage breakdown for IFTA reporting
 */
export async function getStateMileageBreakdown(params: {
  truck_ids?: string[]
  start_date: string
  end_date: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    // Call the database function to calculate state mileage from crossings
    const { data: stateMileage, error } = await supabase.rpc(
      "calculate_state_mileage_from_crossings",
      {
        p_company_id: result.company_id,
        p_truck_ids: params.truck_ids || null,
        p_start_date: params.start_date,
        p_end_date: params.end_date,
      }
    )

    if (error) {
      console.error("[IFTA State Mileage] Database error:", error)
      return { error: error.message, data: null }
    }

    return { data: stateMileage || [], error: null }
  } catch (error: any) {
    console.error("[IFTA State Mileage] Error:", error)
    return { error: error?.message || "Failed to get state mileage breakdown", data: null }
  }
}

/**
 * Get all state crossings for a period
 */
export async function getStateCrossings(params: {
  truck_id?: string
  driver_id?: string
  start_date?: string
  end_date?: string
  limit?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    let query = supabase
      .from("state_crossings")
      .select("*")
      .eq("company_id", result.company_id)
      .order("timestamp", { ascending: false })

    if (params.truck_id) {
      query = query.eq("truck_id", params.truck_id)
    }

    if (params.driver_id) {
      query = query.eq("driver_id", params.driver_id)
    }

    if (params.start_date) {
      query = query.gte("timestamp", params.start_date)
    }

    if (params.end_date) {
      query = query.lte("timestamp", params.end_date)
    }

    if (params.limit) {
      query = query.limit(params.limit)
    }

    const { data: crossings, error } = await query

    if (error) {
      console.error("[IFTA State Crossings] Database error:", error)
      return { error: error.message, data: null }
    }

    return { data: crossings || [], error: null }
  } catch (error: any) {
    console.error("[IFTA State Crossings] Error:", error)
    return { error: error?.message || "Failed to get state crossings", data: null }
  }
}


