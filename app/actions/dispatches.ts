"use server"

import { addDays } from "date-fns"
import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkEditPermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Get unassigned loads (loads without driver/truck, plus pending/draft backlog)
 */
export async function getUnassignedLoads(terminalId?: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // SECURITY FIX: Use explicit column selection instead of select("*")
    // MEDIUM FIX: Add limit to prevent unbounded queries
    let query = supabase
      .from("loads")
      .select(`
        id,
        company_id,
        shipment_number,
        origin,
        destination,
        status,
        priority,
        driver_id,
        truck_id,
        terminal_id,
        load_date,
        estimated_delivery,
        weight,
        weight_kg,
        value,
        rate,
        total_rate,
        created_at,
        updated_at
      `)
      .eq("company_id", ctx.companyId)
      .or("driver_id.is.null,truck_id.is.null")
      .not("status", "in", '("delivered","cancelled","completed")')
      .order("created_at", { ascending: false })
      .limit(500) // Reasonable limit for dispatch board
    if (terminalId) {
      query = query.eq("terminal_id", terminalId)
    }
    const { data: loads, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Additional filter for pending/draft status loads that might already have assignments
    const scopedLoads = terminalId ? (loads || []).filter((l: any) => l.terminal_id === terminalId) : (loads || [])
    const unassignedLoads = scopedLoads.filter((load: any) => 
      !load.driver_id || !load.truck_id || ["pending", "draft"].includes(String(load.status || "").toLowerCase())
    )

    return { data: unassignedLoads, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

/**
 * Get unassigned routes (routes without driver or truck assigned, or with pending status)
 */
export async function getUnassignedRoutes() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // SECURITY FIX: Use explicit column selection instead of select("*")
    // MEDIUM FIX: Add limit to prevent unbounded queries
    const { data: routes, error } = await supabase
      .from("routes")
      .select(`
        id,
        company_id,
        name,
        origin,
        destination,
        status,
        priority,
        driver_id,
        truck_id,
        distance,
        estimated_time,
        created_at,
        updated_at
      `)
      .eq("company_id", ctx.companyId)
      .or("driver_id.is.null,truck_id.is.null")
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending: false })
      .limit(500) // Reasonable limit for dispatch board

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Additional filter for pending status routes that might have assignments
    const unassignedRoutes = routes?.filter((route: any) => 
      !route.driver_id || !route.truck_id || route.status === "pending"
    ) || []

    return { data: unassignedRoutes, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

/**
 * Quick assign driver and truck to a load
 */
export async function quickAssignLoad(loadId: string, driverId?: string, truckId?: string) {
  // Check permission - use "dispatch" feature category
  const permission = await checkEditPermission("dispatch")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to assign loads", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Get current load to check status and company
  const { data: currentLoad, error: loadError } = await supabase
    .from("loads")
    .select("status, company_id, requires_permit")
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (loadError) {
    return { error: loadError.message || "Failed to fetch load", data: null }
  }

  if (!currentLoad) {
    return { error: "Load not found or access denied", data: null }
  }

  // Guard against assigning to completed/cancelled loads
  if (["delivered", "cancelled", "completed"].includes(currentLoad.status)) {
    return { error: "Cannot assign driver to a completed or cancelled load", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Validate driver ownership if provided
  if (driverId) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    
    if (driverError) {
      return { error: driverError.message || "Failed to validate driver", data: null }
    }
    
    if (!driver) {
      return { error: "Invalid driver or driver does not belong to your company", data: null }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Validate truck ownership if provided
  if (truckId) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id")
      .eq("id", truckId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    
    if (truckError) {
      return { error: truckError.message || "Failed to validate truck", data: null }
    }
    
    if (!truck) {
      return { error: "Invalid truck or truck does not belong to your company", data: null }
    }
  }

  const updateData: any = {}
  if (driverId) updateData.driver_id = driverId
  if (truckId) updateData.truck_id = truckId
  
  // Update status to scheduled if both driver and truck are assigned and status is pending
  if (driverId && truckId && currentLoad?.status === "pending") {
    if (currentLoad.requires_permit) {
      const today = new Date().toISOString().split("T")[0]
      const { data: permits, error: permitError } = await supabase
        .from("permits")
        .select("id, expiry_date, document_id")
        .eq("company_id", ctx.companyId)
        .eq("load_id", loadId)
      if (permitError) {
        return { error: safeDbError(permitError), data: null }
      }
      const validPermit = (permits || []).some((permit: any) => {
        const notExpired = !permit.expiry_date || permit.expiry_date >= today
        return Boolean(permit.document_id) && notExpired
      })
      if (!validPermit) {
        return {
          error: "This load requires an oversize/overweight permit attachment before dispatch.",
          data: null,
        }
      }
    }
    updateData.status = "scheduled"
  }

  const { data, error } = await supabase
    .from("loads")
    .update(updateData)
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)
    .select(`
      id,
      shipment_number,
      origin,
      destination,
      status,
      driver_id,
      truck_id
    `)
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Send SMS notification to driver if assigned (non-blocking)
  if (driverId && data) {
    try {
      const { sendSMSToDriver } = await import("./sms")
      const loadInfo = `${data.origin} → ${data.destination}`
      await sendSMSToDriver(
        driverId,
        `TruckMates: New dispatch assigned! Load: ${data.shipment_number}, Route: ${loadInfo}`
      )
    } catch (error) {
      // Silently fail - don't block assignment
      Sentry.captureException(error)
    }
  }

  revalidatePath("/dashboard/dispatches")
  revalidatePath("/dashboard/loads")
  
  // Trigger webhook
  if (driverId) {
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(ctx.companyId, "driver.assigned", {
        load_id: loadId,
        driver_id: driverId,
        truck_id: truckId,
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  }
  
  return { data, error: null }
}

/**
 * Quick assign driver and truck to a route
 */
export async function quickAssignRoute(routeId: string, driverId?: string, truckId?: string) {
  // Check permission - use "dispatch" feature category
  const permission = await checkEditPermission("dispatch")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to assign routes", data: null }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle()

  if (userError) {
    return { error: userError.message || "Failed to fetch user data", data: null }
  }

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Get current route status and company
  const { data: currentRoute, error: routeError } = await supabase
    .from("routes")
    .select("status, company_id")
    .eq("id", routeId)
    .eq("company_id", userData.company_id)
    .maybeSingle()

  if (routeError) {
    return { error: routeError.message || "Failed to fetch route", data: null }
  }

  if (!currentRoute) {
    return { error: "Route not found or access denied", data: null }
  }

  // Guard against assigning to completed/cancelled routes
  if (["completed", "cancelled"].includes(currentRoute.status)) {
    return { error: "Cannot assign driver to a completed or cancelled route", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Validate driver ownership if provided
  if (driverId) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .eq("company_id", userData.company_id)
      .maybeSingle()
    
    if (driverError) {
      return { error: driverError.message || "Failed to validate driver", data: null }
    }
    
    if (!driver) {
      return { error: "Invalid driver or driver does not belong to your company", data: null }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Validate truck ownership if provided
  if (truckId) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id")
      .eq("id", truckId)
      .eq("company_id", userData.company_id)
      .maybeSingle()
    
    if (truckError) {
      return { error: truckError.message || "Failed to validate truck", data: null }
    }
    
    if (!truck) {
      return { error: "Invalid truck or truck does not belong to your company", data: null }
    }
  }

  const updateData: any = {}
  if (driverId) updateData.driver_id = driverId
  if (truckId) updateData.truck_id = truckId
  
  // Update status to scheduled if both driver and truck are assigned and status is pending
  if (driverId && truckId && currentRoute?.status === "pending") {
    updateData.status = "scheduled"
  }

  const { data, error } = await supabase
    .from("routes")
    .update(updateData)
    .eq("id", routeId)
    .eq("company_id", userData.company_id)
    .select(`
      id,
      name,
      origin,
      destination,
      status,
      driver_id,
      truck_id
    `)
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Send SMS notification to driver if assigned (non-blocking)
  if (driverId && data) {
    try {
      const { sendSMSToDriver } = await import("./sms")
      const routeInfo = `${data.origin} → ${data.destination}`
      await sendSMSToDriver(
        driverId,
        `TruckMates: New route assigned! Route: ${data.name || "Route"}, ${routeInfo}`
      )
    } catch (error) {
      // Silently fail - don't block assignment
      Sentry.captureException(error)
    }
  }

  revalidatePath("/dashboard/dispatches")
  revalidatePath("/dashboard/routes")
  
  // Trigger webhook
  if (driverId) {
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(userData.company_id, "driver.assigned", {
        route_id: routeId,
        driver_id: driverId,
        truck_id: truckId,
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  }
  
  return { data, error: null }
}

export type DispatchPlanningLoadRow = {
  id: string
  company_id: string
  shipment_number: string | null
  origin: string | null
  destination: string | null
  status: string | null
  truck_id: string | null
  driver_id: string | null
  load_date: string | null
  estimated_delivery: string | null
  created_at: string
}

function getPlanningLoadWindow(row: DispatchPlanningLoadRow) {
  const start = row.load_date ? new Date(row.load_date) : new Date(row.created_at)
  let end = row.estimated_delivery ? new Date(row.estimated_delivery) : addDays(start, 1)
  if (end.getTime() <= start.getTime()) {
    end = addDays(start, 1)
  }
  return { start, end }
}

function overlapsWindow(loadStart: Date, loadEnd: Date, windowStart: Date, windowEnd: Date) {
  return loadStart.getTime() <= windowEnd.getTime() && loadEnd.getTime() >= windowStart.getTime()
}

/**
 * Loads overlapping the planning window (pickup → delivery), excluding terminal statuses.
 * Used by the dispatch planning board Gantt view.
 */
export async function getLoadsForPlanningBoard(params: { windowStartIso: string; windowEndIso: string; terminalId?: string }) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const windowStart = new Date(params.windowStartIso)
    const windowEnd = new Date(params.windowEndIso)
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      return { error: "Invalid date range", data: null }
    }

    let query = supabase
      .from("loads")
      .select(`
        id,
        company_id,
        shipment_number,
        origin,
        destination,
        status,
        truck_id,
        driver_id,
        terminal_id,
        load_date,
        estimated_delivery,
        created_at
      `)
      .eq("company_id", ctx.companyId)
      .not("status", "in", '("delivered","cancelled","completed")')
      .order("load_date", { ascending: true, nullsFirst: false })
      .limit(600)
    if (params.terminalId) {
      query = query.eq("terminal_id", params.terminalId)
    }
    const { data: loads, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    const rows = ((loads || []) as DispatchPlanningLoadRow[]).filter((row) => {
      const { start, end } = getPlanningLoadWindow(row)
      return overlapsWindow(start, end, windowStart, windowEnd)
    })

    return { data: rows, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

/**
 * Assign a load to a truck from the planning board; uses the truck's current_driver_id when set.
 */
export async function assignLoadToTruckFromBoard(loadId: string, truckId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data: truck, error: terr } = await supabase
    .from("trucks")
    .select("id, current_driver_id")
    .eq("id", truckId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (terr) {
    return { error: safeDbError(terr), data: null }
  }
  if (!truck) {
    return { error: "Truck not found", data: null }
  }

  const driverId = truck.current_driver_id ? String(truck.current_driver_id) : undefined
  return quickAssignLoad(loadId, driverId, truckId)
}

