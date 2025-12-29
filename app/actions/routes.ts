"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
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

export async function getRoutes() {
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

  const { data: routes, error } = await supabase
    .from("routes")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: routes, error: null }
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

  // Ensure required fields are present and handle undefined values
  const routeData: any = {
    company_id: userData.company_id,
    name: formData.name,
    origin: formData.origin,
    destination: formData.destination,
    priority: formData.priority || "normal",
    status: formData.status || "pending",
  }

  // Only add optional fields if they have values
  if (formData.distance) routeData.distance = formData.distance
  if (formData.estimated_time) routeData.estimated_time = formData.estimated_time
  if (formData.driver_id) routeData.driver_id = formData.driver_id
  if (formData.truck_id) routeData.truck_id = formData.truck_id
  if (formData.depot_name) routeData.depot_name = formData.depot_name
  if (formData.depot_address) routeData.depot_address = formData.depot_address
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

