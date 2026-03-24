"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { validateTruckData, sanitizeString } from "@/lib/validation"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

/** Full row: `public.trucks` in supabase/schema.sql + supabase/trucks_schema_extended.sql */
const TRUCK_FULL_SELECT = `
  id, company_id, truck_number, make, model, year, vin, license_plate, status,
  current_driver_id, current_location, fuel_level, mileage, created_at, updated_at,
  height, serial_number, gross_vehicle_weight, license_expiry_date, inspection_date,
  insurance_provider, insurance_policy_number, insurance_expiry_date, owner_name, cost, color, documents
`

export async function getTrucks(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("trucks")
      .select("id, truck_number, make, model, year, status, current_driver_id, mileage, fuel_level, created_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: trucks, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: trucks || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error("[getTrucks] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null, count: 0 }
  }
}

export async function getTruck(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: truck, error } = await supabase
      .from("trucks")
      .select(TRUCK_FULL_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }

    if (!truck) {
      return { error: "Truck not found", data: null }
    }

    return { data: truck, error: null }
  } catch (error: any) {
    console.error("[getTruck] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

export async function createTruck(formData: {
  truck_number: string
  make?: string
  model?: string
  year?: number
  vin?: string
  license_plate?: string
  status?: string
  current_driver_id?: string | null
  current_location?: string | null
  fuel_level?: number | null
  mileage?: number | null
  // Extended TruckLogics fields
  height?: string
  serial_number?: string
  gross_vehicle_weight?: number
  license_expiry_date?: string
  inspection_date?: string
  insurance_provider?: string
  insurance_policy_number?: string
  insurance_expiry_date?: string
  owner_name?: string
  cost?: number
  color?: string
  documents?: any[]
  [key: string]: any
}) {
  // Check permission
  const permission = await checkCreatePermission("vehicles")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create trucks", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // BUG-061 FIX: Check subscription plan limits before creating truck
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select(`
      plan_id,
      subscription_plans!inner(max_vehicles)
    `)
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .maybeSingle()

  if (subscriptionError) {
    return { error: subscriptionError.message, data: null }
  }

  if (subscription?.subscription_plans?.max_vehicles) {
    // Count current active trucks
    const { count: currentTruckCount } = await supabase
      .from("trucks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("status", "active")

    if (currentTruckCount !== null && currentTruckCount >= subscription.subscription_plans.max_vehicles) {
      return {
        error: `Vehicle limit reached. Your plan allows ${subscription.subscription_plans.max_vehicles} vehicles. Please upgrade your subscription to add more vehicles.`,
        data: null
      }
    }
  }

  // Professional validation
  const truckValidation = validateTruckData({
    truck_number: formData.truck_number,
    vin: formData.vin,
    license_plate: formData.license_plate,
    year: formData.year,
    mileage: formData.mileage ?? undefined,
  })

  if (!truckValidation.valid) {
    return { error: truckValidation.errors.join("; "), data: null }
  }

  // Check for duplicate truck number
  const { data: existingTruck, error: existingTruckError } = await supabase
    .from("trucks")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("truck_number", sanitizeString(formData.truck_number, 50).toUpperCase())
    .maybeSingle()

  if (existingTruckError) {
    return { error: existingTruckError.message, data: null }
  }

  if (existingTruck) {
    return { error: "Truck number already exists", data: null }
  }

  // Check for duplicate VIN if provided
  if (formData.vin) {
    const { data: existingVIN, error: existingVINError } = await supabase
      .from("trucks")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("vin", sanitizeString(formData.vin, 17).toUpperCase())
      .maybeSingle()

    if (existingVINError) {
      return { error: existingVINError.message, data: null }
    }

    if (existingVIN) {
      return { error: "VIN already exists in the system", data: null }
    }
  }

  // Check for duplicate license plate if provided
  if (formData.license_plate) {
    const { data: existingPlate, error: existingPlateError } = await supabase
      .from("trucks")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("license_plate", sanitizeString(formData.license_plate, 20).toUpperCase())
      .maybeSingle()

    if (existingPlateError) {
      return { error: existingPlateError.message, data: null }
    }

    if (existingPlate) {
      return { error: "License plate already exists in the system", data: null }
    }
  }

  // Validate driver assignment if provided
  if (formData.current_driver_id) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, status, company_id, truck_id")
      .eq("id", formData.current_driver_id)
      .eq("company_id", ctx.companyId)
      .single()

    if (driverError || !driver) {
      return { error: "Invalid driver selected", data: null }
    }

    if (driver.status !== "active") {
      return { error: "Cannot assign inactive driver to truck", data: null }
    }

    if (driver.truck_id) {
      return { error: "Driver is already assigned to another truck", data: null }
    }
  }

  // Build insert data with professional sanitization
  const truckData: any = {
    company_id: ctx.companyId,
    truck_number: sanitizeString(formData.truck_number, 50).toUpperCase(),
    status: formData.status || "available",
  }

  // Add optional fields with validation and sanitization
  if (formData.make) truckData.make = sanitizeString(formData.make, 50)
  if (formData.model) truckData.model = sanitizeString(formData.model, 50)
  if (formData.year !== undefined && formData.year !== null) {
    const currentYear = new Date().getFullYear()
    const year = typeof formData.year === 'string' ? parseInt(formData.year) : formData.year
    if (!isNaN(year) && year >= 1900 && year <= currentYear + 1) {
      truckData.year = year
    }
  }
  if (formData.vin) truckData.vin = sanitizeString(formData.vin, 17).toUpperCase()
  if (formData.license_plate) truckData.license_plate = sanitizeString(formData.license_plate, 20).toUpperCase()
  if (formData.current_driver_id) truckData.current_driver_id = formData.current_driver_id
  if (formData.current_location) truckData.current_location = sanitizeString(formData.current_location, 200)
  if (formData.fuel_level !== undefined && formData.fuel_level !== null) {
    const fuel = typeof formData.fuel_level === 'string' ? parseFloat(formData.fuel_level) : formData.fuel_level
    if (!isNaN(fuel) && fuel >= 0 && fuel <= 100) {
      truckData.fuel_level = fuel
    }
  }
  if (formData.mileage !== undefined && formData.mileage !== null) {
    const mileage = typeof formData.mileage === 'string' ? parseFloat(formData.mileage) : formData.mileage
    if (!isNaN(mileage) && mileage >= 0) {
      truckData.mileage = mileage
    }
  }
  
  // Extended TruckLogics fields
  if (formData.height) truckData.height = formData.height
  if (formData.serial_number) truckData.serial_number = formData.serial_number
  if (formData.gross_vehicle_weight !== undefined && formData.gross_vehicle_weight !== null) truckData.gross_vehicle_weight = formData.gross_vehicle_weight
  if (formData.license_expiry_date) truckData.license_expiry_date = formData.license_expiry_date
  if (formData.inspection_date) truckData.inspection_date = formData.inspection_date
  if (formData.insurance_provider) truckData.insurance_provider = formData.insurance_provider
  if (formData.insurance_policy_number) truckData.insurance_policy_number = formData.insurance_policy_number
  if (formData.insurance_expiry_date) truckData.insurance_expiry_date = formData.insurance_expiry_date
  if (formData.owner_name) truckData.owner_name = formData.owner_name
  if (formData.cost !== undefined && formData.cost !== null) truckData.cost = formData.cost
  if (formData.color) truckData.color = formData.color
  if (formData.documents && Array.isArray(formData.documents)) truckData.documents = formData.documents

  const { data, error } = await supabase
    .from("trucks")
    .insert(truckData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/trucks")
  return { data, error: null }
}

export async function updateTruck(
  id: string,
  formData: {
    truck_number?: string
    make?: string
    model?: string
    year?: number
    vin?: string
    license_plate?: string
    status?: string
    current_driver_id?: string | null
    current_location?: string | null
    fuel_level?: number | null
    mileage?: number | null
    // Extended TruckLogics fields
    height?: string
    serial_number?: string
    gross_vehicle_weight?: number
    license_expiry_date?: string
    inspection_date?: string
    insurance_provider?: string
    insurance_policy_number?: string
    insurance_expiry_date?: string
    owner_name?: string
    cost?: number
    color?: string
    documents?: any[]
    [key: string]: any
  }
) {
  // Check permission
  const permission = await checkEditPermission("vehicles")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit trucks", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get current truck data for audit trail (with company_id verification)
  const { data: currentTruck } = await supabase
    .from("trucks")
    .select(TRUCK_FULL_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .single()

  if (!currentTruck) {
    return { error: "Truck not found", data: null }
  }

  // Build update data and track changes
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  const fieldsToCheck = [
    "truck_number", "make", "model", "year", "vin", "license_plate", "status",
    "current_driver_id", "current_location", "fuel_level", "mileage",
    "height", "serial_number", "gross_vehicle_weight", "license_expiry_date",
    "inspection_date", "insurance_provider", "insurance_policy_number",
    "insurance_expiry_date", "owner_name", "cost", "color"
  ]

  for (const field of fieldsToCheck) {
    if (formData[field as keyof typeof formData] !== undefined) {
      const newValue = formData[field as keyof typeof formData]
      const oldValue = currentTruck[field]
      if (newValue !== oldValue) {
        updateData[field] = newValue === null || newValue === "" ? null : newValue
        changes.push({ field, old_value: oldValue, new_value: newValue })
      }
    }
  }

  if (formData.documents !== undefined && JSON.stringify(formData.documents) !== JSON.stringify(currentTruck.documents)) {
    updateData.documents = formData.documents || []
    changes.push({ field: "documents", old_value: currentTruck.documents, new_value: formData.documents })
  }

  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentTruck is JSON-serializable
    const serializableCurrentTruck = currentTruck ? JSON.parse(JSON.stringify(currentTruck, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentTruck, error: null }
  }

  const { data, error } = await supabase
    .from("trucks")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Auto-schedule maintenance if mileage was updated
  if (formData.mileage !== undefined && data) {
    try {
      const { autoScheduleMaintenanceFromMileage } = await import("./auto-maintenance")
      await autoScheduleMaintenanceFromMileage(id).catch((err) => {
        console.warn("[updateTruck] Auto-maintenance scheduling failed:", err.message)
      })
    } catch (error) {
      console.warn("[updateTruck] Failed to import auto-maintenance:", error)
    }
  }

  // Create audit log entries
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (ctx.userId) {
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "truck",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            console.log("[updateTruck] ✅ Audit log created for field:", change.field)
          } catch (err: any) {
            console.error("[updateTruck] ❌ Audit log failed for field", change.field, ":", err.message)
          }
        }
      } else {
        console.warn("[updateTruck] No user found for audit logging")
      }
    } catch (err: any) {
      console.error("[updateTruck] Failed to import audit log module:", err.message)
    }
  }

  revalidatePath("/dashboard/trucks")
  revalidatePath(`/dashboard/trucks/${id}`)

  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint') return value.toString()
    return value
  })) : null

  return { data: serializableData, error: null }
}

