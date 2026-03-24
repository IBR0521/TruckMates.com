"use server"

/**
 * Real-time ETA Updates
 * Compares driver's current POINT with planned route LINESTRING
 * Provides hyper-accurate arrival times that update every 60 seconds
 */

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/** `public.eta_updates` — supabase/realtime_eta.sql */
const ETA_UPDATES_SELECT =
  "id, company_id, route_id, load_id, truck_id, driver_id, current_latitude, current_longitude, current_location, current_speed, distance_traveled_meters, distance_remaining_meters, progress_percentage, estimated_arrival, estimated_duration_minutes, average_speed_mph, confidence, confidence_reason, timestamp, created_at"

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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get route with driver info
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("truck_id, driver_id, traffic_last_updated, company_id")
      .eq("id", routeId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (routeError) {
      return { error: routeError.message, data: null }
    }

    if (!route) {
      return { error: "Route not found or access denied", data: null }
    }

    if (!route.truck_id) {
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
        Sentry.captureException(error)
      }
    }

    // Get current truck location
    const { data: latestLocation, error: latestLocationError } = await supabase
      .from("eld_locations")
      .select("latitude, longitude, speed, timestamp")
      .eq("truck_id", route.truck_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestLocationError) {
      return { error: latestLocationError.message, data: null }
    }

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
          .eq("company_id", ctx.companyId)

        return { data: { enhanced: true, eta: enhancedResult.data }, error: null }
      }
    } catch (error) {
      Sentry.captureException(error)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get route with current ETA
    const { data: route, error } = await supabase
      .from("routes")
      .select("id, current_eta, last_eta_update, eta_confidence, truck_id")
      .eq("id", routeId)
      .eq("company_id", ctx.companyId)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    // Get latest ETA update
    const { data: latestUpdate, error: latestUpdateError } = await supabase
      .from("eta_updates")
      .select(ETA_UPDATES_SELECT)
      .eq("route_id", routeId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestUpdateError) {
      return { error: latestUpdateError.message, data: null }
    }

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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: updates, error } = await supabase
      .from("eta_updates")
      .select(ETA_UPDATES_SELECT)
      .eq("route_id", routeId)
      .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get load's route
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("route_id")
      .eq("id", loadId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError) {
      return { error: loadError.message, data: null }
    }

    if (!load || !load.route_id) {
      return { error: "Load has no associated route", data: null }
    }

    // Get route ETA
    return await getRouteETA(load.route_id)
  } catch (error: any) {
    return { error: error.message || "Failed to get load ETA", data: null }
  }
}

