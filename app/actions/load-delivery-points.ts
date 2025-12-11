"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all delivery points for a load
export async function getLoadDeliveryPoints(loadId: string) {
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

    const { data: deliveryPoints, error } = await supabase
      .from("load_delivery_points")
      .select("*")
      .eq("load_id", loadId)
      .eq("company_id", userData.company_id)
      .order("delivery_number", { ascending: true })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return { data: [], error: null } // Table doesn't exist yet
      }
      return { error: error.message, data: null }
    }

    return { data: deliveryPoints || [], error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Create a delivery point
export async function createLoadDeliveryPoint(loadId: string, deliveryPointData: {
  delivery_number: number
  location_name: string
  location_id?: string
  address: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  delivery_type?: string
  priority?: string
  weight_kg?: number
  weight_lbs?: number
  pieces?: number
  pallets?: number
  boxes?: number
  carts?: number
  volume_cubic_meters?: number
  delivery_instructions?: string
  special_handling?: string
  requires_liftgate?: boolean
  requires_inside_delivery?: boolean
  requires_appointment?: boolean
  appointment_time?: string
  scheduled_delivery_date?: string
  scheduled_delivery_time?: string
  time_window_start?: string
  time_window_end?: string
  reference_number?: string
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

    // Verify load belongs to company
    const { data: load } = await supabase
      .from("loads")
      .select("id, company_id")
      .eq("id", loadId)
      .eq("company_id", userData.company_id)
      .single()

    if (!load) {
      return { error: "Load not found", data: null }
    }

    const { data: deliveryPoint, error } = await supabase
      .from("load_delivery_points")
      .insert({
        load_id: loadId,
        company_id: userData.company_id,
        delivery_number: deliveryPointData.delivery_number,
        location_name: deliveryPointData.location_name,
        location_id: deliveryPointData.location_id || null,
        address: deliveryPointData.address,
        city: deliveryPointData.city || null,
        state: deliveryPointData.state || null,
        zip: deliveryPointData.zip || null,
        phone: deliveryPointData.phone || null,
        contact_name: deliveryPointData.contact_name || null,
        contact_phone: deliveryPointData.contact_phone || null,
        delivery_type: deliveryPointData.delivery_type || "delivery",
        priority: deliveryPointData.priority || null,
        weight_kg: deliveryPointData.weight_kg || null,
        weight_lbs: deliveryPointData.weight_lbs || null,
        pieces: deliveryPointData.pieces || 0,
        pallets: deliveryPointData.pallets || 0,
        boxes: deliveryPointData.boxes || 0,
        carts: deliveryPointData.carts || 0,
        volume_cubic_meters: deliveryPointData.volume_cubic_meters || null,
        delivery_instructions: deliveryPointData.delivery_instructions || null,
        special_handling: deliveryPointData.special_handling || null,
        requires_liftgate: deliveryPointData.requires_liftgate || false,
        requires_inside_delivery: deliveryPointData.requires_inside_delivery || false,
        requires_appointment: deliveryPointData.requires_appointment || false,
        appointment_time: deliveryPointData.appointment_time || null,
        scheduled_delivery_date: deliveryPointData.scheduled_delivery_date || null,
        scheduled_delivery_time: deliveryPointData.scheduled_delivery_time || null,
        time_window_start: deliveryPointData.time_window_start || null,
        time_window_end: deliveryPointData.time_window_end || null,
        reference_number: deliveryPointData.reference_number || null,
        notes: deliveryPointData.notes || null,
        coordinates: deliveryPointData.coordinates || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return { error: "Delivery number already exists for this load", data: null }
      }
      return { error: error.message, data: null }
    }

    // Update load's total_delivery_points
    const { count } = await supabase
      .from("load_delivery_points")
      .select("*", { count: "exact", head: true })
      .eq("load_id", loadId)

    await supabase
      .from("loads")
      .update({ total_delivery_points: count || 1 })
      .eq("id", loadId)

    revalidatePath(`/dashboard/loads/${loadId}`)
    revalidatePath("/dashboard/loads")

    return { data: deliveryPoint, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Update a delivery point
export async function updateLoadDeliveryPoint(deliveryPointId: string, deliveryPointData: {
  delivery_number?: number
  location_name?: string
  location_id?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  delivery_type?: string
  priority?: string
  weight_kg?: number
  weight_lbs?: number
  pieces?: number
  pallets?: number
  boxes?: number
  carts?: number
  volume_cubic_meters?: number
  delivery_instructions?: string
  special_handling?: string
  requires_liftgate?: boolean
  requires_inside_delivery?: boolean
  requires_appointment?: boolean
  appointment_time?: string
  scheduled_delivery_date?: string
  scheduled_delivery_time?: string
  time_window_start?: string
  time_window_end?: string
  status?: string
  actual_delivery_date?: string
  actual_delivery_time?: string
  delivery_notes?: string
  reference_number?: string
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

    const updateData: any = {}
    if (deliveryPointData.delivery_number !== undefined) updateData.delivery_number = deliveryPointData.delivery_number
    if (deliveryPointData.location_name !== undefined) updateData.location_name = deliveryPointData.location_name
    if (deliveryPointData.location_id !== undefined) updateData.location_id = deliveryPointData.location_id || null
    if (deliveryPointData.address !== undefined) updateData.address = deliveryPointData.address
    if (deliveryPointData.city !== undefined) updateData.city = deliveryPointData.city || null
    if (deliveryPointData.state !== undefined) updateData.state = deliveryPointData.state || null
    if (deliveryPointData.zip !== undefined) updateData.zip = deliveryPointData.zip || null
    if (deliveryPointData.phone !== undefined) updateData.phone = deliveryPointData.phone || null
    if (deliveryPointData.contact_name !== undefined) updateData.contact_name = deliveryPointData.contact_name || null
    if (deliveryPointData.contact_phone !== undefined) updateData.contact_phone = deliveryPointData.contact_phone || null
    if (deliveryPointData.delivery_type !== undefined) updateData.delivery_type = deliveryPointData.delivery_type
    if (deliveryPointData.priority !== undefined) updateData.priority = deliveryPointData.priority || null
    if (deliveryPointData.weight_kg !== undefined) updateData.weight_kg = deliveryPointData.weight_kg || null
    if (deliveryPointData.weight_lbs !== undefined) updateData.weight_lbs = deliveryPointData.weight_lbs || null
    if (deliveryPointData.pieces !== undefined) updateData.pieces = deliveryPointData.pieces || 0
    if (deliveryPointData.pallets !== undefined) updateData.pallets = deliveryPointData.pallets || 0
    if (deliveryPointData.boxes !== undefined) updateData.boxes = deliveryPointData.boxes || 0
    if (deliveryPointData.carts !== undefined) updateData.carts = deliveryPointData.carts || 0
    if (deliveryPointData.volume_cubic_meters !== undefined) updateData.volume_cubic_meters = deliveryPointData.volume_cubic_meters || null
    if (deliveryPointData.delivery_instructions !== undefined) updateData.delivery_instructions = deliveryPointData.delivery_instructions || null
    if (deliveryPointData.special_handling !== undefined) updateData.special_handling = deliveryPointData.special_handling || null
    if (deliveryPointData.requires_liftgate !== undefined) updateData.requires_liftgate = deliveryPointData.requires_liftgate
    if (deliveryPointData.requires_inside_delivery !== undefined) updateData.requires_inside_delivery = deliveryPointData.requires_inside_delivery
    if (deliveryPointData.requires_appointment !== undefined) updateData.requires_appointment = deliveryPointData.requires_appointment
    if (deliveryPointData.appointment_time !== undefined) updateData.appointment_time = deliveryPointData.appointment_time || null
    if (deliveryPointData.scheduled_delivery_date !== undefined) updateData.scheduled_delivery_date = deliveryPointData.scheduled_delivery_date || null
    if (deliveryPointData.scheduled_delivery_time !== undefined) updateData.scheduled_delivery_time = deliveryPointData.scheduled_delivery_time || null
    if (deliveryPointData.time_window_start !== undefined) updateData.time_window_start = deliveryPointData.time_window_start || null
    if (deliveryPointData.time_window_end !== undefined) updateData.time_window_end = deliveryPointData.time_window_end || null
    if (deliveryPointData.status !== undefined) updateData.status = deliveryPointData.status
    if (deliveryPointData.actual_delivery_date !== undefined) updateData.actual_delivery_date = deliveryPointData.actual_delivery_date || null
    if (deliveryPointData.actual_delivery_time !== undefined) updateData.actual_delivery_time = deliveryPointData.actual_delivery_time || null
    if (deliveryPointData.delivery_notes !== undefined) updateData.delivery_notes = deliveryPointData.delivery_notes || null
    if (deliveryPointData.reference_number !== undefined) updateData.reference_number = deliveryPointData.reference_number || null
    if (deliveryPointData.notes !== undefined) updateData.notes = deliveryPointData.notes || null
    if (deliveryPointData.coordinates !== undefined) updateData.coordinates = deliveryPointData.coordinates || null

    const { data: deliveryPoint, error } = await supabase
      .from("load_delivery_points")
      .update(updateData)
      .eq("id", deliveryPointId)
      .eq("company_id", userData.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath(`/dashboard/loads/${deliveryPoint.load_id}`)
    revalidatePath("/dashboard/loads")

    return { data: deliveryPoint, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Delete a delivery point
export async function deleteLoadDeliveryPoint(deliveryPointId: string) {
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

    // Get delivery point to get load_id for revalidation
    const { data: deliveryPoint } = await supabase
      .from("load_delivery_points")
      .select("load_id")
      .eq("id", deliveryPointId)
      .eq("company_id", userData.company_id)
      .single()

    if (!deliveryPoint) {
      return { error: "Delivery point not found", data: null }
    }

    const { error } = await supabase
      .from("load_delivery_points")
      .delete()
      .eq("id", deliveryPointId)
      .eq("company_id", userData.company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    // Update load's total_delivery_points
    const { count } = await supabase
      .from("load_delivery_points")
      .select("*", { count: "exact", head: true })
      .eq("load_id", deliveryPoint.load_id)

    await supabase
      .from("loads")
      .update({ total_delivery_points: count || 0 })
      .eq("id", deliveryPoint.load_id)

    revalidatePath(`/dashboard/loads/${deliveryPoint.load_id}`)
    revalidatePath("/dashboard/loads")

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Get load summary (totals for all delivery points)
export async function getLoadSummary(loadId: string) {
  try {
    const deliveryPointsResult = await getLoadDeliveryPoints(loadId)

    if (deliveryPointsResult.error || !deliveryPointsResult.data) {
      return { error: deliveryPointsResult.error || "Failed to get delivery points", data: null }
    }

    const deliveryPoints = deliveryPointsResult.data

    const summary = {
      total_delivery_points: deliveryPoints.length,
      total_weight_kg: deliveryPoints.reduce((sum, dp) => sum + (parseFloat(dp.weight_kg) || 0), 0),
      total_weight_lbs: deliveryPoints.reduce((sum, dp) => sum + (parseFloat(dp.weight_lbs) || 0), 0),
      total_pieces: deliveryPoints.reduce((sum, dp) => sum + (dp.pieces || 0), 0),
      total_pallets: deliveryPoints.reduce((sum, dp) => sum + (dp.pallets || 0), 0),
      total_boxes: deliveryPoints.reduce((sum, dp) => sum + (dp.boxes || 0), 0),
      total_carts: deliveryPoints.reduce((sum, dp) => sum + (dp.carts || 0), 0),
      total_volume: deliveryPoints.reduce((sum, dp) => sum + (parseFloat(dp.volume_cubic_meters) || 0), 0),
    }

    return { data: summary, error: null }
  } catch (error: any) {
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