export async function deleteTruck(id: string) {
  try {
    // Check permission
    const permission = await checkDeletePermission("vehicles")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to delete trucks" }
    }

    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated" }
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!id || !uuidRegex.test(id)) {
      return { error: "Invalid truck ID format" }
    }

    // Dependency checks mirroring bulkDeleteTrucks safeguards
    const { data: truck } = await supabase
      .from("trucks")
      .select("id, truck_number, status")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!truck) {
      return { error: "Truck not found" }
    }

    if (truck.status === "in_use") {
      return {
        error: `Cannot delete truck ${truck.truck_number || ""} while it is in use. Please complete or cancel active loads first.`,
      }
    }

    const { data: activeLoads } = await supabase
      .from("loads")
      .select("id, shipment_number, status")
      .eq("truck_id", id)
      .in("status", ["scheduled", "in_transit"])
      .eq("company_id", ctx.companyId)

    if (activeLoads && activeLoads.length > 0) {
      const loadNumbers = activeLoads.map((l: { shipment_number: string | null }) => l.shipment_number).join(", ")
      return {
        error: `Cannot delete truck. It is assigned to active loads: ${loadNumbers}. Please reassign or complete these loads first.`,
      }
    }

    const { error } = await supabase
      .from("trucks")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard/trucks")
    return { error: null }
  } catch (error: any) {
    console.error("[deleteTruck] Unexpected error:", error)
    return { error: error?.message || "Failed to delete truck" }
  }
}

