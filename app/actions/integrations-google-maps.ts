"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Google Maps Integration Backend
 * Provides routing, geocoding, and distance calculations
 */

// Get Google Maps API key (platform-wide, from environment)
async function getGoogleMapsApiKey() {
  // Always use platform API key from environment variables
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ""

  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured. Please contact support.")
  }

  // Check if integration is enabled for this company
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    throw new Error(ctx.error || "Not authenticated")
  }

  // Check if integration is enabled, or auto-enable if platform key exists
  const { data: integrations, error: integrationError } = await supabase
    .from("company_integrations")
    .select("google_maps_enabled")
    .eq("company_id", ctx.companyId)
    .single()

  // Auto-enable Google Maps if platform API key exists and integration record doesn't exist or is disabled
  if (integrationError?.code === "PGRST116" || !integrations?.google_maps_enabled) {
    // Check if record exists
    const { data: existing } = await supabase
      .from("company_integrations")
      .select("id")
      .eq("company_id", ctx.companyId)
      .single()

    if (existing) {
      // Update existing record to enable Google Maps
      const { error: updateError } = await supabase
        .from("company_integrations")
        .update({ google_maps_enabled: true })
        .eq("company_id", ctx.companyId)
      
      if (updateError) {
        Sentry.captureException(updateError)
      }
    } else {
      // Create new record with Google Maps enabled
      const { error: insertError } = await supabase
        .from("company_integrations")
        .insert({
          company_id: ctx.companyId,
          google_maps_enabled: true,
        })
      
      if (insertError) {
        Sentry.captureException(insertError)
      }
    }
  }

  return GOOGLE_MAPS_API_KEY
}

/**
 * Get route directions and distance
 */
export async function getRouteDirections(origin: string, destination: string, waypoints?: string[]) {
  try {
    // Check rate limit and cache
    const { checkApiUsage, getCachedApiResult, setCachedApiResult } = await import("@/lib/api-protection")
    const { generateCacheKey } = await import("@/lib/api-cache-utils")
    
    const cacheKey = generateCacheKey("google_maps_directions", { origin, destination, waypoints })
    
    // Check cache first
    const cached = await getCachedApiResult<any>(cacheKey, 3600) // Cache for 1 hour
    if (cached) {
      return { data: cached, error: null }
    }

    // Check rate limit
    const rateCheck = await checkApiUsage("google_maps", "directions")
    if (!rateCheck.allowed) {
      return { error: rateCheck.reason || "Rate limit exceeded", data: null }
    }

    const apiKey = await getGoogleMapsApiKey()

    // Build waypoints parameter
    let waypointsParam = ""
    if (waypoints && waypoints.length > 0) {
      waypointsParam = `&waypoints=${waypoints.map(wp => encodeURIComponent(wp)).join("|")}`
    }

    // Add departure_time=now for real-time traffic data
    const departureTime = Math.floor(Date.now() / 1000) // Current time in seconds
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&key=${apiKey}&avoid=tolls&vehicleType=TRUCK&departure_time=${departureTime}&traffic_model=best_guess`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get directions from Google Maps")
    }

    const data = await response.json()

    if (data.status !== "OK") {
      return { error: `Google Maps error: ${data.status} - ${data.error_message || "Unknown error"}`, data: null }
    }

    const route = data.routes[0]
    const legs = route.legs || []
    const leg = legs[0]
    const distance_meters = legs.reduce((sum: number, l: { distance?: { value?: number } }) => sum + (l.distance?.value ?? 0), 0)
    const duration_seconds = legs.reduce((sum: number, l: { duration?: { value?: number } }) => sum + (l.duration?.value ?? 0), 0)

    const allSteps = legs.flatMap((l: { steps?: unknown[] }) =>
      Array.isArray(l?.steps) ? l.steps : [],
    )
    const result = {
      distance: leg?.distance?.text ?? "",
      distance_meters,
      duration: leg?.duration?.text ?? "",
      duration_seconds,
      polyline: route.overview_polyline.points,
      steps: allSteps.map((step: any) => ({
        instruction: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
        start_location: step.start_location,
        end_location: step.end_location,
      })),
      bounds: route.bounds,
    }

    // Cache the result
    await setCachedApiResult(cacheKey, result, 3600)

    return {
      data: result,
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to get route directions"
    return { error: message, data: null }
  }
}

/**
 * Geocode address to coordinates
 */
export async function geocodeAddress(address: string) {
  try {
    // Validate address input
    if (!address || address.trim().length < 5) {
      return { error: "Address is too short or empty. Please provide a complete address.", data: null }
    }

    // LOW FIX: Add rate limiting to prevent API quota exhaustion
    const { checkApiUsage, getCachedApiResult, setCachedApiResult } = await import("@/lib/api-protection")
    const { generateCacheKey } = await import("@/lib/api-cache-utils")
    
    const cacheKey = generateCacheKey("google_maps_geocode", { address })
    
    // Check cache first (cache for 7 days - addresses don't change often)
    const cached = await getCachedApiResult<any>(cacheKey, 604800)
    if (cached) {
      return { data: cached, error: null }
    }

    // Check rate limit (max 50 requests per minute per company)
    const rateCheck = await checkApiUsage("google_maps", "geocoding")
    if (!rateCheck.allowed) {
      return { error: rateCheck.reason || "Geocoding rate limit exceeded. Please try again in a moment.", data: null }
    }

    const apiKey = await getGoogleMapsApiKey()

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      Sentry.captureMessage(
        `[Google Maps] HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        "error",
      )
      return { 
        error: `Google Maps API returned error ${response.status}. Please check your API key and network connection.`, 
        data: null 
      }
    }

    const data = await response.json()

    if (data.status !== "OK") {
      Sentry.captureMessage(
        `[Google Maps] Geocoding status ${data.status}: ${JSON.stringify(data).slice(0, 2000)}`,
        "warning",
      )
    }

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      // Provide more specific error messages
      let errorMessage = `Geocoding failed: ${data.status}`
      if (data.status === "ZERO_RESULTS") {
        errorMessage = `Address not found: "${address}". Please check the address format (include city, state, and zip code).`
      } else if (data.status === "REQUEST_DENIED") {
        errorMessage = `Google Maps API request denied: ${data.error_message || "Check API key permissions and ensure Geocoding API is enabled"}.`
      } else if (data.status === "OVER_QUERY_LIMIT") {
        errorMessage = "Google Maps API quota exceeded. Please try again later or contact support."
      } else if (data.status === "INVALID_REQUEST") {
        errorMessage = `Invalid address format: "${address}". Please provide a complete address.`
      } else if (data.error_message) {
        errorMessage = `Geocoding failed: ${data.error_message}`
      }
      return { error: errorMessage, data: null }
    }

    const result = data.results[0]
    const geocodeResult = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
      address_components: result.address_components,
    }
    
    // Cache the result for 7 days
    await setCachedApiResult(cacheKey, geocodeResult, 604800)
    
    return {
      data: geocodeResult,
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    let userMessage = "Failed to geocode address"
    if (error instanceof Error) {
      const em = errorMessage(error)
      if (em.includes("API key")) {
        userMessage = "Google Maps API key error. Please contact support."
      } else if (em.includes("network") || em.includes("fetch")) {
        userMessage = "Network error. Please check your internet connection and try again."
      } else {
        userMessage = `Geocoding error: ${em}`
      }
    }
    return { error: userMessage, data: null }
  }
}

