"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createRoute } from "./routes"
import { sendNotification } from "./notifications"
import { validateLoadData, validatePricingData, sanitizeString, sanitizeEmail, sanitizePhone, validateAddress } from "@/lib/validation"
import { ALL_LOAD_STATUSES, getAllowedNextLoadStatuses, normalizeLoadStatus, parseLoadStatus } from "@/lib/load-status"
import { requireActiveSubscriptionForWrite } from "@/lib/subscription-access"

/** Subset of load fields used for background notifications after updates */
type LoadUpdateNotificationPayload = {
  driver_id?: string | null
  shipment_number?: string | null
  status?: string | null
  origin?: string | null
  destination?: string | null
}

const LOAD_DETAIL_SELECT = `
  id, company_id, shipment_number, origin, destination, status,
  load_date, estimated_delivery, actual_delivery,
  driver_id, truck_id, trailer_id, route_id, customer_id, terminal_id, shipment_id,
  weight, weight_kg, contents, value, carrier_type, coordinates,
  delivery_type, company_name, customer_reference, requires_split_delivery, total_delivery_points,
  load_type, rate, rate_type, fuel_surcharge, accessorial_charges, discount, advance, total_rate,
  estimated_miles, estimated_profit, estimated_revenue,
  shipper_name, shipper_address, shipper_city, shipper_state, shipper_zip,
  shipper_contact_name, shipper_contact_phone, shipper_contact_email,
  consignee_name, consignee_address, consignee_city, consignee_state, consignee_zip,
  consignee_contact_name, consignee_contact_phone, consignee_contact_email,
  pickup_time, pickup_time_window_start, pickup_time_window_end, pickup_instructions,
  delivery_time, delivery_time_window_start, delivery_time_window_end, delivery_instructions,
  pieces, pallets, boxes, piece_count, length, width, height, cube_ft, temperature, is_hazardous, is_oversized,
  nmfc_code, freight_class,
  requires_permit, permit_requirement_reason,
  un_number, hazard_class, packing_group, proper_shipping_name, placard_required, emergency_contact,
  requires_liftgate, requires_inside_delivery, requires_appointment, appointment_time,
  special_instructions, notes, internal_notes, bol_number,
  requested_via_portal, portal_request_status, portal_request_message, requested_equipment_type,
  trip_planning_estimate, created_at, updated_at
`

const LOAD_LIST_SELECT =
  "id, shipment_number, origin, destination, status, driver_id, truck_id, trailer_id, terminal_id, shipment_id, load_date, estimated_delivery, created_at, company_name, value, contents, delivery_type, total_delivery_points, weight, weight_kg, nmfc_code, freight_class, piece_count, cube_ft, requested_via_portal, portal_request_status, portal_request_message, requested_equipment_type"

function driverHasHazmatEndorsement(endorsements: unknown): boolean {
  if (!endorsements) return false
  const normalized = String(endorsements)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return normalized.includes("h") || normalized.includes("hazmat") || normalized.includes("haz mat")
}

function computePermitRequirement(input: {
  weight_kg?: unknown
  weight?: unknown
  length?: unknown
  width?: unknown
  height?: unknown
  is_oversized?: unknown
}): { required: boolean; reason: string | null } {
  const weightKg = Number(input.weight_kg || 0)
  const parsedWeightLbs = Number(String(input.weight || "").replace(/[^0-9.]/g, ""))
  const weightLbs = weightKg > 0 ? weightKg * 2.20462 : 0
  const effectiveWeightLbs = weightLbs > 0 ? weightLbs : parsedWeightLbs
  const lengthFt = Number(input.length || 0)
  const widthFt = Number(input.width || 0)
  const heightFt = Number(input.height || 0)
  const oversized = Boolean(input.is_oversized)

  const reasons: string[] = []
  if (effectiveWeightLbs > 80000) reasons.push(`weight ${effectiveWeightLbs.toFixed(0)} lbs > 80,000 lbs`)
  if (lengthFt > 53) reasons.push(`length ${lengthFt} ft > 53 ft`)
  if (widthFt > 8.5) reasons.push(`width ${widthFt} ft > 8.5 ft`)
  if (heightFt > 13.5) reasons.push(`height ${heightFt} ft > 13.5 ft`)
  if (oversized) reasons.push("load is marked oversized")

  if (reasons.length === 0) return { required: false, reason: null }
  return { required: true, reason: reasons.join("; ") }
}

// Helper function to send notifications in background (non-blocking)
async function sendNotificationsForLoadUpdate(loadData: LoadUpdateNotificationPayload) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return

    // BUG-018 FIX: Filter notifications by relevance - only notify assigned driver, dispatcher, and managers
    // Get assigned driver if load has one
    let assignedDriverId: string | null = null
    if (loadData.driver_id) {
      assignedDriverId = loadData.driver_id
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

    // BUG-018 FIX: Only send notifications to relevant users, not all company users
    if (relevantUsers && relevantUsers.length > 0) {
      await Promise.all(
        relevantUsers.map(async (relevantUser: { id: string; role: string }) => {
          try {
            await sendNotification(relevantUser.id, "load_update", {
              shipmentNumber: loadData.shipment_number,
              status: loadData.status,
              origin: loadData.origin,
              destination: loadData.destination,
            })
          } catch (error) {
            // Silently fail - don't block the main operation
            Sentry.captureException(error)
          }
        })
      )
    }
  } catch (error) {
    // Silently fail - this is a background function, don't block main operations
    Sentry.captureException(error)
  }
}

