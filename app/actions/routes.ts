"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { validateRequiredString, sanitizeString } from "@/lib/validation"
import { sendNotification } from "./notifications"

// Helper function to send notifications in background (non-blocking)
async function sendNotificationsForRouteUpdate(routeData: any) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) return

  // Get all users in the company
  const { data: companyUsers } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", userData.company_id)

  // Send notifications to all users who want route updates
  if (companyUsers) {
    for (const companyUser of companyUsers) {
      try {
        await sendNotification(companyUser.id, "route_update", {
          routeName: routeData.name,
          status: routeData.status,
          origin: routeData.origin,
          destination: routeData.destination,
        })
      } catch (error) {
        // Silently fail - don't block the main operation
        console.error(`[NOTIFICATION] Failed to send to user ${companyUser.id}:`, error)
      }
    }
  }
}

export async function getRoutes(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Use optimized helper with caching
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // Build query with selective columns and pagination
  let query = supabase
    .from("routes")
    .select("id, name, origin, destination, status, driver_id, truck_id, priority, created_at, updated_at", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  // Apply pagination (default limit 25 for faster initial loads, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data: routes, error, count } = await query

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: routes || [], error: null, count: count || 0 }
}

export async function getRoute(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { data: route, error } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: route, error: null }
}

export async function createRoute(formData: {
  name: string
  origin: string
  destination: string
  distance?: string
  estimated_time?: string
  priority?: string
  driver_id?: string
  truck_id?: string
  status?: string
  depot_name?: string
  depot_address?: string
  pre_route_time_minutes?: number
  post_route_time_minutes?: number
  route_start_time?: string
  route_departure_time?: string
  route_complete_time?: string
  route_type?: string
  scenario?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Professional validation
  if (!validateRequiredString(formData.name, 1, 200)) {
    return { error: "Route name is required and must be between 1 and 200 characters", data: null }
  }

  if (!validateRequiredString(formData.origin, 3, 200)) {
    return { error: "Origin is required and must be between 3 and 200 characters", data: null }
  }

  if (!validateRequiredString(formData.destination, 3, 200)) {
    return { error: "Destination is required and must be between 3 and 200 characters", data: null }
  }

  // Validate driver assignment if provided
  if (formData.driver_id) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, status, company_id")
      .eq("id", formData.driver_id)
      .eq("company_id", userData.company_id)
      .single()

    if (driverError || !driver) {
      return { error: "Invalid driver selected", data: null }
    }

    if (driver.status !== "active") {
      return { error: "Cannot assign inactive driver to route", data: null }
    }
  }

  // Validate truck assignment if provided
  if (formData.truck_id) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, status, company_id")
      .eq("id", formData.truck_id)
      .eq("company_id", userData.company_id)
      .single()

    if (truckError || !truck) {
      return { error: "Invalid truck selected", data: null }
    }

    if (truck.status !== "available" && truck.status !== "in-use") {
      return { error: "Cannot assign truck with status: " + truck.status, data: null }
    }
  }

  // Ensure required fields are present and handle undefined values
  const routeData: any = {
    company_id: userData.company_id,
    name: sanitizeString(formData.name, 200),
    origin: sanitizeString(formData.origin, 200),
    destination: sanitizeString(formData.destination, 200),
    priority: formData.priority || "normal",
    status: formData.status || "pending",
  }

  // Only add optional fields if they have values (with sanitization)
  if (formData.distance) routeData.distance = sanitizeString(formData.distance, 50)
  if (formData.estimated_time) routeData.estimated_time = sanitizeString(formData.estimated_time, 50)
  if (formData.driver_id) routeData.driver_id = formData.driver_id
  if (formData.truck_id) routeData.truck_id = formData.truck_id
  if (formData.depot_name) routeData.depot_name = sanitizeString(formData.depot_name, 200)
  if (formData.depot_address) routeData.depot_address = sanitizeString(formData.depot_address, 200)
  if (formData.pre_route_time_minutes !== undefined) routeData.pre_route_time_minutes = formData.pre_route_time_minutes
  if (formData.post_route_time_minutes !== undefined) routeData.post_route_time_minutes = formData.post_route_time_minutes
  if (formData.route_start_time) routeData.route_start_time = formData.route_start_time
  if (formData.route_departure_time) routeData.route_departure_time = formData.route_departure_time
  if (formData.route_complete_time) routeData.route_complete_time = formData.route_complete_time
  if (formData.route_type) routeData.route_type = formData.route_type
  if (formData.scenario) routeData.scenario = formData.scenario

  const { data, error } = await supabase
    .from("routes")
    .insert(routeData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data, error: null }
}

