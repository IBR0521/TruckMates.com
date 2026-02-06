"use server"

/**
 * Digital Freight Matching (DFM)
 * Automatically matches loads to available trucks
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface MatchingTruck {
  truck_id: string
  driver_id: string
  driver_name: string
  truck_number: string
  match_score: number
  distance_miles: number
  equipment_match: boolean
  hos_available: boolean
  rate_profitability: number
  current_location: string
  estimated_pickup_time: string
  remaining_drive_hours: number
  remaining_on_duty_hours: number
  current_status: string
}

export interface MatchingLoad {
  load_id: string
  shipment_number: string
  origin: string
  destination: string
  rate: number
  match_score: number
  distance_miles: number
  equipment_match: boolean
  hos_available: boolean
  pickup_time_window_start: string | null
  pickup_time_window_end: string | null
  load_date: string | null
}

/**
 * Find matching trucks for a load
 */
export async function findMatchingTrucksForLoad(
  loadId: string,
  maxResults: number = 5,
  maxDistanceMiles: number = 100.0
): Promise<{ data: MatchingTruck[] | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: matches, error } = await supabase.rpc('find_matching_trucks_for_load', {
      p_load_id: loadId,
      p_max_results: maxResults,
      p_max_distance_miles: maxDistanceMiles
    })

    if (error) {
      return { error: error.message || "Failed to find matching trucks", data: null }
    }

    return { data: matches || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find matching trucks", data: null }
  }
}

/**
 * Find matching loads for a truck
 */
export async function findMatchingLoadsForTruck(
  truckId: string,
  maxResults: number = 10,
  maxDistanceMiles: number = 100.0
): Promise<{ data: MatchingLoad[] | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: matches, error } = await supabase.rpc('find_matching_loads_for_truck', {
      p_truck_id: truckId,
      p_max_results: maxResults,
      p_max_distance_miles: maxDistanceMiles
    })

    if (error) {
      return { error: error.message || "Failed to find matching loads", data: null }
    }

    return { data: matches || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to find matching loads", data: null }
  }
}

/**
 * Auto-match loads to trucks (called when new load is created)
 */
export async function autoMatchLoadToTrucks(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Find top 3 matching trucks
    const matchesResult = await findMatchingTrucksForLoad(loadId, 3, 100.0)

    if (matchesResult.error || !matchesResult.data || matchesResult.data.length === 0) {
      return { 
        data: { 
          matched: false, 
          matches_found: 0,
          message: "No matching trucks found"
        }, 
        error: null 
      }
    }

    // Get load details
    const { data: load } = await supabase
      .from("loads")
      .select("id, shipment_number, origin, destination")
      .eq("id", loadId)
      .single()

    if (!load) {
      return { error: "Load not found", data: null }
    }

    // Create notifications for dispatchers about matches
    try {
      const { sendNotification } = await import("./notifications")
      const result = await getCachedUserCompany(user.id)
      const company_id = result.company_id

      if (company_id) {
        const { data: dispatchers } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", company_id)
          .eq("role", "manager")

        if (dispatchers) {
          for (const dispatcher of dispatchers) {
            await sendNotification(dispatcher.id, "dfm_matches_found", {
              load_id: loadId,
              shipment_number: load.shipment_number,
              matches_count: matchesResult.data.length,
              top_match_score: matchesResult.data[0]?.match_score || 0,
              top_match_truck: matchesResult.data[0]?.truck_number || "Unknown"
            }).catch(err => console.error("Notification failed:", err))
          }
        }
      }
    } catch (notificationError) {
      console.error("Failed to send DFM notifications:", notificationError)
      // Don't fail the function if notifications fail
    }

    return {
      data: {
        matched: true,
        matches_found: matchesResult.data.length,
        matches: matchesResult.data,
        message: `Found ${matchesResult.data.length} matching truck(s)`
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to auto-match load", data: null }
  }
}


