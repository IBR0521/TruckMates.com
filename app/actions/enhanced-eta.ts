"use server"

/**
 * Enhanced AI-Powered Predictive ETA
 * Uses Google Maps API for traffic-aware routing and HOS integration
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { getRouteDirections } from "./integrations-google-maps"
import { decodePolyline } from "@/lib/polyline-utils"

export interface EnhancedETA {
  estimated_arrival: string
  hos_adjusted_arrival: string
  distance_remaining_meters: number
  distance_traveled_meters: number
  progress_percentage: number
  estimated_duration_minutes: number
  hos_break_minutes: number
  total_duration_with_breaks: number
  average_speed_mph: number
  confidence: string
  confidence_reason: string
  uses_traffic_data: boolean
}

/**
 * Update traffic-aware route from Google Maps API
 * Should be called periodically (every 5-10 minutes) for active routes
 */
export async function updateTrafficAwareRoute(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Get route details
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("id, origin, destination, waypoints, origin_coordinates, destination_coordinates")
      .eq("id", routeId)
      .single()

    if (routeError || !route) {
      return { error: "Route not found", data: null }
    }

    // Build waypoints array for Google Maps
    const waypoints: string[] = []
    if (route.waypoints && Array.isArray(route.waypoints)) {
      route.waypoints.forEach((wp: any) => {
        if (wp.address) waypoints.push(wp.address)
        else if (wp.lat && wp.lng) waypoints.push(`${wp.lat},${wp.lng}`)
      })
    }

    // Get route directions with traffic data (departure_time=now)
    const origin = route.origin_coordinates 
      ? `${route.origin_coordinates.lat},${route.origin_coordinates.lng}`
      : route.origin

    const destination = route.destination_coordinates
      ? `${route.destination_coordinates.lat},${route.destination_coordinates.lng}`
      : route.destination

    const directionsResult = await getRouteDirections(origin, destination, waypoints.length > 0 ? waypoints : undefined)

    if (directionsResult.error || !directionsResult.data) {
      return { error: directionsResult.error || "Failed to get traffic data", data: null }
    }

    const routeData = directionsResult.data

    // Decode polyline to get waypoints
    const decodedPoints = decodePolyline(routeData.polyline || "")

    // Convert to JSONB array for database
    const waypointsJsonb = decodedPoints.map((point: any) => ({
      lat: point.lat,
      lng: point.lng
    }))

    // Update route with traffic data
    const { data: updateResult, error: updateError } = await supabase.rpc('update_traffic_aware_route', {
      p_route_id: routeId,
      p_traffic_polyline: routeData.polyline || null,
      p_traffic_duration_minutes: Math.round(routeData.duration_seconds / 60),
      p_traffic_distance_meters: routeData.distance_meters || 0,
      p_waypoints: waypointsJsonb.length > 0 ? waypointsJsonb : null
    })

    if (updateError) {
      return { error: updateError.message || "Failed to update traffic route", data: null }
    }

    return { data: { updated: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update traffic-aware route", data: null }
  }
}

/**
 * Calculate enhanced ETA with traffic and HOS
 */
export async function calculateEnhancedETA(
  routeId: string,
  currentLat: number,
  currentLng: number,
  currentSpeed?: number,
  driverId?: string
): Promise<{ data: EnhancedETA | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: eta, error } = await supabase.rpc('calculate_enhanced_eta_with_hos', {
      p_route_id: routeId,
      p_current_lat: currentLat,
      p_current_lng: currentLng,
      p_current_speed: currentSpeed || null,
      p_driver_id: driverId || null
    })

    if (error) {
      return { error: error.message || "Failed to calculate enhanced ETA", data: null }
    }

    if (!eta || eta.length === 0) {
      return { error: "No ETA data returned", data: null }
    }

    return { data: eta[0], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to calculate enhanced ETA", data: null }
  }
}

/**
 * Auto-update traffic routes for active routes (called by cron job)
 */
export async function updateTrafficRoutesForActiveRoutes() {
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
    // Get active routes that need traffic updates (not updated in last 10 minutes)
    const { data: activeRoutes, error: routesError } = await supabase
      .from("routes")
      .select("id")
      .eq("company_id", company_id)
      .in("status", ["in_progress", "scheduled"])
      .or(`traffic_last_updated.is.null,traffic_last_updated.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`)
      .limit(20) // Limit to 20 routes per run to avoid API rate limits

    if (routesError) {
      return { error: routesError.message, data: null }
    }

    let updated = 0
    let errors = 0

    // Update each route
    for (const route of activeRoutes || []) {
      const result = await updateTrafficAwareRoute(route.id)
      if (result.error) {
        errors++
        console.error(`Failed to update traffic for route ${route.id}:`, result.error)
      } else {
        updated++
      }
    }

    return {
      data: {
        updated,
        errors,
        total: activeRoutes?.length || 0
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to update traffic routes", data: null }
  }
}