export async function getLoads(filters?: {
  status?: string
  terminal_id?: string
  search?: string
  sortBy?: "created_at" | "shipment_number" | "load_date" | "status"
  limit?: number
  offset?: number
}) {
  // Check permission
  const permission = await checkViewPermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to view loads", data: null, count: 0 }
  }

  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null, count: 0 }
    }

    const mappedRole = ctx.user ? mapLegacyRole(ctx.user.role) : null
    let assignedDriverId: string | null = null
    if (mappedRole === "driver" && ctx.userId) {
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("user_id", ctx.userId)
        .maybeSingle()
      assignedDriverId = driverRow?.id ? String(driverRow.id) : null
      if (!assignedDriverId) {
        return { data: [], error: null, count: 0 }
      }
    }

    // Build query with pagination
    let query = supabase
      .from("loads")
      .select(LOAD_LIST_SELECT, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (assignedDriverId) {
      query = query.eq("driver_id", assignedDriverId)
    }

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.terminal_id) {
      query = query.eq("terminal_id", filters.terminal_id)
    }

    if (filters?.search) {
      const q = sanitizeString(filters.search).trim()
      if (q.length > 0) {
        query = query.or(
          `shipment_number.ilike.%${q}%,origin.ilike.%${q}%,destination.ilike.%${q}%,contents.ilike.%${q}%`
        )
      }
    }

    if (filters?.sortBy === "shipment_number") {
      query = query.order("shipment_number", { ascending: true })
    } else if (filters?.sortBy === "load_date") {
      query = query.order("load_date", { ascending: false, nullsFirst: false })
    } else if (filters?.sortBy === "status") {
      query = query.order("status", { ascending: true })
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: loads, error, count } = await query

    if (error) {
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        Sentry.captureMessage("[getLoads] Loads table does not exist", "error")
        return { data: [], error: null, count: 0 } // Return empty array instead of error
      }
      Sentry.captureException(error)
      return { error: "Failed to load loads", data: null, count: 0 }
    }

    return { data: loads || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function getLoad(id: string) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: load, error } = await supabase
      .from("loads")
      .select(LOAD_DETAIL_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        Sentry.captureMessage("[getLoad] Loads table does not exist", "error")
        return { error: "Loads table does not exist", data: null }
      }
      Sentry.captureException(error)
      return { error: "Failed to load details", data: null }
    }

    if (!load) {
      return { error: "Load not found", data: null }
    }

    const mappedRole = ctx.user ? mapLegacyRole(ctx.user.role) : null
    if (mappedRole === "driver" && ctx.userId) {
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("user_id", ctx.userId)
        .maybeSingle()
      const driverPk = driverRow?.id ? String(driverRow.id) : null
      const assigned = load.driver_id ? String(load.driver_id) : null
      if (!driverPk || !assigned || assigned !== driverPk) {
        return { error: "Load not found", data: null }
      }
    }

    return { data: load, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
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
  trailer_id?: string
  terminal_id?: string | null
  shipment_id?: string | null
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
  piece_count?: number
  pallets?: number
  boxes?: number
  length?: number
  width?: number
  height?: number
  cube_ft?: number
  nmfc_code?: string
  freight_class?: string
  temperature?: number
  is_hazardous?: boolean
  un_number?: string
  hazard_class?: string
  packing_group?: string
  proper_shipping_name?: string
  placard_required?: boolean
  emergency_contact?: string
  is_oversized?: boolean
  special_instructions?: string
  requested_via_portal?: boolean
  portal_request_status?: "pending" | "accepted" | "rejected" | null
  portal_request_message?: string | null
  requested_equipment_type?: string | null
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
  // Marketplace fields
  source?: string
  marketplace_load_id?: string
  // Address Book Integration
  shipper_address_book_id?: string
  consignee_address_book_id?: string
}) {
  // Check permission
  const permission = await checkCreatePermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create loads", data: null }
  }

  const subscriptionAccess = await requireActiveSubscriptionForWrite()
  if (!subscriptionAccess.allowed) {
    return { error: subscriptionAccess.error || "Subscription inactive", data: null }
  }

  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .select("id, status, company_id, license_endorsements")
      .eq("id", formData.driver_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (driverError || !driver) {
      return { error: "Invalid driver selected", data: null }
    }

    if (driver.status !== "active") {
      return { error: "Cannot assign inactive driver to load", data: null }
    }

    if (formData.is_hazardous && !driverHasHazmatEndorsement(driver.license_endorsements)) {
      return { error: "Assigned driver does not have required HAZMAT endorsement (H)", data: null }
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

    if (truck.status !== "available" && truck.status !== "in_use") {
      return { error: "Cannot assign truck with status: " + truck.status, data: null }
    }
  }

  // Validate trailer assignment if provided
  if (formData.trailer_id) {
    const { data: trailer, error: trailerError } = await supabase
      .from("trailers")
      .select("id, status, company_id")
      .eq("id", formData.trailer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (trailerError || !trailer) {
      return { error: "Invalid trailer selected", data: null }
    }

    if (trailer.status !== "available" && trailer.status !== "in_use") {
      return { error: "Cannot assign trailer with status: " + trailer.status, data: null }
    }
  }

  // Validate customer if provided
  if (formData.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, company_id")
      .eq("id", formData.customer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

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

    // DAT-006 FIX: TOCTOU race condition - non-atomic check-then-insert
    // Two dispatchers can create loads with the same shipment number simultaneously
    // The proper fix is a unique constraint at DB level: (company_id, shipment_number)
    // For now, we'll rely on the DB constraint and handle the error gracefully
    // Note: This check reduces but doesn't eliminate the race condition
    const { data: existingLoad } = await supabase
      .from("loads")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("shipment_number", shipmentNumber)
      .maybeSingle()

    if (existingLoad) {
      return { error: "Shipment number already exists", data: null }
    }
    // DAT-006: The actual protection comes from the unique constraint in the database
    // If two requests pass this check simultaneously, the DB will reject the second insert
    // with error code 23505 (unique violation), which should be handled in the insert below
  }

  let routeId = formData.route_id || null

  // If no route is assigned, automatically create one if setting is enabled (skip for multi-delivery with "Multiple Locations")
  if (!routeId && settings.auto_create_route && formData.origin && formData.destination && formData.destination !== "Multiple Locations") {
    // Check if a matching route already exists
    const normalizeLocation = (location: string) => {
      if (!location) return ""
      return location.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim()
    }

    // LOG-002 FIX: Push matching into DB query instead of fetching ALL routes
    // This reduces 500 routes loaded into memory to a single indexed query
    const loadOriginNormalized = normalizeLocation(formData.origin)
    const loadDestNormalized = normalizeLocation(formData.destination)
    const originFirstWord = loadOriginNormalized.split(" ")[0]
    const destFirstWord = loadDestNormalized.split(" ")[0]

    // Query with LIKE filters at DB level - much more efficient
    // BUG-035 FIX: Sanitize search strings to prevent PostgREST filter injection
    const sanitizeForOr = (str: string) => str.replace(/[,()]/g, '').replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj|not)/gi, '').replace(/%/g, '').trim().substring(0, 200)
    const safeOrigin = sanitizeForOr(loadOriginNormalized)
    const safeOriginFirst = sanitizeForOr(originFirstWord)
    const safeDest = sanitizeForOr(loadDestNormalized)
    const safeDestFirst = sanitizeForOr(destFirstWord)
    
    const { data: existingRoutes } = await supabase
      .from("routes")
      .select("id, origin, destination")
      .eq("company_id", ctx.companyId)
      .or(`origin.ilike.%${safeOrigin}%,origin.ilike.%${safeOriginFirst}%,destination.ilike.%${safeDest}%,destination.ilike.%${safeDestFirst}%`)
      .limit(10) // Limit results for performance

    if (existingRoutes && existingRoutes.length > 0) {
      // Fine-tune match in JavaScript (only on limited results)
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
        
        // DAT-008 FIX: Don't store placeholder UI text in database - use undefined instead
        // UI can display "Calculating..." when these fields are undefined
        // If you want to calculate immediately, await Google Maps API call here before inserting
        const estimatedDistance: string | undefined = undefined // Will be calculated later or shown as "Calculating..." in UI
        const estimatedTime: string | undefined = undefined // Will be calculated later or shown as "Calculating..." in UI

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
  if (formData.is_hazardous) {
    if (!formData.un_number || !formData.hazard_class || !formData.proper_shipping_name) {
      return { error: "HAZMAT loads require UN number, hazard class, and proper shipping name", data: null }
    }
  }
  
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
  const finalTrailerId = formData.trailer_id
  
  if ((settings.auto_assign_driver || settings.auto_assign_truck) && formData.origin && formData.destination) {
    try {
      // Get suggestions directly (avoid circular import by calling the logic inline)
      // BUG-035 FIX: Sanitize search strings to prevent PostgREST filter injection
      const sanitizeForOr = (str: string) => (str || '').replace(/[,()]/g, '').replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj|not)/gi, '').replace(/%/g, '').trim().substring(0, 200)
      const safeOrigin = sanitizeForOr(formData.origin || '')
      const safeDest = sanitizeForOr(formData.destination || '')
      
      const { data: recentLoads } = await supabase
        .from("loads")
        .select("driver_id, truck_id, customer_id")
        .eq("company_id", ctx.companyId)
        .or(`origin.ilike.%${safeOrigin}%,destination.ilike.%${safeDest}%`)
        .order("created_at", { ascending: false })
        .limit(5)

      if (recentLoads && recentLoads.length > 0) {
        // Find most frequently used driver for this route
        const driverCounts: Record<string, number> = {}
        const truckCounts: Record<string, number> = {}
        recentLoads.forEach((load: { driver_id: string | null; truck_id: string | null; [key: string]: any }) => {
          if (load.driver_id) {
            driverCounts[load.driver_id] = (driverCounts[load.driver_id] || 0) + 1
          }
          if (load.truck_id) {
            truckCounts[load.truck_id] = (truckCounts[load.truck_id] || 0) + 1
          }
        })

        const topDriverId = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        const topTruckId = Object.entries(truckCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

        if (settings.auto_assign_driver && !finalDriverId && topDriverId) {
          // LOG-004 FIX: Check if driver is already on an active load before assigning
          const { data: activeDriverLoads } = await supabase
            .from("loads")
            .select("id, shipment_number")
            .eq("driver_id", topDriverId)
            .in("status", ["scheduled", "in_transit"])
            .eq("company_id", ctx.companyId)
            .limit(1)

          // Only assign if driver is not already on an active load
          if (!activeDriverLoads || activeDriverLoads.length === 0) {
            // V3-002 FIX: Add company_id filter to prevent cross-tenant data access
            const { data: driver } = await supabase
              .from("drivers")
              .select("id, name, status")
              .eq("id", topDriverId)
              .eq("company_id", ctx.companyId)
              .eq("status", "active")
              .maybeSingle()
            if (driver) finalDriverId = driver.id
          }
        }

        if (settings.auto_assign_truck && !finalTruckId && topTruckId) {
          // V3-002 FIX: Add company_id filter to prevent cross-tenant data access
          const { data: truck } = await supabase
            .from("trucks")
            .select("id, truck_number, status")
            .eq("id", topTruckId)
            .eq("company_id", ctx.companyId)
            .in("status", ["available", "in_use"])
            .maybeSingle()
          if (truck) finalTruckId = truck.id
        }
      }
    } catch (err) {
      Sentry.captureException(err)
    }
  }

  // Build insert data with professional sanitization
  const loadData: any = {
    company_id: ctx.companyId,
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
  if (finalDriverId) {
    if (formData.is_hazardous) {
      const { data: hazmatDriver } = await supabase
        .from("drivers")
        .select("id, license_endorsements")
        .eq("id", finalDriverId)
        .eq("company_id", ctx.companyId)
        .maybeSingle()
      if (!hazmatDriver || !driverHasHazmatEndorsement(hazmatDriver.license_endorsements)) {
        return { error: "Assigned driver does not have required HAZMAT endorsement (H)", data: null }
      }
    }
    loadData.driver_id = finalDriverId
  }
  if (finalTruckId) loadData.truck_id = finalTruckId
  if (finalTrailerId) loadData.trailer_id = finalTrailerId

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
  if (formData.trailer_id) loadData.trailer_id = formData.trailer_id
  if (formData.terminal_id) loadData.terminal_id = formData.terminal_id
  if (formData.shipment_id) loadData.shipment_id = formData.shipment_id
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
  if (formData.piece_count !== undefined && formData.piece_count !== null) loadData.piece_count = formData.piece_count
  else if (formData.pieces !== undefined && formData.pieces !== null) loadData.piece_count = formData.pieces
  if (formData.pallets !== undefined && formData.pallets !== null) loadData.pallets = formData.pallets
  if (formData.boxes !== undefined && formData.boxes !== null) loadData.boxes = formData.boxes
  if (formData.length !== undefined && formData.length !== null) loadData.length = formData.length
  if (formData.width !== undefined && formData.width !== null) loadData.width = formData.width
  if (formData.height !== undefined && formData.height !== null) loadData.height = formData.height
  if (formData.cube_ft !== undefined && formData.cube_ft !== null) loadData.cube_ft = formData.cube_ft
  if (formData.nmfc_code) loadData.nmfc_code = sanitizeString(formData.nmfc_code, 30)
  if (formData.freight_class) loadData.freight_class = sanitizeString(formData.freight_class, 20)
  // Temperature: DB is numeric; accept range strings like "35-40" and store first number to avoid "invalid input syntax for type numeric"
  if (formData.temperature !== undefined && formData.temperature !== null) {
    const t = formData.temperature
    const str = String(t).trim()
    if (str !== "") {
      const num = typeof t === "number" ? t : parseFloat(str.replace(/^(\d+(?:\.\d+)?).*/, "$1"))
      loadData.temperature = !isNaN(num) ? num : undefined
    }
  }
  if (formData.is_hazardous !== undefined) loadData.is_hazardous = formData.is_hazardous
  if (formData.un_number) loadData.un_number = sanitizeString(formData.un_number, 20)
  if (formData.hazard_class) loadData.hazard_class = sanitizeString(formData.hazard_class, 20)
  if (formData.packing_group) loadData.packing_group = sanitizeString(formData.packing_group, 20)
  if (formData.proper_shipping_name) loadData.proper_shipping_name = sanitizeString(formData.proper_shipping_name, 200)
  if (formData.placard_required !== undefined) loadData.placard_required = formData.placard_required
  if (formData.emergency_contact) loadData.emergency_contact = sanitizeString(formData.emergency_contact, 120)
  if (formData.is_oversized !== undefined) loadData.is_oversized = formData.is_oversized
  if (formData.special_instructions) loadData.special_instructions = formData.special_instructions
  if (formData.requested_via_portal !== undefined) loadData.requested_via_portal = formData.requested_via_portal
  if (formData.portal_request_status !== undefined) loadData.portal_request_status = formData.portal_request_status
  if (formData.portal_request_message !== undefined) loadData.portal_request_message = formData.portal_request_message
  if (formData.requested_equipment_type !== undefined) loadData.requested_equipment_type = formData.requested_equipment_type
  
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
  // Note: estimated_profit and estimated_revenue are optional fields
  // If you get column errors, run: supabase/add_loads_pricing_columns.sql
  // These fields are calculated and don't need to be stored in the database
  // if (formData.estimated_profit !== undefined && formData.estimated_profit !== null) loadData.estimated_profit = formData.estimated_profit
  // if (formData.estimated_revenue !== undefined && formData.estimated_revenue !== null) loadData.estimated_revenue = formData.estimated_revenue
  
  // Notes with sanitization
  if (formData.notes) loadData.notes = sanitizeString(formData.notes, 2000)
  if (formData.internal_notes) loadData.internal_notes = sanitizeString(formData.internal_notes, 2000)
  if (formData.special_instructions) loadData.special_instructions = sanitizeString(formData.special_instructions, 1000)
  if (formData.pickup_instructions) loadData.pickup_instructions = sanitizeString(formData.pickup_instructions, 1000)
  if (formData.delivery_instructions) loadData.delivery_instructions = sanitizeString(formData.delivery_instructions, 1000)

  // Marketplace fields
  if (formData.source) loadData.source = formData.source
  if (formData.marketplace_load_id) loadData.marketplace_load_id = formData.marketplace_load_id

  const permitRequirement = computePermitRequirement({
    weight_kg: loadData.weight_kg ?? formData.weight_kg,
    weight: loadData.weight ?? formData.weight,
    length: loadData.length ?? formData.length,
    width: loadData.width ?? formData.width,
    height: loadData.height ?? formData.height,
    is_oversized: loadData.is_oversized ?? formData.is_oversized,
  })
  loadData.requires_permit = permitRequirement.required
  loadData.permit_requirement_reason = permitRequirement.reason

  // Address Book Integration
  if (formData.shipper_address_book_id) loadData.shipper_address_book_id = formData.shipper_address_book_id
  if (formData.consignee_address_book_id) loadData.consignee_address_book_id = formData.consignee_address_book_id

  // SECURITY: Generate public tracking token for secure public tracking
  // This prevents enumeration attacks by requiring a unique token per load
  const crypto = await import("crypto")
  const trackingToken = crypto.randomBytes(32).toString("hex")
  loadData.public_tracking_token = trackingToken

  const { data, error } = await supabase
    .from("loads")
    .insert(loadData)
    .select()
    .single()

  if (error || !data) {
    return { error: error?.message || "Failed to create load", data: null }
  }

  // DAT-001 FIX: Update truck status to "in_use" when load is created with truck_id
  if (data.truck_id) {
    try {
      await supabase
        .from("trucks")
        .update({ status: "in_use" })
        .eq("id", data.truck_id)
        .eq("company_id", ctx.companyId)
    } catch (truckUpdateError) {
      Sentry.captureException(truckUpdateError)
      // Don't fail load creation if truck status update fails
    }
  }

  // Auto-schedule check calls if load has driver
  if (data.driver_id) {
    try {
      const { scheduleCheckCallsForLoad } = await import("./check-calls")
      await scheduleCheckCallsForLoad(data.id).catch((err) => {
        Sentry.captureException(err)
      })
    } catch (err: unknown) {
      Sentry.captureException(err)
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
        Sentry.captureException(err)
    })
  } catch (error) {
    Sentry.captureException(error)
  }

  revalidatePath("/dashboard/loads")
  revalidatePath("/dashboard/routes")
  
  // Trigger webhook
  try {
    const { triggerWebhook } = await import("./webhooks")
    await triggerWebhook(ctx.companyId, "load.created", {
      load_id: data.id,
      shipment_number: shipmentNumber,
      status: data.status,
      origin: formData.origin,
      destination: formData.destination,
    })
  } catch (error) {
    Sentry.captureException(error)
  }

  // Auto-match load to trucks using DFM
  try {
    const { autoMatchLoadToTrucks } = await import("./dfm-matching")
    await autoMatchLoadToTrucks(data.id).catch((err) =>
      Sentry.captureException(err)
    )
  } catch (error) {
    // Don't fail load creation if DFM fails
    Sentry.captureException(error)
  }
  
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
    trailer_id?: string
    shipment_id?: string
    route_id?: string | null
    load_date?: string | null
    estimated_delivery?: string | null
    actual_delivery?: string | null
    delivery_type?: string
    company_name?: string
    customer_reference?: string
    requires_split_delivery?: boolean
    total_delivery_points?: number
    requires_permit?: boolean
    permit_requirement_reason?: string | null
    [key: string]: any
  }
) {
  // Check permission
  const permission = await checkEditPermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit loads", data: null }
  }

  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get current load data for audit trail and status check (with company_id verification)
  const { data: currentLoad, error: currentLoadError } = await supabase
    .from("loads")
    .select(LOAD_DETAIL_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (currentLoadError || !currentLoad) {
    return { error: "Load not found", data: null }
  }

  const wasDelivered = currentLoad?.status === "delivered"
  const willBeDelivered = formData.status === "delivered"
  const wasConfirmed = currentLoad?.status === "confirmed"
  const willBeConfirmed = formData.status === "confirmed"

  // DAT-002 FIX: Validate status transitions to prevent invalid state changes
  // Define allowed transitions - delivered loads cannot revert to pending
  if (formData.status && formData.status !== currentLoad.status) {
    const currentStatus = normalizeLoadStatus(currentLoad.status)
    const nextStatus = parseLoadStatus(formData.status)
    if (!nextStatus) {
      return {
        error: `Invalid status "${formData.status}". Must be one of: ${ALL_LOAD_STATUSES.join(", ")}`,
        data: null,
      }
    }
    const allowedNextStatuses = getAllowedNextLoadStatuses(currentStatus)
    
    if (!allowedNextStatuses.includes(nextStatus)) {
      return { 
        error: `Invalid status transition: Cannot change load status from "${currentStatus}" to "${nextStatus}". Allowed transitions: ${allowedNextStatuses.join(", ") || "none"}`,
        data: null 
      }
    }
  }

  // Build update data and track changes for audit trail
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  // Helper function to check and update field
  const updateField = (field: string, newValue: any, oldValue: any = null) => {
    const currentValue = oldValue !== null ? oldValue : (currentLoad[field] ?? null)
    if (newValue !== undefined && newValue !== currentValue) {
      updateData[field] = newValue === "" ? null : newValue
      changes.push({ field, old_value: currentValue, new_value: newValue })
    }
  }
  
  // Basic fields
  updateField("shipment_number", formData.shipment_number)
  updateField("origin", formData.origin)
  updateField("destination", formData.destination)
  updateField("weight", formData.weight)
  updateField("weight_kg", formData.weight_kg ?? null)
  updateField("contents", formData.contents)
  updateField("value", formData.value || null)
  updateField("carrier_type", formData.carrier_type)
  updateField("status", formData.status)
  updateField("driver_id", formData.driver_id || null)
  updateField("truck_id", formData.truck_id || null)
  updateField("trailer_id", formData.trailer_id || null)
  updateField("shipment_id", formData.shipment_id || null)
  updateField("route_id", formData.route_id || null)
  updateField("load_date", formData.load_date || null)
  updateField("estimated_delivery", formData.estimated_delivery || null)
  updateField("actual_delivery", formData.actual_delivery || null)
  updateField("delivery_type", formData.delivery_type)
  updateField("company_name", formData.company_name || null)
  updateField("customer_reference", formData.customer_reference || null)
  updateField("requires_split_delivery", formData.requires_split_delivery)
  updateField("total_delivery_points", formData.total_delivery_points)
  
  // Extended fields - Load details
  updateField("load_type", formData.load_type)
  updateField("customer_id", formData.customer_id || null)
  updateField("bol_number", formData.bol_number)
  
  // Shipper fields
  updateField("shipper_name", formData.shipper_name)
  updateField("shipper_address", formData.shipper_address)
  updateField("shipper_city", formData.shipper_city)
  updateField("shipper_state", formData.shipper_state)
  updateField("shipper_zip", formData.shipper_zip)
  updateField("shipper_contact_name", formData.shipper_contact_name)
  updateField("shipper_contact_phone", formData.shipper_contact_phone)
  updateField("shipper_contact_email", formData.shipper_contact_email)
  updateField("pickup_time", formData.pickup_time)
  updateField("pickup_time_window_start", formData.pickup_time_window_start)
  updateField("pickup_time_window_end", formData.pickup_time_window_end)
  updateField("pickup_instructions", formData.pickup_instructions)
  
  // Consignee fields
  updateField("consignee_name", formData.consignee_name)
  updateField("consignee_address", formData.consignee_address)
  updateField("consignee_city", formData.consignee_city)
  updateField("consignee_state", formData.consignee_state)
  updateField("consignee_zip", formData.consignee_zip)
  updateField("consignee_contact_name", formData.consignee_contact_name)
  updateField("consignee_contact_phone", formData.consignee_contact_phone)
  updateField("consignee_contact_email", formData.consignee_contact_email)
  updateField("delivery_time", formData.delivery_time)
  updateField("delivery_time_window_start", formData.delivery_time_window_start)
  updateField("delivery_time_window_end", formData.delivery_time_window_end)
  updateField("delivery_instructions", formData.delivery_instructions)
  
  // Enhanced freight details
  updateField("pieces", formData.pieces ?? null)
  updateField("piece_count", formData.piece_count ?? (formData.pieces ?? null))
  updateField("pallets", formData.pallets ?? null)
  updateField("boxes", formData.boxes || null)
  updateField("length", formData.length || null)
  updateField("width", formData.width || null)
  updateField("height", formData.height || null)
  updateField("cube_ft", formData.cube_ft ?? null)
  updateField("nmfc_code", formData.nmfc_code ?? null)
  updateField("freight_class", formData.freight_class ?? null)
  // Coerce temperature range strings (e.g. "35-40") to first number for numeric column
  ;(() => {
    const t = formData.temperature
    if (t === undefined || t === null || (typeof t === "string" && t.trim() === "")) {
      updateField("temperature", null)
      return
    }
    const num = typeof t === "number" ? t : parseFloat(String(t).trim().replace(/^(\d+(?:\.\d+)?).*/, "$1"))
    updateField("temperature", !isNaN(num) ? num : null)
  })()
  updateField("is_hazardous", formData.is_hazardous)
  updateField("un_number", formData.un_number)
  updateField("hazard_class", formData.hazard_class)
  updateField("packing_group", formData.packing_group)
  updateField("proper_shipping_name", formData.proper_shipping_name)
  updateField("placard_required", formData.placard_required)
  updateField("emergency_contact", formData.emergency_contact)
  updateField("is_oversized", formData.is_oversized)
  updateField("requires_permit", formData.requires_permit)
  updateField("permit_requirement_reason", formData.permit_requirement_reason)
  updateField("special_instructions", formData.special_instructions)
  updateField("requested_via_portal", formData.requested_via_portal)
  updateField("portal_request_status", formData.portal_request_status)
  updateField("portal_request_message", formData.portal_request_message)
  updateField("requested_equipment_type", formData.requested_equipment_type)
  
  // Special requirements
  updateField("requires_liftgate", formData.requires_liftgate)
  updateField("requires_inside_delivery", formData.requires_inside_delivery)
  updateField("requires_appointment", formData.requires_appointment)
  updateField("appointment_time", formData.appointment_time)
  
  // Pricing
  updateField("rate", formData.rate ?? null)
  updateField("rate_type", formData.rate_type)
  updateField("fuel_surcharge", formData.fuel_surcharge ?? null)
  updateField("accessorial_charges", formData.accessorial_charges || null)
  updateField("discount", formData.discount || null)
  updateField("advance", formData.advance || null)
  updateField("total_rate", formData.total_rate || null)
  updateField("estimated_miles", formData.estimated_miles || null)
  
  // Notes
  updateField("notes", formData.notes)
  updateField("internal_notes", formData.internal_notes)
  
  // Marketplace fields
  updateField("source", formData.source)
  updateField("marketplace_load_id", formData.marketplace_load_id)
  
  // Address Book Integration
  updateField("shipper_address_book_id", formData.shipper_address_book_id || null)
  updateField("consignee_address_book_id", formData.consignee_address_book_id || null)
  
  // Sanitize string fields
  if (updateData.contents) updateData.contents = sanitizeString(updateData.contents, 500)
  if (updateData.shipper_contact_email) updateData.shipper_contact_email = sanitizeEmail(updateData.shipper_contact_email)
  if (updateData.shipper_contact_phone) updateData.shipper_contact_phone = sanitizePhone(updateData.shipper_contact_phone)
  if (updateData.consignee_contact_email) updateData.consignee_contact_email = sanitizeEmail(updateData.consignee_contact_email)
  if (updateData.consignee_contact_phone) updateData.consignee_contact_phone = sanitizePhone(updateData.consignee_contact_phone)
  if (updateData.notes) updateData.notes = sanitizeString(updateData.notes, 2000)
  if (updateData.internal_notes) updateData.internal_notes = sanitizeString(updateData.internal_notes, 2000)
  if (updateData.special_instructions) updateData.special_instructions = sanitizeString(updateData.special_instructions, 1000)
  if (updateData.pickup_instructions) updateData.pickup_instructions = sanitizeString(updateData.pickup_instructions, 1000)
  if (updateData.delivery_instructions) updateData.delivery_instructions = sanitizeString(updateData.delivery_instructions, 1000)
  if (updateData.nmfc_code) updateData.nmfc_code = sanitizeString(updateData.nmfc_code, 30)
  if (updateData.freight_class) updateData.freight_class = sanitizeString(updateData.freight_class, 20)
  if (updateData.permit_requirement_reason) {
    updateData.permit_requirement_reason = sanitizeString(updateData.permit_requirement_reason, 500)
  }
  if (updateData.un_number) updateData.un_number = sanitizeString(updateData.un_number, 20)
  if (updateData.hazard_class) updateData.hazard_class = sanitizeString(updateData.hazard_class, 20)
  if (updateData.packing_group) updateData.packing_group = sanitizeString(updateData.packing_group, 20)
  if (updateData.proper_shipping_name) updateData.proper_shipping_name = sanitizeString(updateData.proper_shipping_name, 200)
  if (updateData.emergency_contact) updateData.emergency_contact = sanitizeString(updateData.emergency_contact, 120)
  if (updateData.portal_request_message) updateData.portal_request_message = sanitizeString(updateData.portal_request_message, 1000)
  if (updateData.requested_equipment_type) updateData.requested_equipment_type = sanitizeString(updateData.requested_equipment_type, 60)

  const nextHazardous =
    typeof updateData.is_hazardous === "boolean" ? updateData.is_hazardous : Boolean(currentLoad.is_hazardous)
  const nextDriverId = updateData.driver_id !== undefined ? updateData.driver_id : currentLoad.driver_id
  if (nextHazardous) {
    const unNumber = updateData.un_number ?? currentLoad.un_number
    const hazardClass = updateData.hazard_class ?? currentLoad.hazard_class
    const properName = updateData.proper_shipping_name ?? currentLoad.proper_shipping_name
    if (!unNumber || !hazardClass || !properName) {
      return { error: "HAZMAT loads require UN number, hazard class, and proper shipping name", data: null }
    }
    if (nextDriverId) {
      const { data: hazmatDriver } = await supabase
        .from("drivers")
        .select("id, license_endorsements")
        .eq("id", nextDriverId)
        .eq("company_id", ctx.companyId)
        .maybeSingle()
      if (!hazmatDriver || !driverHasHazmatEndorsement(hazmatDriver.license_endorsements)) {
        return { error: "Assigned driver does not have required HAZMAT endorsement (H)", data: null }
      }
    }
  }

  const computedPermit = computePermitRequirement({
    weight_kg: updateData.weight_kg ?? currentLoad.weight_kg,
    weight: updateData.weight ?? currentLoad.weight,
    length: updateData.length ?? currentLoad.length,
    width: updateData.width ?? currentLoad.width,
    height: updateData.height ?? currentLoad.height,
    is_oversized: updateData.is_oversized ?? currentLoad.is_oversized,
  })
  updateData.requires_permit = computedPermit.required
  updateData.permit_requirement_reason = computedPermit.reason

  const nextStatus = String(updateData.status ?? currentLoad.status ?? "").toLowerCase()
  if (computedPermit.required && ["scheduled", "in_transit"].includes(nextStatus)) {
    const today = new Date().toISOString().split("T")[0]
    const { data: permits } = await supabase
      .from("permits")
      .select("id, expiry_date, document_id")
      .eq("company_id", ctx.companyId)
      .eq("load_id", id)
    const validPermit = (permits || []).some((permit: any) => {
      const notExpired = !permit.expiry_date || permit.expiry_date >= today
      return Boolean(permit.document_id) && notExpired
    })
    if (!validPermit) {
      return { error: "Permit attachment is required before dispatching this load.", data: null }
    }
  }

  // If no changes, return early
  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentLoad is JSON-serializable
    const serializableCurrentLoad = currentLoad ? JSON.parse(JSON.stringify(currentLoad, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentLoad, error: null }
  }

  const { data, error } = await supabase
    .from("loads")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error || !data) {
    if (error) Sentry.captureException(error)
    return { error: "Failed to update load", data: null }
  }

  // Auto-generate invoice when load status changes to "delivered"
  if (data && !wasDelivered && willBeDelivered) {
    // Check if invoice already exists for this load
    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", id)
      .maybeSingle()

    if (existingInvoiceError) {
      Sentry.captureException(existingInvoiceError)
      return { error: "Failed to validate existing invoice", data: null }
    }

    if (!existingInvoice && data.value) {
      // Auto-generate invoice
      const invoiceNumber = `INV-${data.shipment_number}-${Date.now()}`
      const issueDate = new Date().toISOString().split("T")[0]
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30) // Net 30 default

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: ctx.companyId,
          invoice_number: invoiceNumber,
          customer_name: data.company_name || "Customer",
          load_id: id,
          amount: Number(data.total_rate || data.rate) || 0,
          status: "pending",
          issue_date: issueDate,
          due_date: dueDate.toISOString().split("T")[0],
          payment_terms: "Net 30",
          description: `Invoice for load ${data.shipment_number} - ${data.origin} to ${data.destination}`,
        })
        .select()
        .single()

      if (invoiceError) {
        Sentry.captureException(invoiceError)
        // Don't fail the load update if invoice creation fails
      } else if (newInvoice) {
        Sentry.captureMessage(`[AUTO-INVOICE] Invoice ${invoiceNumber} created automatically for load ${data.shipment_number}`, "info")
        
        // Auto-add detention fees to invoice if any exist
        try {
          const { autoAddDetentionsToInvoice } = await import("./detention-tracking")
          await autoAddDetentionsToInvoice(id)
        } catch (error) {
          Sentry.captureException(error)
        }
        
        // Auto-send invoice email if enabled in settings
        try {
          const { data: settings, error: settingsError } = await supabase
            .from("company_settings")
            .select("auto_send_invoice_email, invoice_email_subject, invoice_email_body")
            .eq("company_id", ctx.companyId)
            .maybeSingle()

          if (settingsError) {
            throw settingsError
          }

          if (settings?.auto_send_invoice_email) {
            const { sendInvoiceEmail } = await import("./invoice-email")
            await sendInvoiceEmail(newInvoice.id, {
              subject: settings.invoice_email_subject || "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}",
              body: settings.invoice_email_body || "",
            }).catch((emailError) => {
              Sentry.captureException(emailError)
            })
          }
        } catch (emailError) {
          Sentry.captureException(emailError)
        }

        try {
          const { maybeAutoSubmitFactoringOnInvoiceCreated } = await import("./factoring-email")
          await maybeAutoSubmitFactoringOnInvoiceCreated(newInvoice.id).catch((err) =>
            Sentry.captureException(err),
          )
        } catch (e) {
          Sentry.captureException(e)
        }

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

  // Auto-generate rate confirmation when load status changes to confirmed
  if (data && !wasConfirmed && willBeConfirmed) {
    try {
      const { generateRateConfirmation } = await import("./rate-confirmation")
      const rateConfResult = await generateRateConfirmation(id)
      if (rateConfResult.error) {
        Sentry.captureMessage(`[RATE-CONFIRMATION] ${rateConfResult.error}`, "warning")
      }
    } catch (rateConfError) {
      Sentry.captureException(rateConfError)
    }
  }

  // Send notifications only for meaningful updates (status/origin/destination), not every edit.
  // This prevents duplicate/noisy "status pending" notifications when only assignment fields changed.
  const shouldNotifyLoadUpdate =
    !!updateData.status || !!updateData.origin || !!updateData.destination
  if (data && shouldNotifyLoadUpdate) {
    const notificationPayload: LoadUpdateNotificationPayload = {
      driver_id: data.driver_id,
      shipment_number: data.shipment_number,
      status: updateData.status ?? undefined,
      origin: updateData.origin ?? undefined,
      destination: updateData.destination ?? undefined,
    }
    // Don't await - send notifications in background
    sendNotificationsForLoadUpdate(notificationPayload).catch((error) => {
      Sentry.captureException(error)
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
        Sentry.captureException(err)
      })
    } catch (err: unknown) {
      Sentry.captureException(err)
    }
  }

  // Auto-schedule check calls if driver was just assigned
  if (formData.driver_id && !currentLoad.driver_id) {
    try {
      const { scheduleCheckCallsForLoad } = await import("./check-calls")
      await scheduleCheckCallsForLoad(id)
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  // Create audit log entries for each change
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (ctx.userId) {
        // Log each field change separately for better audit trail
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "load",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            Sentry.captureMessage(`[updateLoad] Audit log created for field: ${change.field}`, "info")
          } catch (err: unknown) {
            // Log error but don't fail the update
            Sentry.captureException(err)
            Sentry.captureMessage(
              `[updateLoad] Audit log error code: ${String(err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : "unknown")}`,
              "error"
            )
          }
        }
      } else {
        Sentry.captureMessage("[updateLoad] No user found for audit logging", "warning")
      }
    } catch (err: unknown) {
      Sentry.captureException(err)
    }
  }

  revalidatePath("/dashboard/loads")
  revalidatePath(`/dashboard/loads/${id}`)
  revalidatePath("/dashboard/accounting/invoices")

  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint') return value.toString()
    return value
  })) : null

  return { data: serializableData, error: null }
}

