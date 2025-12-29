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
  // New TruckLogics fields
  load_type?: string
  customer_id?: string
  bol_number?: string
  // Shipper fields
  shipper_name?: string
  shipper_address?: string
  shipper_city?: string
  shipper_state?: string
  shipper_zip?: string
  shipper_contact_name?: string
  shipper_contact_phone?: string
  shipper_contact_email?: string
  pickup_time?: string
  pickup_time_window_start?: string
  pickup_time_window_end?: string
  pickup_instructions?: string
  // Consignee fields
  consignee_name?: string
  consignee_address?: string
  consignee_city?: string
  consignee_state?: string
  consignee_zip?: string
  consignee_contact_name?: string
  consignee_contact_phone?: string
  consignee_contact_email?: string
  delivery_time?: string
  delivery_time_window_start?: string
  delivery_time_window_end?: string
  delivery_instructions?: string
  // Enhanced freight details
  pieces?: number
  pallets?: number
  boxes?: number
  length?: number
  width?: number
  height?: number
  temperature?: number
  is_hazardous?: boolean
  is_oversized?: boolean
  special_instructions?: string
  // Special requirements
  requires_liftgate?: boolean
  requires_inside_delivery?: boolean
  requires_appointment?: boolean
  appointment_time?: string
  // Pricing
  rate?: number
  rate_type?: string
  fuel_surcharge?: number
  accessorial_charges?: number
  discount?: number
  advance?: number
  total_rate?: number
  estimated_miles?: number
  estimated_profit?: number
  estimated_revenue?: number
  // Notes
  notes?: string
  internal_notes?: string
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

  // If no route is assigned, automatically create one (skip for multi-delivery with "Multiple Locations")
  if (!routeId && formData.origin && formData.destination && formData.destination !== "Multiple Locations") {
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

  // New TruckLogics fields
  if (formData.load_type) loadData.load_type = formData.load_type
  if (formData.customer_id) loadData.customer_id = formData.customer_id
  if (formData.bol_number) loadData.bol_number = formData.bol_number
  
  // Shipper fields
  if (formData.shipper_name) loadData.shipper_name = formData.shipper_name
  if (formData.shipper_address) loadData.shipper_address = formData.shipper_address
  if (formData.shipper_city) loadData.shipper_city = formData.shipper_city
  if (formData.shipper_state) loadData.shipper_state = formData.shipper_state
  if (formData.shipper_zip) loadData.shipper_zip = formData.shipper_zip
  if (formData.shipper_contact_name) loadData.shipper_contact_name = formData.shipper_contact_name
  if (formData.shipper_contact_phone) loadData.shipper_contact_phone = formData.shipper_contact_phone
  if (formData.shipper_contact_email) loadData.shipper_contact_email = formData.shipper_contact_email
  if (formData.pickup_time) loadData.pickup_time = formData.pickup_time
  if (formData.pickup_time_window_start) loadData.pickup_time_window_start = formData.pickup_time_window_start
  if (formData.pickup_time_window_end) loadData.pickup_time_window_end = formData.pickup_time_window_end
  if (formData.pickup_instructions) loadData.pickup_instructions = formData.pickup_instructions
  
  // Consignee fields
  if (formData.consignee_name) loadData.consignee_name = formData.consignee_name
  if (formData.consignee_address) loadData.consignee_address = formData.consignee_address
  if (formData.consignee_city) loadData.consignee_city = formData.consignee_city
  if (formData.consignee_state) loadData.consignee_state = formData.consignee_state
  if (formData.consignee_zip) loadData.consignee_zip = formData.consignee_zip
  if (formData.consignee_contact_name) loadData.consignee_contact_name = formData.consignee_contact_name
  if (formData.consignee_contact_phone) loadData.consignee_contact_phone = formData.consignee_contact_phone
  if (formData.consignee_contact_email) loadData.consignee_contact_email = formData.consignee_contact_email
  if (formData.delivery_time) loadData.delivery_time = formData.delivery_time
  if (formData.delivery_time_window_start) loadData.delivery_time_window_start = formData.delivery_time_window_start
  if (formData.delivery_time_window_end) loadData.delivery_time_window_end = formData.delivery_time_window_end
  if (formData.delivery_instructions) loadData.delivery_instructions = formData.delivery_instructions
  
  // Enhanced freight details
  if (formData.pieces !== undefined && formData.pieces !== null) loadData.pieces = formData.pieces
  if (formData.pallets !== undefined && formData.pallets !== null) loadData.pallets = formData.pallets
  if (formData.boxes !== undefined && formData.boxes !== null) loadData.boxes = formData.boxes
  if (formData.length !== undefined && formData.length !== null) loadData.length = formData.length
  if (formData.width !== undefined && formData.width !== null) loadData.width = formData.width
  if (formData.height !== undefined && formData.height !== null) loadData.height = formData.height
  if (formData.temperature !== undefined && formData.temperature !== null) loadData.temperature = formData.temperature
  if (formData.is_hazardous !== undefined) loadData.is_hazardous = formData.is_hazardous
  if (formData.is_oversized !== undefined) loadData.is_oversized = formData.is_oversized
  if (formData.special_instructions) loadData.special_instructions = formData.special_instructions
  
  // Special requirements
  if (formData.requires_liftgate !== undefined) loadData.requires_liftgate = formData.requires_liftgate
  if (formData.requires_inside_delivery !== undefined) loadData.requires_inside_delivery = formData.requires_inside_delivery
  if (formData.requires_appointment !== undefined) loadData.requires_appointment = formData.requires_appointment
  if (formData.appointment_time) loadData.appointment_time = formData.appointment_time
  
  // Pricing
  if (formData.rate !== undefined && formData.rate !== null) loadData.rate = formData.rate
  if (formData.rate_type) loadData.rate_type = formData.rate_type
  if (formData.fuel_surcharge !== undefined && formData.fuel_surcharge !== null) loadData.fuel_surcharge = formData.fuel_surcharge
  if (formData.accessorial_charges !== undefined && formData.accessorial_charges !== null) loadData.accessorial_charges = formData.accessorial_charges
  if (formData.discount !== undefined && formData.discount !== null) loadData.discount = formData.discount
  if (formData.advance !== undefined && formData.advance !== null) loadData.advance = formData.advance
  if (formData.total_rate !== undefined && formData.total_rate !== null) loadData.total_rate = formData.total_rate
  if (formData.estimated_miles !== undefined && formData.estimated_miles !== null) loadData.estimated_miles = formData.estimated_miles
  if (formData.estimated_profit !== undefined && formData.estimated_profit !== null) loadData.estimated_profit = formData.estimated_profit
  if (formData.estimated_revenue !== undefined && formData.estimated_revenue !== null) loadData.estimated_revenue = formData.estimated_revenue
  
  // Notes
  if (formData.notes) loadData.notes = formData.notes
  if (formData.internal_notes) loadData.internal_notes = formData.internal_notes

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

  // Get current load to check if status is changing to "delivered"
  const { data: currentLoad } = await supabase
    .from("loads")
    .select("status, value, shipment_number, origin, destination, company_name")
    .eq("id", id)
    .single()

  const wasDelivered = currentLoad?.status === "delivered"
  const willBeDelivered = formData.status === "delivered"

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

  // Auto-generate invoice when load status changes to "delivered"
  if (data && !wasDelivered && willBeDelivered) {
    // Check if invoice already exists for this load
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", id)
      .single()

    if (!existingInvoice && data.value) {
      // Auto-generate invoice
      const invoiceNumber = `INV-${data.shipment_number}-${Date.now()}`
      const issueDate = new Date().toISOString().split("T")[0]
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30) // Net 30 default

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: userData.company_id,
          invoice_number: invoiceNumber,
          customer_name: data.company_name || "Customer",
          load_id: id,
          amount: Number(data.value) || 0,
          status: "pending",
          issue_date: issueDate,
          due_date: dueDate.toISOString().split("T")[0],
          payment_terms: "Net 30",
          description: `Invoice for load ${data.shipment_number} - ${data.origin} to ${data.destination}`,
        })
        .select()
        .single()

      if (invoiceError) {
        console.error("[AUTO-INVOICE] Failed to create invoice:", invoiceError)
        // Don't fail the load update if invoice creation fails
      } else {
        console.log(`[AUTO-INVOICE] Invoice ${invoiceNumber} created automatically for load ${data.shipment_number}`)
        // Return invoice info so UI can show notification
        if (data) {
          (data as any).autoGeneratedInvoice = {
            id: newInvoice.id,
            invoice_number: invoiceNumber,
          }
        }
      }
    }
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
  revalidatePath("/dashboard/accounting/invoices")

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

