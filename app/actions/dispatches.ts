"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { checkEditPermission } from "@/lib/server-permissions"

/**
 * Get unassigned loads (loads without driver or truck assigned, or with pending status)
 */
export async function getUnassignedLoads() {
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
    .single()

  if (userError) {
    return { error: userError.message || "Failed to fetch user data", data: null }
  }

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // SECURITY FIX: Use explicit column selection instead of select("*")
  // MEDIUM FIX: Add limit to prevent unbounded queries
  const { data: loads, error } = await supabase
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
    .eq("company_id", userData.company_id)
    .or("driver_id.is.null,truck_id.is.null")
    .not("status", "in", '("delivered","cancelled","completed")')
    .order("created_at", { ascending: false })
    .limit(500) // Reasonable limit for dispatch board

  if (error) {
    return { error: error.message, data: null }
  }

  // Additional filter for pending status loads that might have assignments
  const unassignedLoads = loads?.filter((load: any) => 
    !load.driver_id || !load.truck_id || load.status === "pending"
  ) || []

  return { data: unassignedLoads, error: null }
}

/**
 * Get unassigned routes (routes without driver or truck assigned, or with pending status)
 */
export async function getUnassignedRoutes() {
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
    .single()

  if (userError) {
    return { error: userError.message || "Failed to fetch user data", data: null }
  }

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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
    .eq("company_id", userData.company_id)
    .or("driver_id.is.null,truck_id.is.null")
    .not("status", "in", '("completed","cancelled")')
    .order("created_at", { ascending: false })
    .limit(500) // Reasonable limit for dispatch board

  if (error) {
    return { error: error.message, data: null }
  }

  // Additional filter for pending status routes that might have assignments
  const unassignedRoutes = routes?.filter((route: any) => 
    !route.driver_id || !route.truck_id || route.status === "pending"
  ) || []

  return { data: unassignedRoutes, error: null }
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
    .single()

  if (userError) {
    return { error: userError.message || "Failed to fetch user data", data: null }
  }

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // Get current load to check status and company
  const { data: currentLoad, error: loadError } = await supabase
    .from("loads")
    .select("status, company_id")
    .eq("id", loadId)
    .eq("company_id", userData.company_id)
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
  if (driverId && truckId && currentLoad?.status === "pending") {
    updateData.status = "scheduled"
  }

  const { data, error } = await supabase
    .from("loads")
    .update(updateData)
    .eq("id", loadId)
    .eq("company_id", userData.company_id)
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
    return { error: error.message, data: null }
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
      console.error("[SMS] Failed to send dispatch notification:", error)
    }
  }

  revalidatePath("/dashboard/dispatches")
  revalidatePath("/dashboard/loads")
  
  // Trigger webhook
  if (driverId) {
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(userData.company_id, "driver.assigned", {
        load_id: loadId,
        driver_id: driverId,
        truck_id: truckId,
      })
    } catch (error) {
      console.warn("[quickAssignLoad] Webhook trigger failed:", error)
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
    .single()

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
    return { error: error.message, data: null }
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
      console.error("[SMS] Failed to send route notification:", error)
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
      console.warn("[quickAssignRoute] Webhook trigger failed:", error)
    }
  }
  
  return { data, error: null }
}