export async function deleteLoad(id: string) {
  // Check permission
  const permission = await checkDeletePermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete loads" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // DAT-003 FIX: Prevent deletion of active in-transit loads
  // Fetch load status before delete to prevent destroying audit trail of live shipments
  const { data: loadToDelete, error: loadError } = await supabase
    .from("loads")
    .select("status, shipment_number")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (loadError) {
    Sentry.captureException(loadError)
    return { error: "Failed to fetch load details" }
  }

  if (!loadToDelete) {
    return { error: "Load not found" }
  }

  // DAT-003: Block deletion of in-transit loads - they must be cancelled first
  if (loadToDelete.status === "in_transit") {
    return { 
      error: `Cannot delete a load that is in transit. Please cancel the load first if needed. Load: ${loadToDelete.shipment_number}` 
    }
  }

  // Only allow deleting pending, scheduled, or cancelled loads
  const allowedStatusesForDeletion = ["pending", "scheduled", "cancelled"]
  if (!allowedStatusesForDeletion.includes(loadToDelete.status)) {
    return { 
      error: `Cannot delete a load with status "${loadToDelete.status}". Only pending, scheduled, or cancelled loads can be deleted.` 
    }
  }

  const { error } = await supabase
    .from("loads")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to delete load" }
  }

  revalidatePath("/dashboard/loads")
  return { error: null }
}

