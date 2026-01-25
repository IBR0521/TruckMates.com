"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    throw new Error("No company found")
  }

  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("google_maps_enabled")
    .eq("company_id", result.company_id)
    .single()

  if (!integrations?.google_maps_enabled) {
    throw new Error("Google Maps integration is not enabled for your company")
  }

  return GOOGLE_MAPS_API_KEY
}

/**
 * Get route directions and distance
 */
export async function getRouteDirections(origin: string, destination: string, waypoints?: string[]) {
  try {
    const apiKey = await getGoogleMapsApiKey()

    // Build waypoints parameter
    let waypointsParam = ""
    if (waypoints && waypoints.length > 0) {
      waypointsParam = `&waypoints=${waypoints.map(wp => encodeURIComponent(wp)).join("|")}`
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&key=${apiKey}&avoid=tolls&vehicleType=TRUCK`

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
    const leg = route.legs[0]

    return {
      data: {
        distance: leg.distance.text,
        distance_meters: leg.distance.value,
        duration: leg.duration.text,
        duration_seconds: leg.duration.value,
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text,
          start_location: step.start_location,
          end_location: step.end_location,
        })),
        bounds: route.bounds,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[Google Maps] Directions error:", error)
    return { error: error?.message || "Failed to get route directions", data: null }
  }
}

/**
 * Geocode address to coordinates
 */
export async function geocodeAddress(address: string) {
  try {
    const apiKey = await getGoogleMapsApiKey()

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to geocode address")
    }

    const data = await response.json()

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return { error: `Geocoding failed: ${data.status}`, data: null }
    }

    const result = data.results[0]
    return {
      data: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        address_components: result.address_components,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[Google Maps] Geocoding error:", error)
    return { error: error?.message || "Failed to geocode address", data: null }
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
  } catch (error: any) {
    console.error("[Google Maps] Distance matrix error:", error)
    return { error: error?.message || "Failed to calculate distance matrix", data: null }
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
  } catch (error: any) {
    console.error("[Google Maps] Route optimization error:", error)
    return { error: error?.message || "Failed to optimize route", data: null }
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
  } catch (error: any) {
    console.error("[Google Maps] Place details error:", error)
    return { error: error?.message || "Failed to get place details", data: null }
  }
}







