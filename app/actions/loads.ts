"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createRoute } from "./routes"
import { sendNotification } from "./notifications"

// Helper function to send notifications in background (non-blocking)
async function sendNotificationsForLoadUpdate(loadData: any) {
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

  // Send notifications to all users who want load updates
  if (companyUsers) {
    for (const companyUser of companyUsers) {
      try {
        await sendNotification(companyUser.id, "load_update", {
          shipmentNumber: loadData.shipment_number,
          status: loadData.status,
          origin: loadData.origin,
          destination: loadData.destination,
        })
      } catch (error) {
        // Silently fail - don't block the main operation
        console.error(`[NOTIFICATION] Failed to send to user ${companyUser.id}:`, error)
      }
    }
  }
}

export async function getLoads() {
  try {
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
      console.error("[getLoads] Error fetching user:", userError)
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    const { data: loads, error } = await supabase
      .from("loads")
      .select("*")
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })

    if (error) {
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.error("[getLoads] Loads table does not exist")
        return { data: [], error: null } // Return empty array instead of error
      }
      console.error("[getLoads] Error fetching loads:", error)
      return { error: error.message, data: null }
    }

    return { data: loads || [], error: null }
  } catch (error: any) {
    console.error("[getLoads] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

export async function getLoad(id: string) {
  try {
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
      console.error("[getLoad] Error fetching user:", userError)
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    const { data: load, error } = await supabase
      .from("loads")
      .select("*")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .single()

    if (error) {
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.error("[getLoad] Loads table does not exist")
        return { error: "Loads table does not exist", data: null }
      }
      console.error("[getLoad] Error fetching load:", error)
      return { error: error.message, data: null }
    }

    return { data: load, error: null }
  } catch (error: any) {
    console.error("[getLoad] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

export async function createLoad(formData: {
  shipment_number: string
  origin: string
  destination: string
  weight?: string
  weight_kg?: number
  contents?: string
  value?: number
  carrier_type?: string
  status?: string
  driver_id?: string
  truck_id?: string
  route_id?: string | null
  load_date?: string | null
  estimated_delivery?: string | null
  delivery_type?: string
  company_name?: string
  customer_reference?: string
  requires_split_delivery?: boolean
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

  let routeId = formData.route_id || null

  // If no route is assigned, automatically create one
  if (!routeId && formData.origin && formData.destination) {
    // Check if a matching route already exists
    const normalizeLocation = (location: string) => {
      if (!location) return ""
      return location.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim()
    }

    const { data: existingRoutes } = await supabase
      .from("routes")
      .select("*")
      .eq("company_id", userData.company_id)

    if (existingRoutes) {
      const loadOriginNormalized = normalizeLocation(formData.origin)
      const loadDestNormalized = normalizeLocation(formData.destination)

      const matchingRoute = existingRoutes.find((route: any) => {
        const routeOriginNormalized = normalizeLocation(route.origin || "")
        const routeDestNormalized = normalizeLocation(route.destination || "")

        const originMatch =
          routeOriginNormalized &&
          loadOriginNormalized &&
          (routeOriginNormalized.includes(loadOriginNormalized) ||
            loadOriginNormalized.includes(routeOriginNormalized) ||
            routeOriginNormalized.split(" ")[0] === loadOriginNormalized.split(" ")[0])

        const destMatch =
          routeDestNormalized &&
          loadDestNormalized &&
          (routeDestNormalized.includes(loadDestNormalized) ||
            loadDestNormalized.includes(routeDestNormalized) ||
            routeDestNormalized.split(" ")[0] === loadDestNormalized.split(" ")[0])

        return originMatch && destMatch
      })

      if (matchingRoute) {
        routeId = matchingRoute.id
      } else {
        // Create a new route automatically
        const routeName = `${formData.origin} → ${formData.destination}`
        
        // Calculate estimated distance and time (simplified - in real app, use mapping API)
        const estimatedDistance = "Calculating..." // Could use Google Maps API here
        const estimatedTime = "Calculating..." // Could use Google Maps API here

        const routeResult = await createRoute({
          name: routeName,
          origin: formData.origin,
          destination: formData.destination,
          distance: estimatedDistance,
          estimated_time: estimatedTime,
          priority: "normal",
          status: formData.status === "scheduled" ? "scheduled" : "pending",
          driver_id: formData.driver_id || undefined,
          truck_id: formData.truck_id || undefined,
        })

        if (routeResult.data) {
          routeId = routeResult.data.id
        }
      }
    }
  }

  // Build insert data, only including fields that have values
  const loadData: any = {
    company_id: userData.company_id,
    shipment_number: formData.shipment_number,
    origin: formData.origin,
    destination: formData.destination,
    status: formData.status || "pending",
    delivery_type: formData.delivery_type || "single",
    total_delivery_points: 1, // Will be updated if delivery points are added
  }

  // Add optional fields only if they have values
  if (formData.weight) loadData.weight = formData.weight
  if (formData.weight_kg !== undefined && formData.weight_kg !== null) loadData.weight_kg = formData.weight_kg
  if (formData.contents) loadData.contents = formData.contents
  if (formData.value !== undefined && formData.value !== null) loadData.value = formData.value
  if (formData.carrier_type) loadData.carrier_type = formData.carrier_type
  if (formData.driver_id) loadData.driver_id = formData.driver_id
  if (formData.truck_id) loadData.truck_id = formData.truck_id
  if (routeId) loadData.route_id = routeId
  if (formData.load_date) loadData.load_date = formData.load_date
  if (formData.estimated_delivery) loadData.estimated_delivery = formData.estimated_delivery
  if (formData.company_name) loadData.company_name = formData.company_name
  if (formData.customer_reference) loadData.customer_reference = formData.customer_reference
  if (formData.requires_split_delivery !== undefined) loadData.requires_split_delivery = formData.requires_split_delivery

  const { data, error } = await supabase
    .from("loads")
    .insert(loadData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/loads")
  revalidatePath("/dashboard/routes")
  return { data, error: null }
}

export async function updateLoad(
  id: string,
  formData: {
    shipment_number?: string
    origin?: string
    destination?: string
    weight?: string
    weight_kg?: number
    contents?: string
    value?: number
    carrier_type?: string
    status?: string
    driver_id?: string
    truck_id?: string
    route_id?: string | null
    load_date?: string | null
    estimated_delivery?: string | null
    actual_delivery?: string | null
    delivery_type?: string
    company_name?: string
    customer_reference?: string
    requires_split_delivery?: boolean
    total_delivery_points?: number
    [key: string]: any
  }
) {
  const supabase = await createClient()

  // Build update data, only including fields that are provided
  const updateData: any = {}
  
  if (formData.shipment_number !== undefined) updateData.shipment_number = formData.shipment_number
  if (formData.origin !== undefined) updateData.origin = formData.origin
  if (formData.destination !== undefined) updateData.destination = formData.destination
  if (formData.weight !== undefined) updateData.weight = formData.weight
  if (formData.weight_kg !== undefined) updateData.weight_kg = formData.weight_kg || null
  if (formData.contents !== undefined) updateData.contents = formData.contents
  if (formData.value !== undefined) updateData.value = formData.value || null
  if (formData.carrier_type !== undefined) updateData.carrier_type = formData.carrier_type
  if (formData.status !== undefined) updateData.status = formData.status
  if (formData.driver_id !== undefined) updateData.driver_id = formData.driver_id || null
  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
  if (formData.route_id !== undefined) updateData.route_id = formData.route_id || null
  if (formData.load_date !== undefined) updateData.load_date = formData.load_date || null
  if (formData.estimated_delivery !== undefined) updateData.estimated_delivery = formData.estimated_delivery || null
  if (formData.actual_delivery !== undefined) updateData.actual_delivery = formData.actual_delivery || null
  if (formData.delivery_type !== undefined) updateData.delivery_type = formData.delivery_type
  if (formData.company_name !== undefined) updateData.company_name = formData.company_name || null
  if (formData.customer_reference !== undefined) updateData.customer_reference = formData.customer_reference || null
  if (formData.requires_split_delivery !== undefined) updateData.requires_split_delivery = formData.requires_split_delivery
  if (formData.total_delivery_points !== undefined) updateData.total_delivery_points = formData.total_delivery_points

  const { data, error } = await supabase
    .from("loads")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Send notifications to company users if load was updated (non-blocking)
  if (data) {
    // Don't await - send notifications in background
    sendNotificationsForLoadUpdate(data).catch((error) => {
      console.error("[NOTIFICATION] Failed to send load update notifications:", error)
    })
  }

  revalidatePath("/dashboard/loads")
  revalidatePath(`/dashboard/loads/${id}`)

  return { data, error: null }
}

export async function deleteLoad(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("loads").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/loads")
  return { error: null }
}