// Bulk operations for workflow optimization
export async function bulkDeleteLoads(ids: string[]) {
  const permission = await checkDeletePermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete loads", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // DAT-004 FIX: Check for active in-transit loads before bulk delete
  // Prevent deleting loads that are currently in transit
  const { data: loadsToDelete } = await supabase
    .from("loads")
    .select("id, shipment_number, status")
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (loadsToDelete) {
    const inTransitLoads = loadsToDelete.filter((l: { id: string; shipment_number: string; status: string; [key: string]: any }) => l.status === "in_transit")
    if (inTransitLoads.length > 0) {
      const shipmentNumbers = inTransitLoads.map((l: { id: string; shipment_number: string; status: string; [key: string]: any }) => l.shipment_number).join(", ")
      return { 
        error: `Cannot delete loads that are in transit: ${shipmentNumbers}. Please cancel them first if needed.`,
        data: null 
      }
    }

    // Only allow deleting pending, scheduled, or cancelled loads
    const allowedStatuses = ["pending", "scheduled", "cancelled"]
    const blockedLoads = loadsToDelete.filter((l: { id: string; shipment_number: string; status: string; [key: string]: any }) => !allowedStatuses.includes(l.status))
    if (blockedLoads.length > 0) {
      const shipmentNumbers = blockedLoads.map((l: { id: string; shipment_number: string; status: string; [key: string]: any }) => l.shipment_number).join(", ")
      return { 
        error: `Cannot delete loads with status other than pending, scheduled, or cancelled: ${shipmentNumbers}`,
        data: null 
      }
    }
  }

  const { error } = await supabase
    .from("loads")
    .delete()
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to delete loads", data: null }
  }

  revalidatePath("/dashboard/loads")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateLoadStatus(ids: string[], status: string) {
  // Check permission
  const permission = await checkEditPermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit loads", data: null }
  }

  // Validate status value
  const normalizedTarget = parseLoadStatus(status)
  if (!normalizedTarget) {
    return { error: `Invalid status. Must be one of: ${ALL_LOAD_STATUSES.join(", ")}`, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Validate transitions per-load to avoid applying impossible status changes in bulk
  const { data: currentLoads, error: fetchError } = await supabase
    .from("loads")
    .select("id, shipment_number, status")
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (fetchError) {
    Sentry.captureException(fetchError)
    return { error: "Failed to fetch loads for bulk update", data: null }
  }

  if (!currentLoads || currentLoads.length === 0) {
    return { error: "No loads found to update", data: null }
  }

  const invalidLoads = currentLoads.filter((l: any) => {
    const currentStatus = normalizeLoadStatus(l.status)
    if (currentStatus === normalizedTarget) return false
    const allowedNext = getAllowedNextLoadStatuses(currentStatus)
    return !allowedNext.includes(normalizedTarget)
  })

  if (invalidLoads.length > 0) {
    const sample = invalidLoads
      .slice(0, 5)
      .map((l: any) => `${l.shipment_number || l.id} (${normalizeLoadStatus(l.status)} → ${normalizedTarget})`)
      .join(", ")
    const extra = invalidLoads.length > 5 ? ` (+${invalidLoads.length - 5} more)` : ""
    return {
      error: `Invalid status transition for ${invalidLoads.length} load(s): ${sample}${extra}`,
      data: null,
    }
  }

  const { error } = await supabase
    .from("loads")
    .update({ status: normalizedTarget })
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to update load status", data: null }
  }

  revalidatePath("/dashboard/loads")
  return { data: { updated: ids.length }, error: null }
}

