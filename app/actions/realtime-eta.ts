"use server"

/**
 * Real-time ETA Updates
 * Compares driver's current POINT with planned route LINESTRING
 * Provides hyper-accurate arrival times that update every 60 seconds
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface RealtimeETA {
  estimated_arrival: string
  distance_remaining_meters: number
  distance_traveled_meters: number
  progress_percentage: number
  estimated_duration_minutes: number
  average_speed_mph: number
  confidence: 'high' | 'medium' | 'low'
  confidence_reason: string
}

export interface ETAUpdate {
  id: string
  route_id: string
  load_id: string | null
  truck_id: string
  driver_id: string | null
  current_latitude: number
  current_longitude: number
  current_speed: number | null
  distance_traveled_meters: number
  distance_remaining_meters: number
  progress_percentage: number
  estimated_arrival: string
  estimated_duration_minutes: number
  average_speed_mph: number
  confidence: string
  confidence_reason: string | null
  timestamp: string
}

/**
 * Create route LINESTRING from waypoints
 */
export async function createRouteLinestring(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: success, error } = await supabase.rpc('create_route_linestring', {
      p_route_id: routeId
    })

    if (error) {
      return { error: error.message || "Failed to create route LINESTRING", data: null }
    }

    return { data: { success }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to create route LINESTRING", data: null }
  }
}

/**
 * Calculate real-time ETA for a route
 */
export async function calculateRealtimeETA(
  routeId: string,
  currentLat: number,
  currentLng: number,
  currentSpeed?: number
): Promise<{ data: RealtimeETA | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: eta, error } = await supabase.rpc('calculate_realtime_eta', {
      p_route_id: routeId,
      p_current_lat: currentLat,
      p_current_lng: currentLng,
      p_current_speed: currentSpeed || null
    })

    if (error) {
      return { error: error.message || "Failed to calculate ETA", data: null }
    }

    if (!eta || eta.length === 0) {
      return { error: "No ETA data returned", data: null }
    }

    return { data: eta[0], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to calculate ETA", data: null }
  }
}

/**
 * Update route ETA (called every 60 seconds)
 * Enhanced version that uses traffic data and HOS
 */
export async function updateRouteETA(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Get route with driver info
    const { data: route } = await supabase
      .from("routes")
      .select("truck_id, driver_id, traffic_last_updated")
      .eq("id", routeId)
      .single()

    if (!route?.truck_id) {
      return { error: "Route has no truck assigned", data: null }
    }

    // Update traffic-aware route if needed (every 10 minutes)
    const needsTrafficUpdate = !route.traffic_last_updated || 
      new Date(route.traffic_last_updated) < new Date(Date.now() - 10 * 60 * 1000)

    if (needsTrafficUpdate) {
      try {
        const { updateTrafficAwareRoute } = await import("./enhanced-eta")
        await updateTrafficAwareRoute(routeId)
      } catch (error) {
        console.error("Failed to update traffic route (non-blocking):", error)
      }
    }

    // Get current truck location
    const { data: latestLocation } = await supabase
      .from("eld_locations")
      .select("latitude, longitude, speed, timestamp")
      .eq("truck_id", route.truck_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()

    if (!latestLocation) {
      return { error: "No location data available", data: null }
    }

    // Use enhanced ETA calculation with HOS
    try {
      const { calculateEnhancedETA } = await import("./enhanced-eta")
      const enhancedResult = await calculateEnhancedETA(
        routeId,
        latestLocation.latitude,
        latestLocation.longitude,
        latestLocation.speed,
        route.driver_id || undefined
      )

      if (!enhancedResult.error && enhancedResult.data) {
        // Update route with enhanced ETA
        await supabase
          .from("routes")
          .update({
            current_eta: enhancedResult.data.hos_adjusted_arrival,
            hos_adjusted_eta: enhancedResult.data.hos_adjusted_arrival,
            last_eta_update: new Date().toISOString(),
            eta_confidence: enhancedResult.data.confidence
          })
          .eq("id", routeId)

        return { data: { enhanced: true, eta: enhancedResult.data }, error: null }
      }
    } catch (error) {
      console.error("Enhanced ETA failed, falling back to standard:", error)
    }

    // Fallback to original calculation
    const { data: updateId, error } = await supabase.rpc('update_route_eta', {
      p_route_id: routeId
    })

    if (error) {
      return { error: error.message || "Failed to update route ETA", data: null }
    }

    return { data: { update_id: updateId }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update route ETA", data: null }
  }
}

/**
 * Get current ETA for a route
 */
export async function getRouteETA(routeId: string) {
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
    // Get route with current ETA
    const { data: route, error } = await supabase
      .from("routes")
      .select("id, current_eta, last_eta_update, eta_confidence, truck_id")
      .eq("id", routeId)
      .eq("company_id", company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    // Get latest ETA update
    const { data: latestUpdate } = await supabase
      .from("eta_updates")
      .select("*")
      .eq("route_id", routeId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()

    return {
      data: {
        route_id: route.id,
        current_eta: route.current_eta,
        last_update: route.last_eta_update,
        confidence: route.eta_confidence,
        latest_update: latestUpdate || null
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get route ETA", data: null }
  }
}

/**
 * Get ETA history for a route
 */
export async function getETAHistory(
  routeId: string,
  limit: number = 100
): Promise<{ data: ETAUpdate[] | null; error: string | null }> {
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
    const { data: updates, error } = await supabase
      .from("eta_updates")
      .select("*")
      .eq("route_id", routeId)
      .eq("company_id", company_id)
      .order("timestamp", { ascending: false })
      .limit(limit)

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: updates || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get ETA history", data: null }
  }
}

/**
 * Get ETA for a load (via its route)
 */
export async function getLoadETA(loadId: string) {
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
    // Get load's route
    const { data: load } = await supabase
      .from("loads")
      .select("route_id")
      .eq("id", loadId)
      .eq("company_id", company_id)
      .single()

    if (!load || !load.route_id) {
      return { error: "Load has no associated route", data: null }
    }

    // Get route ETA
    return await getRouteETA(load.route_id)
  } catch (error: any) {
    return { error: error.message || "Failed to get load ETA", data: null }
  }
}

