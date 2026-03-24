"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { validateRequiredString, sanitizeString } from "@/lib/validation"
import { sendNotification } from "./notifications"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

const ROUTE_DETAIL_SELECT =
  "id, company_id, name, origin, destination, distance, estimated_time, priority, status, driver_id, truck_id, waypoints, estimated_arrival, depot_name, depot_address, pre_route_time_minutes, post_route_time_minutes, route_start_time, route_departure_time, route_complete_time, route_type, scenario, notes, special_instructions, estimated_fuel_cost, estimated_toll_cost, total_estimated_cost, created_at, updated_at"

// Helper function to send notifications in background (non-blocking)
async function sendNotificationsForRouteUpdate(routeData: any) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return

    // BUG-044 FIX: Filter notifications by relevance - only notify assigned driver, dispatcher, and managers
    // Get assigned driver if route has one
    let assignedDriverId: string | null = null
    if (routeData.driver_id) {
      assignedDriverId = routeData.driver_id
    }

    // Get relevant users: assigned driver, dispatchers, and managers only (6-role names)
    const { data: relevantUsers } = await supabase
      .from("users")
      .select("id, role")
      .eq("company_id", ctx.companyId)
      .or([
        assignedDriverId ? `id.eq.${assignedDriverId}` : "",
        "role.in.(super_admin,operations_manager,dispatcher,safety_compliance)",
      ].filter(Boolean).join(","))

    // BUG-044 FIX: Only send notifications to relevant users, not all company users
    if (relevantUsers && relevantUsers.length > 0) {
      await Promise.all(
        relevantUsers.map(async (relevantUser: { id: string; role: string }) => {
          try {
            await sendNotification(relevantUser.id, "route_update", {
              routeName: routeData.name,
              status: routeData.status,
              origin: routeData.origin,
              destination: routeData.destination,
            })
          } catch (error) {
            Sentry.captureException(error)
          }
        })
      )
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

export async function getRoutes(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("routes")
      .select("id, name, origin, destination, status, driver_id, truck_id, priority, created_at, updated_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return { error: message, data: null, count: 0 }
  }
}

export async function getRoute(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: route, error } = await supabase
      .from("routes")
      .select(ROUTE_DETAIL_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }

    if (!route) {
      return { error: "Route not found", data: null }
    }

    return { data: route, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return { error: message, data: null }
  }
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
  /** ISO datetime string */
  estimated_arrival?: string
  notes?: string
  special_instructions?: string
  estimated_fuel_cost?: number
  estimated_toll_cost?: number
  total_estimated_cost?: number
}) {
  // Check permission
  const permission = await checkCreatePermission("routes")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create routes", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .eq("company_id", ctx.companyId)
      .maybeSingle()

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
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (truckError || !truck) {
      return { error: "Invalid truck selected", data: null }
    }

    if (truck.status !== "available" && truck.status !== "in-use") {
      return { error: "Cannot assign truck with status: " + truck.status, data: null }
    }
  }

  // Ensure required fields are present and handle undefined values
  const routeData: any = {
    company_id: ctx.companyId,
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
  if (formData.estimated_arrival) routeData.estimated_arrival = formData.estimated_arrival
  if (formData.notes) routeData.notes = sanitizeString(formData.notes, 5000)
  if (formData.special_instructions) routeData.special_instructions = sanitizeString(formData.special_instructions, 5000)
  if (formData.estimated_fuel_cost != null && Number.isFinite(formData.estimated_fuel_cost)) {
    routeData.estimated_fuel_cost = formData.estimated_fuel_cost
  }
  if (formData.estimated_toll_cost != null && Number.isFinite(formData.estimated_toll_cost)) {
    routeData.estimated_toll_cost = formData.estimated_toll_cost
  }
  if (formData.total_estimated_cost != null && Number.isFinite(formData.total_estimated_cost)) {
    routeData.total_estimated_cost = formData.total_estimated_cost
  }

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
    notes?: string
    special_instructions?: string
    estimated_fuel_cost?: number
    estimated_toll_cost?: number
    total_estimated_cost?: number
    [key: string]: any
  }
) {
  // Check permission
  const permission = await checkEditPermission("routes")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit routes", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get current route data for audit trail (with company_id verification)
  const { data: currentRoute, error: currentRouteError } = await supabase
    .from("routes")
    .select(ROUTE_DETAIL_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (currentRouteError || !currentRoute) {
    return { error: "Route not found", data: null }
  }

  // Build update data and track changes
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  const fieldsToCheck = [
    "name", "origin", "destination", "distance", "estimated_time", "priority",
    "status", "driver_id", "truck_id", "estimated_arrival", "depot_name",
    "depot_address", "pre_route_time_minutes", "post_route_time_minutes",
    "route_start_time", "route_departure_time", "route_complete_time",
    "route_type", "scenario", "notes", "special_instructions",
    "estimated_fuel_cost", "estimated_toll_cost", "total_estimated_cost"
  ]

  for (const field of fieldsToCheck) {
    if (formData[field as keyof typeof formData] !== undefined) {
      const newValue = formData[field as keyof typeof formData]
      const oldValue = currentRoute[field]
      if (newValue !== oldValue) {
        updateData[field] = newValue === null || newValue === "" ? null : newValue
        changes.push({ field, old_value: oldValue, new_value: newValue })
      }
    }
  }

  if (formData.waypoints !== undefined && JSON.stringify(formData.waypoints) !== JSON.stringify(currentRoute.waypoints)) {
    updateData.waypoints = formData.waypoints || null
    changes.push({ field: "waypoints", old_value: currentRoute.waypoints, new_value: formData.waypoints })
  }

  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentRoute is JSON-serializable
    const serializableCurrentRoute = currentRoute ? JSON.parse(JSON.stringify(currentRoute, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentRoute, error: null }
  }

  const { data, error } = await supabase
    .from("routes")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Send notifications to company users if route was updated (non-blocking)
  if (data) {
    // Don't await - send notifications in background
    sendNotificationsForRouteUpdate(data).catch((error) => {
      Sentry.captureException(error)
    })
  }

  // Create audit log entries
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (ctx.userId) {
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "route",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            Sentry.captureMessage(`[updateRoute] Audit log created for field: ${change.field}`, "info")
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            Sentry.captureMessage(`[updateRoute] Audit log failed for field ${change.field}: ${msg}`, "error")
          }
        }
      } else {
        Sentry.captureMessage("[updateRoute] No user found for audit logging", "warning")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      Sentry.captureMessage(`[updateRoute] Failed to import audit log module: ${msg}`, "error")
    }
  }

  revalidatePath("/dashboard/routes")
  revalidatePath(`/dashboard/routes/${id}`)

  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint') return value.toString()
    return value
  })) : null

  return { data: serializableData, error: null }
}