export async function publishLoad(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data: currentLoad, error: loadError } = await supabase
    .from("loads")
    .select("id, status, shipment_number")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (loadError || !currentLoad) {
    return { error: "Load not found", data: null }
  }

  if (String(currentLoad.status || "").toLowerCase() !== "draft") {
    return { error: "Only draft loads can be published", data: null }
  }

  // Reuse updateLoad so normal status change notifications/alerts fire.
  return updateLoad(id, { status: "pending" })
}

// Duplicate/clone load for workflow optimization
export async function duplicateLoad(id: string) {
  const permission = await checkCreatePermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create loads", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get the original load
  const { data: originalLoad, error: fetchError } = await supabase
    .from("loads")
    .select(LOAD_DETAIL_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (fetchError || !originalLoad) {
    return { error: "Load not found", data: null }
  }

  // Generate new shipment number
  const { generateLoadNumber } = await import("./number-formats")
  const numberResult = await generateLoadNumber()
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error || "Failed to generate load number", data: null }
  }

  // Copy all known editable fields from original into a new draft.
  const duplicateData: any = {
    ...originalLoad,
    company_id: ctx.companyId,
    shipment_number: numberResult.data,
    status: "draft",
    load_date: null,
    estimated_delivery: null,
    actual_delivery: null,
    driver_id: null,
    truck_id: null,
    trailer_id: null,
    route_id: null,
  }

  delete duplicateData.id
  delete duplicateData.created_at
  delete duplicateData.updated_at
  delete duplicateData.trip_planning_estimate

  // SECURITY: Generate new tracking token for duplicate load
  const crypto = await import("crypto")
  duplicateData.public_tracking_token = crypto.randomBytes(32).toString("hex")

  const { data: newLoad, error: createError } = await supabase
    .from("loads")
    .insert(duplicateData)
    .select()
    .single()

  if (createError || !newLoad) {
    Sentry.captureException(createError)
    return { error: createError?.message || "Failed to create duplicate load", data: null }
  }

  // Duplicate delivery points if any
  const { data: deliveryPoints } = await supabase
    .from("load_delivery_points")
    .select(
      "id, type, contact_name, company_name, address_line1, address_line2, city, state, zip_code, country, lat, lng, sequence, date, time, instructions, reference_number, stop_type, is_completed, completed_at, created_at, updated_at, company_id",
    )
    .eq("load_id", id)
    .eq("company_id", ctx.companyId)

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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const suggestions: any = {
    suggestedDriver: null,
    suggestedTruck: null,
    lastUsedCustomer: null,
    similarLoads: [],
  }

  // Suggest driver based on route history (if origin/destination provided)
  if (origin && destination) {
    // BUG-035 FIX: Sanitize search strings to prevent PostgREST filter injection
    const sanitizeForOr = (str: string) => (str || '').replace(/[,()]/g, '').replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj|not)/gi, '').replace(/%/g, '').trim().substring(0, 200)
    const safeOrigin = sanitizeForOr(origin)
    const safeDest = sanitizeForOr(destination)
    
    const { data: recentLoads } = await supabase
      .from("loads")
      .select("driver_id, truck_id, customer_id")
      .eq("company_id", ctx.companyId)
      .or(`origin.ilike.%${safeOrigin}%,destination.ilike.%${safeDest}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (recentLoads && recentLoads.length > 0) {
      // Find most frequently used driver for this route
      const driverCounts: Record<string, number> = {}
      const truckCounts: Record<string, number> = {}
      recentLoads.forEach((load: { driver_id: string | null; truck_id: string | null; customer_id: string | null; [key: string]: any }) => {
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
        // V3-002 FIX: Add company_id filter to prevent cross-tenant data access
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, name, status")
          .eq("id", topDriverId)
          .eq("company_id", ctx.companyId)
          .eq("status", "active")
          .maybeSingle()
        if (driver) suggestions.suggestedDriver = driver
      }

      if (topTruckId) {
        // V3-002 FIX: Add company_id filter to prevent cross-tenant data access
        const { data: truck } = await supabase
          .from("trucks")
          .select("id, truck_number, status")
          .eq("id", topTruckId)
          .eq("company_id", ctx.companyId)
          .in("status", ["available", "in_use"])
          .maybeSingle()
        if (truck) suggestions.suggestedTruck = truck
      }

      // Get last used customer
      const lastLoad = recentLoads[0]
      if (lastLoad.customer_id) {
        // V3-002 FIX: Add company_id filter to prevent cross-tenant data access
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name, company_name")
          .eq("id", lastLoad.customer_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        if (customer) suggestions.lastUsedCustomer = customer
      }
    }
  }

  // Get similar loads for reference
  const { data: similarLoads } = await supabase
    .from("loads")
    .select("id, shipment_number, origin, destination, contents, value, status")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(5)

  if (similarLoads) {
    suggestions.similarLoads = similarLoads
  }

  return { data: suggestions, error: null }
}