/**
 * Calculate distance matrix (multiple origins/destinations)
 */
export async function calculateDistanceMatrix(origins: string[], destinations: string[]) {
  try {
    const apiKey = await getGoogleMapsApiKey()

    const originsParam = origins.map(addr => encodeURIComponent(addr)).join("|")
    const destinationsParam = destinations.map(addr => encodeURIComponent(addr)).join("|")

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsParam}&destinations=${destinationsParam}&key=${apiKey}&units=imperial&vehicleType=TRUCK`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to calculate distance matrix")
    }

    const data = await response.json()

    if (data.status !== "OK") {
      return { error: `Distance matrix error: ${data.status}`, data: null }
    }

    return {
      data: {
        rows: data.rows.map((row: any) => ({
          elements: row.elements.map((element: any) => ({
            distance: element.distance?.text || "N/A",
            distance_meters: element.distance?.value || 0,
            duration: element.duration?.text || "N/A",
            duration_seconds: element.duration?.value || 0,
            status: element.status,
          })),
        })),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to calculate distance matrix"
    return { error: message, data: null }
  }
}

/**
 * Optimize route for multiple stops
 */
export async function optimizeRoute(origin: string, destination: string, stops: string[]) {
  try {
    const apiKey = await getGoogleMapsApiKey()

    // Use waypoints optimization
    const waypointsParam = stops.map(stop => encodeURIComponent(stop)).join("|")
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=optimize:true|${waypointsParam}&key=${apiKey}&vehicleType=TRUCK`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to optimize route")
    }

    const data = await response.json()

    if (data.status !== "OK") {
      return { error: `Route optimization error: ${data.status}`, data: null }
    }

    const route = data.routes[0]
    const optimizedWaypointOrder = route.waypoint_order || []

    return {
      data: {
        optimized_stops: optimizedWaypointOrder.map((index: number) => stops[index]),
        distance: route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0),
        duration: route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0),
        polyline: route.overview_polyline.points,
        legs: route.legs.map((leg: any) => ({
          distance: leg.distance.text,
          duration: leg.duration.text,
          start_address: leg.start_address,
          end_address: leg.end_address,
        })),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to optimize route"
    return { error: message, data: null }
  }
}

/**
 * Get place details (for autocomplete suggestions)
 */
export async function getPlaceDetails(placeId: string) {
  try {
    const apiKey = await getGoogleMapsApiKey()

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=formatted_address,geometry,name,place_id`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get place details")
    }

    const data = await response.json()

    if (data.status !== "OK" || !data.result) {
      return { error: `Place details error: ${data.status}`, data: null }
    }

    return {
      data: {
        formatted_address: data.result.formatted_address,
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
        name: data.result.name,
        place_id: data.result.place_id,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to get place details"
    return { error: message, data: null }
  }
}







