"use server"

/**
 * Planned vs. Actual Route Tracking
 * Track actual driven route from GPS locations and compare with planned route
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface RouteComparison {
  planned_distance_meters: number
  actual_distance_meters: number
  distance_difference_meters: number
  distance_difference_percent: number
  planned_duration_minutes: number
  actual_duration_minutes: number
  duration_difference_minutes: number
  duration_difference_percent: number
  route_deviation_meters: number
  efficiency_score: number
  planned_route_linestring: any
  actual_route_linestring: any
}

/**
 * Build actual route from GPS locations
 */
export async function buildActualRoute(
  routeId: string,
  startTime?: string,
  endTime?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: success, error } = await supabase.rpc('build_actual_route', {
      p_route_id: routeId,
      p_start_time: startTime || null,
      p_end_time: endTime || null
    })

    if (error) {
      return { error: error.message || "Failed to build actual route", data: null }
    }

    return { data: { built: success }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to build actual route", data: null }
  }
}

/**
 * Compare planned vs actual route
 */
export async function comparePlannedVsActualRoute(
  routeId: string
): Promise<{ data: RouteComparison | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: comparison, error } = await supabase.rpc('compare_planned_vs_actual_route', {
      p_route_id: routeId
    })

    if (error) {
      return { error: error.message || "Failed to compare routes", data: null }
    }

    if (!comparison || comparison.length === 0) {
      return { error: "No comparison data available", data: null }
    }

    return { data: comparison[0], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to compare routes", data: null }
  }
}

/**
 * Auto-build actual routes for completed routes
 * Should be called periodically or when route is completed
 */
export async function buildActualRoutesForCompleted() {
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
    // Get completed routes without actual route data
    const { data: completedRoutes, error: routesError } = await supabase
      .from("routes")
      .select("id, route_start_time, route_complete_time")
      .eq("company_id", company_id)
      .eq("status", "completed")
      .is("actual_route_linestring", null)
      .limit(50) // Process 50 at a time

    if (routesError) {
      return { error: routesError.message, data: null }
    }

    let built = 0
    let errors = 0

    for (const route of completedRoutes || []) {
      const result = await buildActualRoute(
        route.id,
        route.route_start_time || undefined,
        route.route_complete_time || undefined
      )

      if (result.error) {
        errors++
        console.error(`Failed to build actual route for ${route.id}:`, result.error)
      } else {
        built++
      }
    }

    return {
      data: {
        built,
        errors,
        total: completedRoutes?.length || 0
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to build actual routes", data: null }
  }
}



