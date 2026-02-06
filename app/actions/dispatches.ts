"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get all loads for the company
  const { data: loads, error } = await supabase
    .from("loads")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  // Filter to only unassigned loads (no driver OR no truck OR pending status)
  const unassignedLoads = loads?.filter((load) => 
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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get all routes for the company
  const { data: routes, error } = await supabase
    .from("routes")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  // Filter to only unassigned routes (no driver OR no truck OR pending status)
  const unassignedRoutes = routes?.filter((route) => 
    !route.driver_id || !route.truck_id || route.status === "pending"
  ) || []

  return { data: unassignedRoutes, error: null }
}

/**
 * Quick assign driver and truck to a load
 */
export async function quickAssignLoad(loadId: string, driverId?: string, truckId?: string) {
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

  // Get current load to check status
  const { data: currentLoad } = await supabase
    .from("loads")
    .select("status")
    .eq("id", loadId)
    .single()

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
    .select()
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

  const updateData: any = {}
  if (driverId) updateData.driver_id = driverId
  if (truckId) updateData.truck_id = truckId
  
  // Get current route status
  const { data: currentRoute } = await supabase
    .from("routes")
    .select("status")
    .eq("id", routeId)
    .single()
  
  // Update status to scheduled if both driver and truck are assigned and status is pending
  if (driverId && truckId && currentRoute?.status === "pending") {
    updateData.status = "scheduled"
  }

  const { data, error } = await supabase
    .from("routes")
    .update(updateData)
    .eq("id", routeId)
    .eq("company_id", userData.company_id)
    .select()
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