export async function deleteRoute(id: string) {
  // Check permission
  const permission = await checkDeletePermission("routes")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete routes" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const { error } = await supabase
    .from("routes")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/routes")
  return { error: null }
}

// Bulk operations for workflow optimization
export async function bulkDeleteRoutes(ids: string[]) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // DAT-004 FIX: Check for active loads assigned to these routes before bulk delete
  const { data: activeLoads } = await supabase
    .from("loads")
    .select("id, route_id, shipment_number, status")
    .in("route_id", ids)
    .in("status", ["scheduled", "in_transit"])
    .eq("company_id", ctx.companyId)

  if (activeLoads && activeLoads.length > 0) {
    const blockedRouteIds = [...new Set(activeLoads.map((load: { route_id: string | null; [key: string]: any }) => load.route_id))]
    const blockedRoutes = await supabase
      .from("routes")
      .select("id, name")
      .in("id", blockedRouteIds)
      .eq("company_id", ctx.companyId)

    if (blockedRoutes.data && blockedRoutes.data.length > 0) {
      const routeNames = blockedRoutes.data.map((r: { name: string; [key: string]: any }) => r.name).join(", ")
      return { 
        error: `Cannot delete routes with active loads: ${routeNames}. Please complete or cancel their loads first.`,
        data: null 
      }
    }
  }

  const { error } = await supabase
    .from("routes")
    .delete()
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateRouteStatus(ids: string[], status: string) {
  // Check permission
  const permission = await checkEditPermission("routes")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit routes", data: null }
  }

  // Validate status value
  const validStatuses = ["pending", "scheduled", "in_progress", "completed", "cancelled"]
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { error } = await supabase
    .from("routes")
    .update({ status })
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data: { updated: ids.length }, error: null }
}

// Duplicate/clone route for workflow optimization
export async function duplicateRoute(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get the original route
  const { data: originalRoute, error: fetchError } = await supabase
    .from("routes")
    .select(ROUTE_DETAIL_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

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
  duplicateData.driver_id = null // Clear driver assignment
  duplicateData.truck_id = null // Clear truck assignment

  const { data: newRoute, error: createError } = await supabase
    .from("routes")
    .insert(duplicateData)
    .select()
    .single()

  if (createError || !newRoute) {
    return { error: createError?.message || "Failed to create duplicated route", data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .eq("company_id", ctx.companyId)
      .or(`origin.ilike.%${origin}%,destination.ilike.%${destination}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (recentRoutes && recentRoutes.length > 0) {
      const driverCounts: Record<string, number> = {}
      const truckCounts: Record<string, number> = {}
      recentRoutes.forEach((route: { driver_id: string | null; truck_id: string | null; [key: string]: any }) => {
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
        const { data: driver, error: driverError } = await supabase
          .from("drivers")
          .select("id, name, status")
          .eq("id", topDriverId)
          .eq("status", "active")
          .maybeSingle()
        if (driverError) {
          return { error: driverError.message, data: null }
        }
        if (driver) suggestions.suggestedDriver = driver
      }

      if (topTruckId) {
        const { data: truck, error: truckError } = await supabase
          .from("trucks")
          .select("id, truck_number, status")
          .eq("id", topTruckId)
          .in("status", ["available", "in_use"])
          .maybeSingle()
        if (truckError) {
          return { error: truckError.message, data: null }
        }
        if (truck) suggestions.suggestedTruck = truck
      }
    }
  }

  // Get similar routes for reference
  const { data: similarRoutes } = await supabase
    .from("routes")
    .select("id, name, origin, destination, distance, estimated_time")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(5)

  if (similarRoutes) {
    suggestions.similarRoutes = similarRoutes
  }

  return { data: suggestions, error: null }
}