// Bulk operations for workflow optimization
export async function bulkDeleteTrucks(ids: string[]) {
  // Check permission
  const permission = await checkDeletePermission("vehicles")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete trucks", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // DAT-004 FIX: Check for active assignments before bulk delete
  // Prevent deleting trucks that are in_use or assigned to active loads
  const { data: trucksToDelete } = await supabase
    .from("trucks")
    .select("id, truck_number, status")
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (trucksToDelete) {
    const inUseTrucks = trucksToDelete.filter((t: { status: string; [key: string]: any }) => t.status === "in_use")
    if (inUseTrucks.length > 0) {
      const truckNumbers = inUseTrucks.map((t: { truck_number: string; [key: string]: any }) => t.truck_number).join(", ")
      return { 
        error: `Cannot delete trucks that are in use: ${truckNumbers}. Please complete or cancel their active loads first.`,
        data: null 
      }
    }
  }

  // Also check for active loads assigned to these trucks
  const { data: activeLoads } = await supabase
    .from("loads")
    .select("id, truck_id, shipment_number, status")
    .in("truck_id", ids)
    .in("status", ["scheduled", "in_transit"])
    .eq("company_id", ctx.companyId)

  if (activeLoads && activeLoads.length > 0) {
    const blockedTruckIds = [...new Set(activeLoads.map((load: { truck_id: string | null; [key: string]: any }) => load.truck_id))]
    const blockedTrucks = await supabase
      .from("trucks")
      .select("id, truck_number")
      .in("id", blockedTruckIds)
      .eq("company_id", ctx.companyId)

    if (blockedTrucks.data && blockedTrucks.data.length > 0) {
      const truckNumbers = blockedTrucks.data.map((t: { truck_number: string; [key: string]: any }) => t.truck_number).join(", ")
      return { 
        error: `Cannot delete trucks with active loads: ${truckNumbers}. Please complete or cancel their loads first.`,
        data: null 
      }
    }
  }

  const { error } = await supabase
    .from("trucks")
    .delete()
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/trucks")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateTruckStatus(ids: string[], status: string) {
  // Check permission
  const permission = await checkEditPermission("vehicles")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit trucks", data: null }
  }

  // Validate status value
  const validStatuses = ["available", "in_use", "maintenance", "out_of_service"]
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { error } = await supabase
    .from("trucks")
    .update({ status })
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/trucks")
  return { data: { updated: ids.length }, error: null }
}

