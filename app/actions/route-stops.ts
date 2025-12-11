"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all stops for a route
export async function getRouteStops(routeId: string) {
  try {
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

    const { data: stops, error } = await supabase
      .from("route_stops")
      .select("*")
      .eq("route_id", routeId)
      .eq("company_id", userData.company_id)
      .order("stop_number", { ascending: true })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return { data: [], error: null } // Table doesn't exist yet
      }
      return { error: error.message, data: null }
    }

    return { data: stops || [], error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Create a route stop
export async function createRouteStop(routeId: string, stopData: {
  stop_number: number
  location_name: string
  location_id?: string
  address: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  stop_type?: string
  priority?: string
  salesman_id?: string
  arrive_time?: string
  depart_time?: string
  service_time_minutes?: number
  travel_time_minutes?: number
  time_window_1_open?: string
  time_window_1_close?: string
  time_window_2_open?: string
  time_window_2_close?: string
  carts?: number
  boxes?: number
  pallets?: number
  orders?: number
  quantity_type?: string
  special_instructions?: string
  notes?: string
  coordinates?: { lat: number; lng: number }
}) {
  try {
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

    // Verify route belongs to company
    const { data: route } = await supabase
      .from("routes")
      .select("id, company_id")
      .eq("id", routeId)
      .eq("company_id", userData.company_id)
      .single()

    if (!route) {
      return { error: "Route not found", data: null }
    }

    const { data: stop, error } = await supabase
      .from("route_stops")
      .insert({
        route_id: routeId,
        company_id: userData.company_id,
        stop_number: stopData.stop_number,
        location_name: stopData.location_name,
        location_id: stopData.location_id || null,
        address: stopData.address,
        city: stopData.city || null,
        state: stopData.state || null,
        zip: stopData.zip || null,
        phone: stopData.phone || null,
        contact_name: stopData.contact_name || null,
        contact_phone: stopData.contact_phone || null,
        stop_type: stopData.stop_type || "delivery",
        priority: stopData.priority || null,
        salesman_id: stopData.salesman_id || null,
        arrive_time: stopData.arrive_time || null,
        depart_time: stopData.depart_time || null,
        service_time_minutes: stopData.service_time_minutes || null,
        travel_time_minutes: stopData.travel_time_minutes || null,
        time_window_1_open: stopData.time_window_1_open || null,
        time_window_1_close: stopData.time_window_1_close || null,
        time_window_2_open: stopData.time_window_2_open || null,
        time_window_2_close: stopData.time_window_2_close || null,
        carts: stopData.carts || 0,
        boxes: stopData.boxes || 0,
        pallets: stopData.pallets || 0,
        orders: stopData.orders || 0,
        quantity_type: stopData.quantity_type || "delivery",
        special_instructions: stopData.special_instructions || null,
        notes: stopData.notes || null,
        coordinates: stopData.coordinates || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return { error: "Stop number already exists for this route", data: null }
      }
      return { error: error.message, data: null }
    }

    revalidatePath(`/dashboard/routes/${routeId}`)
    revalidatePath("/dashboard/routes")

    return { data: stop, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Update a route stop
export async function updateRouteStop(stopId: string, stopData: {
  stop_number?: number
  location_name?: string
  location_id?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  stop_type?: string
  priority?: string
  salesman_id?: string
  arrive_time?: string
  depart_time?: string
  service_time_minutes?: number
  travel_time_minutes?: number
  time_window_1_open?: string
  time_window_1_close?: string
  time_window_2_open?: string
  time_window_2_close?: string
  carts?: number
  boxes?: number
  pallets?: number
  orders?: number
  quantity_type?: string
  special_instructions?: string
  notes?: string
  coordinates?: { lat: number; lng: number }
  status?: string
  actual_arrive_time?: string
  actual_depart_time?: string
}) {
  try {
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
    if (stopData.stop_number !== undefined) updateData.stop_number = stopData.stop_number
    if (stopData.location_name !== undefined) updateData.location_name = stopData.location_name
    if (stopData.location_id !== undefined) updateData.location_id = stopData.location_id || null
    if (stopData.address !== undefined) updateData.address = stopData.address
    if (stopData.city !== undefined) updateData.city = stopData.city || null
    if (stopData.state !== undefined) updateData.state = stopData.state || null
    if (stopData.zip !== undefined) updateData.zip = stopData.zip || null
    if (stopData.phone !== undefined) updateData.phone = stopData.phone || null
    if (stopData.contact_name !== undefined) updateData.contact_name = stopData.contact_name || null
    if (stopData.contact_phone !== undefined) updateData.contact_phone = stopData.contact_phone || null
    if (stopData.stop_type !== undefined) updateData.stop_type = stopData.stop_type
    if (stopData.priority !== undefined) updateData.priority = stopData.priority || null
    if (stopData.salesman_id !== undefined) updateData.salesman_id = stopData.salesman_id || null
    if (stopData.arrive_time !== undefined) updateData.arrive_time = stopData.arrive_time || null
    if (stopData.depart_time !== undefined) updateData.depart_time = stopData.depart_time || null
    if (stopData.service_time_minutes !== undefined) updateData.service_time_minutes = stopData.service_time_minutes || null
    if (stopData.travel_time_minutes !== undefined) updateData.travel_time_minutes = stopData.travel_time_minutes || null
    if (stopData.time_window_1_open !== undefined) updateData.time_window_1_open = stopData.time_window_1_open || null
    if (stopData.time_window_1_close !== undefined) updateData.time_window_1_close = stopData.time_window_1_close || null
    if (stopData.time_window_2_open !== undefined) updateData.time_window_2_open = stopData.time_window_2_open || null
    if (stopData.time_window_2_close !== undefined) updateData.time_window_2_close = stopData.time_window_2_close || null
    if (stopData.carts !== undefined) updateData.carts = stopData.carts || 0
    if (stopData.boxes !== undefined) updateData.boxes = stopData.boxes || 0
    if (stopData.pallets !== undefined) updateData.pallets = stopData.pallets || 0
    if (stopData.orders !== undefined) updateData.orders = stopData.orders || 0
    if (stopData.quantity_type !== undefined) updateData.quantity_type = stopData.quantity_type
    if (stopData.special_instructions !== undefined) updateData.special_instructions = stopData.special_instructions || null
    if (stopData.notes !== undefined) updateData.notes = stopData.notes || null
    if (stopData.coordinates !== undefined) updateData.coordinates = stopData.coordinates || null
    if (stopData.status !== undefined) updateData.status = stopData.status
    if (stopData.actual_arrive_time !== undefined) updateData.actual_arrive_time = stopData.actual_arrive_time || null
    if (stopData.actual_depart_time !== undefined) updateData.actual_depart_time = stopData.actual_depart_time || null

    const { data: stop, error } = await supabase
      .from("route_stops")
      .update(updateData)
      .eq("id", stopId)
      .eq("company_id", userData.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath(`/dashboard/routes/${stop.route_id}`)
    revalidatePath("/dashboard/routes")

    return { data: stop, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Delete a route stop
export async function deleteRouteStop(stopId: string) {
  try {
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

    // Get stop to get route_id for revalidation
    const { data: stop } = await supabase
      .from("route_stops")
      .select("route_id")
      .eq("id", stopId)
      .eq("company_id", userData.company_id)
      .single()

    if (!stop) {
      return { error: "Stop not found", data: null }
    }

    const { error } = await supabase
      .from("route_stops")
      .delete()
      .eq("id", stopId)
      .eq("company_id", userData.company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath(`/dashboard/routes/${stop.route_id}`)
    revalidatePath("/dashboard/routes")

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Reorder stops (update stop numbers)
export async function reorderRouteStops(routeId: string, stopIds: string[]) {
  try {
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

    // Update stop numbers based on new order
    for (let i = 0; i < stopIds.length; i++) {
      const { error } = await supabase
        .from("route_stops")
        .update({ stop_number: i + 1 })
        .eq("id", stopIds[i])
        .eq("route_id", routeId)
        .eq("company_id", userData.company_id)

      if (error) {
        return { error: error.message, data: null }
      }
    }

    revalidatePath(`/dashboard/routes/${routeId}`)
    revalidatePath("/dashboard/routes")

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Get route summary (totals for all stops)
export async function getRouteSummary(routeId: string) {
  try {
    const stopsResult = await getRouteStops(routeId)

    if (stopsResult.error || !stopsResult.data) {
      return { error: stopsResult.error || "Failed to get stops", data: null }
    }

    const stops = stopsResult.data

    const summary = {
      total_stops: stops.length,
      total_travel_time_minutes: stops.reduce((sum, stop) => sum + (stop.travel_time_minutes || 0), 0),
      total_service_time_minutes: stops.reduce((sum, stop) => sum + (stop.service_time_minutes || 0), 0),
      total_distance: 0, // Will be calculated from coordinates if available
      total_carts: stops.reduce((sum, stop) => sum + (stop.carts || 0), 0),
      total_boxes: stops.reduce((sum, stop) => sum + (stop.boxes || 0), 0),
      total_pallets: stops.reduce((sum, stop) => sum + (stop.pallets || 0), 0),
      total_orders: stops.reduce((sum, stop) => sum + (stop.orders || 0), 0),
      delivery_carts: stops.filter(s => s.quantity_type === "delivery").reduce((sum, stop) => sum + (stop.carts || 0), 0),
      delivery_boxes: stops.filter(s => s.quantity_type === "delivery").reduce((sum, stop) => sum + (stop.boxes || 0), 0),
      delivery_pallets: stops.filter(s => s.quantity_type === "delivery").reduce((sum, stop) => sum + (stop.pallets || 0), 0),
      delivery_orders: stops.filter(s => s.quantity_type === "delivery").reduce((sum, stop) => sum + (stop.orders || 0), 0),
      pickup_carts: stops.filter(s => s.quantity_type === "pickup").reduce((sum, stop) => sum + (stop.carts || 0), 0),
      pickup_boxes: stops.filter(s => s.quantity_type === "pickup").reduce((sum, stop) => sum + (stop.boxes || 0), 0),
      pickup_pallets: stops.filter(s => s.quantity_type === "pickup").reduce((sum, stop) => sum + (stop.pallets || 0), 0),
      pickup_orders: stops.filter(s => s.quantity_type === "pickup").reduce((sum, stop) => sum + (stop.orders || 0), 0),
    }

    return { data: summary, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

