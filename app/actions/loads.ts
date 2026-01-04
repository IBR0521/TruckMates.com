"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { createRoute } from "./routes"
import { sendNotification } from "./notifications"
import { validateLoadData, validatePricingData, sanitizeString, sanitizeEmail, sanitizePhone, validateAddress } from "@/lib/validation"

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

export async function getLoads(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("[getLoads] Auth error:", authError)
      return { error: "Authentication failed. Please try logging in again.", data: null, count: 0 }
    }

    if (!user) {
      return { error: "Not authenticated", data: null, count: 0 }
    }

    // Use optimized helper with caching
    const result = await getCachedUserCompany(user.id)
    const company_id = result.company_id
    const companyError = result.error

    if (companyError || !company_id) {
      return { error: companyError || "No company found", data: null, count: 0 }
    }

    // Build query with pagination
    let query = supabase
      .from("loads")
      .select("id, shipment_number, origin, destination, status, driver_id, truck_id, load_date, estimated_delivery, created_at, company_name, value", { count: "exact" })
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // Apply pagination (default limit 100)
    const limit = filters?.limit || 100
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: loads, error, count } = await query

    if (error) {
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.error("[getLoads] Loads table does not exist")
        return { data: [], error: null, count: 0 } // Return empty array instead of error
      }
      console.error("[getLoads] Error fetching loads:", error)
      return { error: error.message, data: null, count: 0 }
    }

    return { data: loads || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error("[getLoads] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null, count: 0 }
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

  // Get company settings to apply load defaults
  const { getCompanySettings } = await import("./number-formats")
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}

  // Professional validation
  const loadValidation = validateLoadData({
    origin: formData.origin,
    destination: formData.destination,
    weight: formData.weight_kg || formData.weight,
    value: formData.value,
    estimated_delivery: formData.estimated_delivery || undefined,
    load_date: formData.load_date || undefined,
  })

  if (!loadValidation.valid) {
    return { error: loadValidation.errors.join("; "), data: null }
  }

  // Validate pricing data if provided
  if (formData.rate !== undefined || formData.total_rate !== undefined) {
    const pricingValidation = validatePricingData({
      rate: formData.rate,
      fuel_surcharge: formData.fuel_surcharge,
      accessorial_charges: formData.accessorial_charges,
      discount: formData.discount,
      total_rate: formData.total_rate,
    })

    if (!pricingValidation.valid) {
      return { error: pricingValidation.errors.join("; "), data: null }
    }
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
      return { error: "Cannot assign inactive driver to load", data: null }
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

  // Validate customer if provided
  if (formData.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, company_id")
      .eq("id", formData.customer_id)
      .eq("company_id", userData.company_id)
      .single()

    if (customerError || !customer) {
      return { error: "Invalid customer selected", data: null }
    }
  }

  // Auto-generate shipment number if not provided
  let shipmentNumber = formData.shipment_number
  if (!shipmentNumber || shipmentNumber.trim() === "") {
    const { generateLoadNumber } = await import("./number-formats")
    const numberResult = await generateLoadNumber()
    if (numberResult.error || !numberResult.data) {
      return { error: numberResult.error || "Failed to generate load number", data: null }
    }
    shipmentNumber = numberResult.data
  } else {
    // Sanitize and validate shipment number
    shipmentNumber = sanitizeString(shipmentNumber, 50).toUpperCase()
    if (!shipmentNumber) {
      return { error: "Invalid shipment number", data: null }
    }

    // Check for duplicate shipment number
    const { data: existingLoad } = await supabase
      .from("loads")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("shipment_number", shipmentNumber)
      .single()

    if (existingLoad) {
      return { error: "Shipment number already exists", data: null }
    }
  }

  let routeId = formData.route_id || null

  // If no route is assigned, automatically create one if setting is enabled (skip for multi-delivery with "Multiple Locations")
  if (!routeId && settings.auto_create_route && formData.origin && formData.destination && formData.destination !== "Multiple Locations") {
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

  // Apply load settings defaults
  const finalLoadType = formData.load_type || settings.default_load_type || "ftl"
  const finalCarrierType = formData.carrier_type || settings.default_carrier_type || "dry-van"
  const finalStatus = formData.status || settings.default_status || "pending"
  
  // Apply default pricing if not provided
  let finalRate = formData.rate
  let finalFuelSurcharge = formData.fuel_surcharge
  if (!finalRate && settings.default_rate_per_mile && formData.estimated_miles) {
    finalRate = settings.default_rate_per_mile * formData.estimated_miles
  }
  if (!finalFuelSurcharge && settings.default_fuel_surcharge_percentage && finalRate) {
    finalFuelSurcharge = (finalRate * settings.default_fuel_surcharge_percentage) / 100
  }

  // Auto-assign driver/truck if enabled and not provided
  let finalDriverId = formData.driver_id
  let finalTruckId = formData.truck_id
  
  if ((settings.auto_assign_driver || settings.auto_assign_truck) && formData.origin && formData.destination) {
    try {
      const { getLoadSuggestions } = await import("./loads")
      const suggestionsResult = await getLoadSuggestions(formData.origin, formData.destination)
      if (suggestionsResult.data) {
        if (settings.auto_assign_driver && !finalDriverId && suggestionsResult.data.suggestedDriver) {
          finalDriverId = suggestionsResult.data.suggestedDriver.id
        }
        if (settings.auto_assign_truck && !finalTruckId && suggestionsResult.data.suggestedTruck) {
          finalTruckId = suggestionsResult.data.suggestedTruck.id
        }
      }
    } catch (err) {
      console.warn("Failed to get load suggestions for auto-assignment:", err)
    }
  }

  // Build insert data with professional sanitization
  const loadData: any = {
    company_id: userData.company_id,
    shipment_number: shipmentNumber,
    origin: sanitizeString(formData.origin, 200),
    destination: sanitizeString(formData.destination, 200),
    status: finalStatus,
    load_type: finalLoadType,
    carrier_type: finalCarrierType,
    delivery_type: formData.delivery_type || "single",
    total_delivery_points: 1, // Will be updated if delivery points are added
  }
  
  // Use auto-assigned driver/truck if available
  if (finalDriverId) loadData.driver_id = finalDriverId
  if (finalTruckId) loadData.truck_id = finalTruckId

  // Add optional fields with validation and sanitization
  if (formData.weight) loadData.weight = sanitizeString(formData.weight, 50)
  if (formData.weight_kg !== undefined && formData.weight_kg !== null) {
    const weight = typeof formData.weight_kg === 'string' ? parseFloat(formData.weight_kg) : formData.weight_kg
    if (!isNaN(weight) && weight > 0) loadData.weight_kg = weight
  }
  if (formData.contents) loadData.contents = sanitizeString(formData.contents, 500)
  if (formData.value !== undefined && formData.value !== null) {
    const value = typeof formData.value === 'string' ? parseFloat(formData.value) : formData.value
    if (!isNaN(value) && value >= 0) loadData.value = value
  }
  // Carrier type already set from defaults above, only override if explicitly provided
  if (formData.carrier_type) loadData.carrier_type = sanitizeString(formData.carrier_type, 50)
  // Driver/truck already set from auto-assignment above, only override if explicitly provided
  if (formData.driver_id) loadData.driver_id = formData.driver_id
  if (formData.truck_id) loadData.truck_id = formData.truck_id
  if (routeId) loadData.route_id = routeId
  if (formData.load_date) loadData.load_date = formData.load_date
  if (formData.estimated_delivery) loadData.estimated_delivery = formData.estimated_delivery
  if (formData.company_name) loadData.company_name = sanitizeString(formData.company_name, 200)
  if (formData.customer_reference) loadData.customer_reference = sanitizeString(formData.customer_reference, 100)
  if (formData.requires_split_delivery !== undefined) loadData.requires_split_delivery = formData.requires_split_delivery

  // New TruckLogics fields
  if (formData.load_type) loadData.load_type = sanitizeString(formData.load_type, 50)
  if (formData.customer_id) loadData.customer_id = formData.customer_id
  if (formData.bol_number) loadData.bol_number = sanitizeString(formData.bol_number, 50)
  
  // Shipper fields with validation
  if (formData.shipper_name) loadData.shipper_name = sanitizeString(formData.shipper_name, 200)
  if (formData.shipper_address) loadData.shipper_address = sanitizeString(formData.shipper_address, 200)
  if (formData.shipper_city) loadData.shipper_city = sanitizeString(formData.shipper_city, 100)
  if (formData.shipper_state) {
    const state = sanitizeString(formData.shipper_state, 2).toUpperCase()
    if (state.length === 2) loadData.shipper_state = state
  }
  if (formData.shipper_zip) {
    const zip = sanitizeString(formData.shipper_zip, 10)
    if (zip.length >= 5) loadData.shipper_zip = zip
  }
  if (formData.shipper_contact_name) loadData.shipper_contact_name = sanitizeString(formData.shipper_contact_name, 100)
  if (formData.shipper_contact_phone) loadData.shipper_contact_phone = sanitizePhone(formData.shipper_contact_phone)
  if (formData.shipper_contact_email) loadData.shipper_contact_email = sanitizeEmail(formData.shipper_contact_email)
  if (formData.pickup_time) loadData.pickup_time = formData.pickup_time
  if (formData.pickup_time_window_start) loadData.pickup_time_window_start = formData.pickup_time_window_start
  if (formData.pickup_time_window_end) loadData.pickup_time_window_end = formData.pickup_time_window_end
  if (formData.pickup_instructions) loadData.pickup_instructions = formData.pickup_instructions
  
  // Consignee fields with validation
  if (formData.consignee_name) loadData.consignee_name = sanitizeString(formData.consignee_name, 200)
  if (formData.consignee_address) loadData.consignee_address = sanitizeString(formData.consignee_address, 200)
  if (formData.consignee_city) loadData.consignee_city = sanitizeString(formData.consignee_city, 100)
  if (formData.consignee_state) {
    const state = sanitizeString(formData.consignee_state, 2).toUpperCase()
    if (state.length === 2) loadData.consignee_state = state
  }
  if (formData.consignee_zip) {
    const zip = sanitizeString(formData.consignee_zip, 10)
    if (zip.length >= 5) loadData.consignee_zip = zip
  }
  if (formData.consignee_contact_name) loadData.consignee_contact_name = sanitizeString(formData.consignee_contact_name, 100)
  if (formData.consignee_contact_phone) loadData.consignee_contact_phone = sanitizePhone(formData.consignee_contact_phone)
  if (formData.consignee_contact_email) loadData.consignee_contact_email = sanitizeEmail(formData.consignee_contact_email)
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
  
  // Pricing (use defaults if not provided)
  if (finalRate !== undefined && finalRate !== null) loadData.rate = finalRate
  else if (formData.rate !== undefined && formData.rate !== null) loadData.rate = formData.rate
  if (formData.rate_type) loadData.rate_type = formData.rate_type
  if (finalFuelSurcharge !== undefined && finalFuelSurcharge !== null) loadData.fuel_surcharge = finalFuelSurcharge
  else if (formData.fuel_surcharge !== undefined && formData.fuel_surcharge !== null) loadData.fuel_surcharge = formData.fuel_surcharge
  if (formData.accessorial_charges !== undefined && formData.accessorial_charges !== null) loadData.accessorial_charges = formData.accessorial_charges
  if (formData.discount !== undefined && formData.discount !== null) loadData.discount = formData.discount
  if (formData.advance !== undefined && formData.advance !== null) loadData.advance = formData.advance
  if (formData.total_rate !== undefined && formData.total_rate !== null) loadData.total_rate = formData.total_rate
  if (formData.estimated_miles !== undefined && formData.estimated_miles !== null) loadData.estimated_miles = formData.estimated_miles
  if (formData.estimated_profit !== undefined && formData.estimated_profit !== null) loadData.estimated_profit = formData.estimated_profit
  if (formData.estimated_revenue !== undefined && formData.estimated_revenue !== null) loadData.estimated_revenue = formData.estimated_revenue
  
  // Notes with sanitization
  if (formData.notes) loadData.notes = sanitizeString(formData.notes, 2000)
  if (formData.internal_notes) loadData.internal_notes = sanitizeString(formData.internal_notes, 2000)
  if (formData.special_instructions) loadData.special_instructions = sanitizeString(formData.special_instructions, 1000)
  if (formData.pickup_instructions) loadData.pickup_instructions = sanitizeString(formData.pickup_instructions, 1000)
  if (formData.delivery_instructions) loadData.delivery_instructions = sanitizeString(formData.delivery_instructions, 1000)

  const { data, error } = await supabase
    .from("loads")
    .insert(loadData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Auto-schedule check calls if load has driver
  if (data.driver_id) {
    try {
      const { scheduleCheckCallsForLoad } = await import("./check-calls")
      await scheduleCheckCallsForLoad(data.id).catch((err) => {
        console.warn("[createLoad] Check calls scheduling failed (table may not exist):", err.message)
      })
    } catch (err: any) {
      console.warn("[createLoad] Failed to import check-calls:", err.message)
    }
  }

  // Trigger alert for new load creation
  try {
    const { createAlert } = await import("./alerts")
    await createAlert({
      title: `New Load Created: ${shipmentNumber}`,
      message: `Load ${shipmentNumber} from ${formData.origin} to ${formData.destination} has been created`,
      event_type: "load_created",
      priority: "normal",
      load_id: data.id,
      metadata: {
        shipment_number: shipmentNumber,
        origin: formData.origin,
        destination: formData.destination,
        status: data.status,
      },
    }).catch((err) => {
      console.warn("[createLoad] Alert creation failed (table may not exist):", err.message)
    })
  } catch (error) {
    console.error("[AUTO-ALERT] Failed to create alert:", error)
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

  // Trigger alert on status change
  if (formData.status && updateData.status) {
    try {
      const { createAlert } = await import("./alerts")
      await createAlert({
        title: `Load Status Changed: ${data.shipment_number}`,
        message: `Load ${data.shipment_number} status changed to ${formData.status}`,
        event_type: "load_status_change",
        priority: formData.status === "delivered" ? "high" : "normal",
        load_id: id,
        metadata: {
          shipment_number: data.shipment_number,
          old_status: data.status,
          new_status: formData.status,
        },
      }).catch((err) => {
        console.warn("[updateLoad] Alert creation failed (table may not exist):", err.message)
      })
    } catch (err: any) {
      console.warn("[updateLoad] Failed to import alerts:", err.message)
    }
  }

  // Auto-schedule check calls if driver was just assigned
  if (formData.driver_id && !data.driver_id) {
    try {
      const { scheduleCheckCallsForLoad } = await import("./check-calls")
      await scheduleCheckCallsForLoad(id)
    } catch (error) {
      console.error("[AUTO-CHECK-CALLS] Failed to schedule check calls:", error)
    }
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

// Bulk operations for workflow optimization
export async function bulkDeleteLoads(ids: string[]) {
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
    .from("loads")
    .delete()
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/loads")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateLoadStatus(ids: string[], status: string) {
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
    .from("loads")
    .update({ status })
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/loads")
  return { data: { updated: ids.length }, error: null }
}

// Duplicate/clone load for workflow optimization
export async function duplicateLoad(id: string) {
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

  // Get the original load
  const { data: originalLoad, error: fetchError } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (fetchError || !originalLoad) {
    return { error: "Load not found", data: null }
  }

  // Generate new shipment number
  const { generateLoadNumber } = await import("./number-formats")
  const numberResult = await generateLoadNumber()
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error || "Failed to generate load number", data: null }
  }

  // Create duplicate with new shipment number and reset status
  // Explicitly set required fields to avoid RLS issues
  // Only include columns that exist in the base schema
  const duplicateData: any = {
    company_id: userData.company_id, // Explicitly set company_id
    shipment_number: numberResult.data,
    origin: originalLoad.origin || "",
    destination: originalLoad.destination || "",
    weight: originalLoad.weight || null,
    weight_kg: originalLoad.weight_kg || null,
    contents: originalLoad.contents || null,
    value: originalLoad.value || null,
    carrier_type: originalLoad.carrier_type || null,
    status: "draft", // Reset to draft
    load_date: null,
    estimated_delivery: null,
    actual_delivery: null,
    driver_id: null,
    truck_id: null,
    route_id: null,
    coordinates: originalLoad.coordinates || null,
  }

  // Conditionally add optional columns only if they exist in originalLoad
  // These columns may not exist in all database schemas
  if (originalLoad.delivery_type !== undefined) {
    duplicateData.delivery_type = originalLoad.delivery_type || "single"
  }
  if (originalLoad.company_name !== undefined) {
    duplicateData.company_name = originalLoad.company_name || null
  }
  if (originalLoad.customer_reference !== undefined) {
    duplicateData.customer_reference = originalLoad.customer_reference || null
  }
  if (originalLoad.requires_split_delivery !== undefined) {
    duplicateData.requires_split_delivery = originalLoad.requires_split_delivery || false
  }
  if (originalLoad.total_delivery_points !== undefined) {
    duplicateData.total_delivery_points = originalLoad.total_delivery_points || null
  }
  if (originalLoad.customer_id !== undefined) {
    duplicateData.customer_id = originalLoad.customer_id || null
  }
  // Only include bol_number if it exists in the original load (column may not exist in schema)
  if (originalLoad.bol_number !== undefined && originalLoad.hasOwnProperty('bol_number')) {
    duplicateData.bol_number = originalLoad.bol_number || null
  }
  // Only include load_type if it exists in the original load (column may not exist in schema)
  if (originalLoad.load_type !== undefined && originalLoad.hasOwnProperty('load_type')) {
    duplicateData.load_type = originalLoad.load_type || null
  }

  const { data: newLoad, error: createError } = await supabase
    .from("loads")
    .insert(duplicateData)
    .select()
    .single()

  if (createError) {
    console.error("[duplicateLoad] Error creating duplicate:", createError)
    return { error: createError.message, data: null }
  }

  // Duplicate delivery points if any
  const { data: deliveryPoints } = await supabase
    .from("load_delivery_points")
    .select("*")
    .eq("load_id", id)
    .eq("company_id", userData.company_id)

  if (deliveryPoints && deliveryPoints.length > 0) {
    const { createLoadDeliveryPoint } = await import("./load-delivery-points")
    for (const point of deliveryPoints) {
      const pointData: any = { ...point }
      delete pointData.id
      delete pointData.load_id
      delete pointData.created_at
      delete pointData.updated_at
      await createLoadDeliveryPoint(newLoad.id, pointData)
    }
  }

  revalidatePath("/dashboard/loads")
  return { data: newLoad, error: null }
}

// Smart suggestions for workflow optimization
export async function getLoadSuggestions(origin?: string, destination?: string) {
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
    lastUsedCustomer: null,
    similarLoads: [],
  }

  // Suggest driver based on route history (if origin/destination provided)
  if (origin && destination) {
    const { data: recentLoads } = await supabase
      .from("loads")
      .select("driver_id, truck_id, customer_id")
      .eq("company_id", userData.company_id)
      .or(`origin.ilike.%${origin}%,destination.ilike.%${destination}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (recentLoads && recentLoads.length > 0) {
      // Find most frequently used driver for this route
      const driverCounts: Record<string, number> = {}
      const truckCounts: Record<string, number> = {}
      recentLoads.forEach((load) => {
        if (load.driver_id) {
          driverCounts[load.driver_id] = (driverCounts[load.driver_id] || 0) + 1
        }
        if (load.truck_id) {
          truckCounts[load.truck_id] = (truckCounts[load.truck_id] || 0) + 1
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

      // Get last used customer
      const lastLoad = recentLoads[0]
      if (lastLoad.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name, company_name")
          .eq("id", lastLoad.customer_id)
          .single()
        if (customer) suggestions.lastUsedCustomer = customer
      }
    }
  }

  // Get similar loads for reference
  const { data: similarLoads } = await supabase
    .from("loads")
    .select("id, shipment_number, origin, destination, contents, value, status")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })
    .limit(5)

  if (similarLoads) {
    suggestions.similarLoads = similarLoads
  }

  return { data: suggestions, error: null }
}

