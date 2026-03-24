"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * IFTA State Line Crossing Detection
 * Automatically detects and logs state line crossings from GPS location data
 */

/**
 * Reverse geocode coordinates to get state information
 * Uses Google Maps Geocoding API
 */
// FIXED: Cache Google Maps API key in module scope to avoid fetching on every location update
let cachedApiKey: string | null = null
let apiKeyCacheTime: number = 0
const API_KEY_CACHE_TTL = 3600000 // 1 hour in milliseconds

// FIXED: Cache geocode results per approximate coordinate to avoid re-geocoding stationary trucks
const geocodeCache = new Map<string, { data: any; timestamp: number }>()
const GEOCODE_CACHE_TTL = 300000 // 5 minutes in milliseconds
const GEOCODE_CACHE_PRECISION = 0.001 // ~100 meters

async function reverseGeocodeCoordinates(latitude: number, longitude: number) {
  try {
    // Check cache first (for stationary trucks)
    const cacheKey = `${Math.round(latitude / GEOCODE_CACHE_PRECISION)}_${Math.round(longitude / GEOCODE_CACHE_PRECISION)}`
    const cached = geocodeCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
      return cached.data
    }
    
    // Get API key (cached in module scope)
    if (!cachedApiKey || Date.now() - apiKeyCacheTime > API_KEY_CACHE_TTL) {
      // Get Google Maps API key from environment variable
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ""
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key not configured. Please contact support.")
      }
      cachedApiKey = GOOGLE_MAPS_API_KEY
      apiKeyCacheTime = Date.now()
    }
    const apiKey = cachedApiKey

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

    const geocodeResult = {
      data: {
        state_code: stateCode,
        state_name: stateName,
        address: address,
      },
      error: null,
    }
    
    // Cache the result
    geocodeCache.set(cacheKey, { data: geocodeResult, timestamp: Date.now() })
    
    // Clean up old cache entries (keep last 1000)
    if (geocodeCache.size > 1000) {
      const entries = Array.from(geocodeCache.entries())
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      geocodeCache.clear()
      entries.slice(0, 1000).forEach(([key, value]) => geocodeCache.set(key, value))
    }
    
    return geocodeResult
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

  // FIXED: Always derive company from authenticated session; verify caller-provided company_id matches
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  if (params.company_id !== ctx.companyId) {
    return { error: "Unauthorized: company_id mismatch", data: null }
  }

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

    // FIXED: Handle NULL truck_id and driver_id correctly using .is() instead of .eq()
    // Supabase translates .eq('column', null) to WHERE column = NULL which matches nothing
    let query = supabase
      .from("state_crossings")
      .select("id, state_code, state_name, timestamp, latitude, longitude, location_geography")
      .lt("timestamp", params.timestamp)
      .order("timestamp", { ascending: false })
      .limit(1)
    
    if (params.truck_id) {
      query = query.eq("truck_id", params.truck_id)
    } else {
      query = query.is("truck_id", null)
    }
    
    if (params.driver_id) {
      query = query.eq("driver_id", params.driver_id)
    } else {
      query = query.is("driver_id", null)
    }
    
    const { data: previousCrossing, error: previousCrossingError } = await query.maybeSingle()

    if (previousCrossingError) {
      console.error("[IFTA State Crossing] Failed to load previous crossing:", previousCrossingError)
      return { error: previousCrossingError.message, data: null }
    }

    // Check if state has changed
    if (previousCrossing && previousCrossing.state_code === state_code) {
      // Same state - no crossing detected
      return { data: null, error: null } // Not an error, just no crossing
    }

    // FIXED: Log both exit and entry crossings for accurate mileage tracking
    // When state changes, log exit for previous state and entry for new state
    let crossingType = "entry"
    let previousStateCode = previousCrossing?.state_code || null
    let previousStateName = previousCrossing?.state_name || null
    
    // If state changed, we need to log both exit and entry
    if (previousCrossing && previousCrossing.state_code !== state_code) {
      // First, log exit from previous state (using the previous crossing's location)
      // Use the location data we already have from the query
      if (previousCrossing.latitude && previousCrossing.longitude) {
      
        // Insert exit crossing record for the previous state
        const { error: exitError } = await supabase
          .from("state_crossings")
          .insert({
            company_id: ctx.companyId,
            truck_id: params.truck_id,
            driver_id: params.driver_id,
            eld_device_id: params.eld_device_id,
            latitude: previousCrossing.latitude,
            longitude: previousCrossing.longitude,
            location_geography: previousCrossing.location_geography,
            address: address || params.address || null,
            state_code: previousStateCode,
            state_name: previousStateName,
            crossing_type: "exit",
            previous_state_code: null,
            previous_state_name: null,
            route_id: params.route_id || null,
            load_id: params.load_id || null,
            timestamp: params.timestamp,
            speed: params.speed || null,
            odometer: params.odometer || null,
          })
        
        if (exitError) {
          console.warn("[IFTA State Crossing] Failed to log exit crossing:", exitError)
        }
      }
      
      // Now log entry to new state
      crossingType = "entry"
    } else if (!previousCrossing) {
      // First crossing for this trip
      crossingType = "entry"
    } else {
      // Same state - no crossing detected
      return { data: null, error: null }
    }

    // Call the database function to insert the crossing
    const { data: crossingId, error: crossingError } = await supabase.rpc(
      "detect_state_crossing",
      {
        p_company_id: ctx.companyId,
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Call the database function to calculate state mileage from crossings
    const { data: stateMileage, error } = await supabase.rpc(
      "calculate_state_mileage_from_crossings",
      {
        p_company_id: ctx.companyId,
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("state_crossings")
      .select(
        "id, company_id, truck_id, driver_id, eld_device_id, latitude, longitude, location_geography, address, state_code, state_name, crossing_type, previous_state_code, previous_state_name, route_id, load_id, timestamp, speed, odometer, created_at",
      )
      .eq("company_id", ctx.companyId)
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