export async function updateRoute(
  id: string,
  formData: {
    name?: string
    origin?: string
    destination?: string
    distance?: string
    estimated_time?: string
    priority?: string
    driver_id?: string
    truck_id?: string
    status?: string
    estimated_arrival?: string | null
    waypoints?: any
    depot_name?: string
    depot_address?: string
    pre_route_time_minutes?: number
    post_route_time_minutes?: number
    route_start_time?: string
    route_departure_time?: string
    route_complete_time?: string
    route_type?: string
    scenario?: string
    [key: string]: any
  }
) {
  const supabase = await createClient()

  // Build update data, only including fields that are provided
  const updateData: any = {}
  
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.origin !== undefined) updateData.origin = formData.origin
  if (formData.destination !== undefined) updateData.destination = formData.destination
  if (formData.distance !== undefined) updateData.distance = formData.distance
  if (formData.estimated_time !== undefined) updateData.estimated_time = formData.estimated_time
  if (formData.priority !== undefined) updateData.priority = formData.priority || "normal"
  if (formData.status !== undefined) updateData.status = formData.status || "pending"
  if (formData.driver_id !== undefined) updateData.driver_id = formData.driver_id || null
  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
  if (formData.estimated_arrival !== undefined) updateData.estimated_arrival = formData.estimated_arrival || null
  if (formData.waypoints !== undefined) updateData.waypoints = formData.waypoints || null
  if (formData.depot_name !== undefined) updateData.depot_name = formData.depot_name || null
  if (formData.depot_address !== undefined) updateData.depot_address = formData.depot_address || null
  if (formData.pre_route_time_minutes !== undefined) updateData.pre_route_time_minutes = formData.pre_route_time_minutes || null
  if (formData.post_route_time_minutes !== undefined) updateData.post_route_time_minutes = formData.post_route_time_minutes || null
  if (formData.route_start_time !== undefined) updateData.route_start_time = formData.route_start_time || null
  if (formData.route_departure_time !== undefined) updateData.route_departure_time = formData.route_departure_time || null
  if (formData.route_complete_time !== undefined) updateData.route_complete_time = formData.route_complete_time || null
  if (formData.route_type !== undefined) updateData.route_type = formData.route_type || null
  if (formData.scenario !== undefined) updateData.scenario = formData.scenario || null

  const { data, error } = await supabase
    .from("routes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Send notifications to company users if route was updated (non-blocking)
  if (data) {
    // Don't await - send notifications in background
    sendNotificationsForRouteUpdate(data).catch((error) => {
      console.error("[NOTIFICATION] Failed to send route update notifications:", error)
    })
  }

  revalidatePath("/dashboard/routes")
  revalidatePath(`/dashboard/routes/${id}`)

  return { data, error: null }
}

export async function deleteRoute(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("routes").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/routes")
  return { error: null }
}

// Bulk operations for workflow optimization
export async function bulkDeleteRoutes(ids: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { error } = await supabase
    .from("routes")
    .delete()
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateRouteStatus(ids: string[], status: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { error } = await supabase
    .from("routes")
    .update({ status })
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data: { updated: ids.length }, error: null }
}

// Duplicate/clone route for workflow optimization
export async function duplicateRoute(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get the original route
  const { data: originalRoute, error: fetchError } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (fetchError || !originalRoute) {
    return { error: "Route not found", data: null }
  }

  // Create duplicate with new name and reset status
  const duplicateData: any = { ...originalRoute }
  delete duplicateData.id
  delete duplicateData.created_at
  delete duplicateData.updated_at
  duplicateData.name = `${originalRoute.name} (Copy)`
  duplicateData.status = "pending" // Reset to pending
  duplicateData.estimated_arrival = null

  const { data: newRoute, error: createError } = await supabase
    .from("routes")
    .insert(duplicateData)
    .select()
    .single()

  if (createError) {
    return { error: createError.message, data: null }
  }

  // Duplicate stops if any
  const { getRouteStops } = await import("./route-stops")
  const { createRouteStop } = await import("./route-stops")
  const stopsResult = await getRouteStops(id)
  
  if (stopsResult.data && stopsResult.data.length > 0) {
    for (const stop of stopsResult.data) {
      const stopData: any = { ...stop }
      delete stopData.id
      delete stopData.route_id
      delete stopData.created_at
      delete stopData.updated_at
      await createRouteStop(newRoute.id, stopData)
    }
  }

  revalidatePath("/dashboard/routes")
  return { data: newRoute, error: null }
}

// Smart suggestions for workflow optimization
export async function getRouteSuggestions(origin?: string, destination?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const suggestions: any = {
    suggestedDriver: null,
    suggestedTruck: null,
    similarRoutes: [],
  }

  // Suggest driver/truck based on route history
  if (origin && destination) {
    const { data: recentRoutes } = await supabase
      .from("routes")
      .select("driver_id, truck_id")
      .eq("company_id", userData.company_id)
      .or(`origin.ilike.%${origin}%,destination.ilike.%${destination}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (recentRoutes && recentRoutes.length > 0) {
      const driverCounts: Record<string, number> = {}
      const truckCounts: Record<string, number> = {}
      recentRoutes.forEach((route) => {
        if (route.driver_id) {
          driverCounts[route.driver_id] = (driverCounts[route.driver_id] || 0) + 1
        }
        if (route.truck_id) {
          truckCounts[route.truck_id] = (truckCounts[route.truck_id] || 0) + 1
        }
      })

      const topDriverId = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      const topTruckId = Object.entries(truckCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

      if (topDriverId) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, name, status")
          .eq("id", topDriverId)
          .eq("status", "active")
          .single()
        if (driver) suggestions.suggestedDriver = driver
      }

      if (topTruckId) {
        const { data: truck } = await supabase
          .from("trucks")
          .select("id, truck_number, status")
          .eq("id", topTruckId)
          .in("status", ["available", "in_use"])
          .single()
        if (truck) suggestions.suggestedTruck = truck
      }
    }
  }

  // Get similar routes for reference
  const { data: similarRoutes } = await supabase
    .from("routes")
    .select("id, name, origin, destination, distance, estimated_time")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })
    .limit(5)

  if (similarRoutes) {
    suggestions.similarRoutes = similarRoutes
  }

  return { data: suggestions, error: null }
}

