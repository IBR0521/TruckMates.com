"use server"

/**
 * Backhaul Optimization
 * Find return loads when driver is 2 hours from drop-off
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface BackhaulOpportunity {
  load_id: string
  load_number: string
  pickup_address: string
  pickup_latitude: number
  pickup_longitude: number
  dropoff_address: string
  dropoff_latitude: number
  dropoff_longitude: number
  distance_from_dropoff_miles: number
  distance_to_pickup_miles: number
  direction_match_score: number
  estimated_revenue: number
  driver_can_make_it: boolean
  driver_has_hos: boolean
  pickup_time_window_start: string | null
  pickup_time_window_end: string | null
  load_weight: number | null
  load_status: string
}

/**
 * Find backhaul opportunities for a route
 */
export async function findBackhaulOpportunities(
  routeId: string,
  hoursFromDropoff: number = 2.0,
  maxResults: number = 5
): Promise<{ data: BackhaulOpportunity[] | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: opportunities, error } = await supabase.rpc('find_backhaul_opportunities', {
      p_route_id: routeId,
      p_hours_from_dropoff: hoursFromDropoff,
      p_max_results: maxResults
    })

    if (error) {
      return { error: error.message || "Failed to find backhaul opportunities", data: null }
    }

    return { data: opportunities || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find backhaul opportunities", data: null }
  }
}

/**
 * Check and notify about backhaul opportunities
 * Should be called when driver is approaching drop-off
 */
export async function checkAndNotifyBackhaulOpportunities(routeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Find backhaul opportunities
    const opportunitiesResult = await findBackhaulOpportunities(routeId, 2.0, 3)

    if (opportunitiesResult.error || !opportunitiesResult.data || opportunitiesResult.data.length === 0) {
      return { data: { opportunities_found: 0 }, error: null }
    }

    // Get route details for notification
    const { data: route } = await supabase
      .from("routes")
      .select("id, name, driver_id, truck_id")
      .eq("id", routeId)
      .single()

    if (!route) {
      return { error: "Route not found", data: null }
    }

    // Create alert/notification for dispatcher
    try {
      const { createAlert } = await import("./alerts")
      await createAlert({
        title: `Backhaul Opportunity: ${opportunitiesResult.data.length} return load(s) available`,
        message: `Driver is approaching drop-off. Found ${opportunitiesResult.data.length} potential backhaul load(s) to reduce deadhead miles.`,
        event_type: "backhaul_opportunity",
        priority: "normal",
        route_id: routeId,
        driver_id: route.driver_id || null,
        truck_id: route.truck_id || null,
        metadata: {
          opportunities_count: opportunitiesResult.data.length,
          opportunities: opportunitiesResult.data.map(opp => ({
            load_id: opp.load_id,
            load_number: opp.load_number,
            revenue: opp.estimated_revenue,
            direction_score: opp.direction_match_score
          }))
        }
      })
    } catch (alertError) {
      console.error("Failed to create backhaul alert:", alertError)
      // Don't fail the function if alert creation fails
    }

    return {
      data: {
        opportunities_found: opportunitiesResult.data.length,
        opportunities: opportunitiesResult.data
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to check backhaul opportunities", data: null }
  }
}



