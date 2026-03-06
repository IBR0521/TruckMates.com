"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { validateDriverData, sanitizeString, sanitizeEmail, sanitizePhone } from "@/lib/validation"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

export async function getDrivers(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // Check permission
    const permission = await checkViewPermission("drivers")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to view drivers", data: null, count: 0 }
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: "Not authenticated", data: null, count: 0 }
    }

    // Use optimized helper with caching
    const result = await getCachedUserCompany(user.id)
    const company_id = result.company_id
    const companyError = result.error

    if (companyError || !company_id) {
      return { error: companyError || "No company found", data: null }
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("drivers")
      .select("id, name, email, phone, status, license_number, license_expiry, truck_id, created_at", { count: "exact" })
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: drivers, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: drivers || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error("[getDrivers] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null, count: 0 }
  }
}

export async function getDriver(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const result = await getCachedUserCompany(user.id)
    if (result.error || !result.company_id) {
      return { error: result.error || "No company found", data: null }
    }

    // SECURITY FIX: Use explicit column selection instead of select("*")
    const { data: driver, error } = await supabase
      .from("drivers")
      .select(`
        id,
        company_id,
        name,
        email,
        phone,
        status,
        license_number,
        license_expiry,
        license_state,
        license_type,
        license_endorsements,
        driver_id,
        employee_type,
        address,
        city,
        state,
        zip,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        date_of_birth,
        hire_date,
        pay_rate_type,
        pay_rate,
        notes,
        custom_fields,
        truck_id,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .eq("company_id", result.company_id)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }

    if (!driver) {
      return { error: "Driver not found", data: null }
    }

    // Fetch truck data separately if truck_id exists (since there's no FK relationship)
    if (driver.truck_id) {
      const { data: truck } = await supabase
        .from("trucks")
        .select("id, truck_number, make, model")
        .eq("id", driver.truck_id)
        .eq("company_id", result.company_id)
        .maybeSingle()
      
      // Add truck data to driver object
      if (truck) {
        (driver as any).truck = truck
      }
    }

    return { data: driver, error: null }
  } catch (error: any) {
    console.error("[getDriver] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

export async function createDriver(formData: {
  name: string
  email: string
  phone: string
  license_number: string
  license_expiry?: string | null
  status?: string
  truck_id?: string | null
  [key: string]: any // Allow additional fields
}) {
  // Check permission
  const permission = await checkCreatePermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create drivers", data: null }
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

  // Professional validation
  const driverValidation = validateDriverData({
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    license_number: formData.license_number,
    license_expiry: formData.license_expiry || undefined,
  })

  if (!driverValidation.valid) {
    return { error: driverValidation.errors.join("; "), data: null }
  }

  // BUG-023 FIX: Only validate license expiry date on creation when status is "active"
  // Allow expired licenses for inactive drivers or when editing existing drivers
  if (formData.license_expiry && (formData.status === "active" || !formData.status)) {
    const expiryDate = new Date(formData.license_expiry)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (expiryDate < today) {
      return { 
        error: "Cannot create an active driver with an expired license. Please set status to 'inactive' or update the license expiry date.", 
        data: null 
      }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking for duplicates (might not exist)
  // Check for duplicate email if provided
  if (formData.email) {
    const { data: existingDriver, error: emailCheckError } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("email", sanitizeEmail(formData.email))
      .maybeSingle()

    // Only treat as error if it's not a "not found" case
    if (emailCheckError && emailCheckError.code !== "PGRST116") {
      return { error: emailCheckError.message || "Failed to check for duplicate email", data: null }
    }

    if (existingDriver) {
      return { error: "Driver with this email already exists", data: null }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking for duplicates (might not exist)
  // Check for duplicate license number if provided
  if (formData.license_number) {
    const { data: existingLicense, error: licenseCheckError } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("license_number", sanitizeString(formData.license_number, 20).toUpperCase())
      .maybeSingle()

    // Only treat as error if it's not a "not found" case
    if (licenseCheckError && licenseCheckError.code !== "PGRST116") {
      return { error: licenseCheckError.message || "Failed to check for duplicate license", data: null }
    }

    if (existingLicense) {
      return { error: "Driver with this license number already exists", data: null }
    }
  }

  // Validate truck assignment if provided
  if (formData.truck_id) {
    // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, status, company_id, current_driver_id")
      .eq("id", formData.truck_id)
      .eq("company_id", userData.company_id)
      .maybeSingle()

    if (truckError) {
      return { error: truckError.message || "Failed to validate truck", data: null }
    }

    if (!truck) {
      return { error: "Invalid truck selected", data: null }
    }

    if (truck.current_driver_id) {
      return { error: "Truck is already assigned to another driver", data: null }
    }
  }

  // Build insert data with professional sanitization
  // Include all extended fields from the drivers table schema
  const driverData: any = {
    company_id: userData.company_id,
    name: sanitizeString(formData.name, 100),
    status: formData.status || "active",
  }

  // Add optional fields with validation and sanitization
  if (formData.email) driverData.email = sanitizeEmail(formData.email)
  if (formData.phone) driverData.phone = sanitizePhone(formData.phone)
  if (formData.license_number) driverData.license_number = sanitizeString(formData.license_number, 20).toUpperCase()
  if (formData.license_expiry) driverData.license_expiry = formData.license_expiry
  if (formData.truck_id) driverData.truck_id = formData.truck_id
  
  // Extended fields
  if (formData.driver_id) driverData.driver_id = sanitizeString(formData.driver_id, 50)
  if (formData.employee_type) driverData.employee_type = formData.employee_type
  if (formData.date_of_birth) driverData.date_of_birth = formData.date_of_birth
  if (formData.address) driverData.address = sanitizeString(formData.address, 200)
  if (formData.city) driverData.city = sanitizeString(formData.city, 100)
  if (formData.state) driverData.state = sanitizeString(formData.state, 2).toUpperCase()
  if (formData.zip) driverData.zip = sanitizeString(formData.zip, 10)
  if (formData.license_state) driverData.license_state = sanitizeString(formData.license_state, 2).toUpperCase()
  if (formData.license_type) driverData.license_type = formData.license_type
  if (formData.license_endorsements) driverData.license_endorsements = sanitizeString(formData.license_endorsements, 200)
  if (formData.hire_date) driverData.hire_date = formData.hire_date
  if (formData.pay_rate_type) driverData.pay_rate_type = formData.pay_rate_type
  if (formData.pay_rate !== undefined && formData.pay_rate !== null) driverData.pay_rate = Number.parseFloat(String(formData.pay_rate))
  if (formData.emergency_contact_name) driverData.emergency_contact_name = sanitizeString(formData.emergency_contact_name, 100)
  if (formData.emergency_contact_phone) driverData.emergency_contact_phone = sanitizePhone(formData.emergency_contact_phone)
  if (formData.emergency_contact_relationship) driverData.emergency_contact_relationship = sanitizeString(formData.emergency_contact_relationship, 50)
  if (formData.notes) driverData.notes = sanitizeString(formData.notes, 1000)

  // SECURITY FIX: Use explicit column selection instead of select()
  const { data, error } = await supabase
    .from("drivers")
    .insert(driverData)
    .select(`
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

export async function updateDriver(
  id: string,
  formData: {
    name?: string
    email?: string
    phone?: string
    license_number?: string
    license_expiry?: string | null
    status?: string
    truck_id?: string | null
    [key: string]: any
  }
) {
  // Check permission
  const permission = await checkEditPermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit drivers", data: null }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // SECURITY FIX: Use explicit column selection instead of select("*")
  // Get current driver data for audit trail (with company_id verification)
  const { data: currentDriver, error: fetchError } = await supabase
    .from("drivers")
    .select(`
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .maybeSingle()

  if (fetchError) {
    return { error: fetchError.message || "Failed to fetch driver", data: null }
  }

  if (!currentDriver) {
    return { error: "Driver not found", data: null }
  }

  // Build update data, only including fields that are provided
  // Include all extended fields from the drivers table schema
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  // Helper function to check and update field
  const updateField = (field: string, newValue: any, oldValue: any = null) => {
    const currentValue = oldValue !== null ? oldValue : (currentDriver[field] ?? null)
    if (newValue !== undefined && newValue !== currentValue) {
      updateData[field] = newValue === "" ? null : newValue
      changes.push({ field, old_value: currentValue, new_value: newValue })
    }
  }
  
  // Basic fields
  updateField("name", formData.name)
  updateField("email", formData.email)
  updateField("phone", formData.phone)
  updateField("license_number", formData.license_number)
  updateField("license_expiry", formData.license_expiry || null)
  updateField("status", formData.status)
  updateField("truck_id", formData.truck_id || null)
  
  // Extended fields
  updateField("driver_id", formData.driver_id)
  updateField("employee_type", formData.employee_type)
  updateField("date_of_birth", formData.date_of_birth)
  updateField("address", formData.address)
  updateField("city", formData.city)
  updateField("state", formData.state)
  updateField("zip", formData.zip)
  updateField("license_state", formData.license_state)
  updateField("license_type", formData.license_type)
  updateField("license_endorsements", formData.license_endorsements)
  updateField("hire_date", formData.hire_date)
  updateField("pay_rate_type", formData.pay_rate_type)
  if (formData.pay_rate !== undefined) {
    updateField("pay_rate", formData.pay_rate ? Number.parseFloat(String(formData.pay_rate)) : null)
  }
  updateField("emergency_contact_name", formData.emergency_contact_name)
  updateField("emergency_contact_phone", formData.emergency_contact_phone)
  updateField("emergency_contact_relationship", formData.emergency_contact_relationship)
  updateField("notes", formData.notes)
  
  // Sanitize string fields
  if (updateData.name) updateData.name = sanitizeString(updateData.name, 100)
  if (updateData.email) updateData.email = sanitizeEmail(updateData.email)
  if (updateData.phone) updateData.phone = sanitizePhone(updateData.phone)
  if (updateData.license_number) updateData.license_number = sanitizeString(updateData.license_number, 20).toUpperCase()
  if (updateData.driver_id) updateData.driver_id = sanitizeString(updateData.driver_id, 50)
  if (updateData.address) updateData.address = sanitizeString(updateData.address, 200)
  if (updateData.city) updateData.city = sanitizeString(updateData.city, 100)
  if (updateData.state) updateData.state = sanitizeString(updateData.state, 2).toUpperCase()
  if (updateData.zip) updateData.zip = sanitizeString(updateData.zip, 10)
  if (updateData.license_state) updateData.license_state = sanitizeString(updateData.license_state, 2).toUpperCase()
  if (updateData.license_endorsements) updateData.license_endorsements = sanitizeString(updateData.license_endorsements, 200)
  if (updateData.emergency_contact_name) updateData.emergency_contact_name = sanitizeString(updateData.emergency_contact_name, 100)
  if (updateData.emergency_contact_phone) updateData.emergency_contact_phone = sanitizePhone(updateData.emergency_contact_phone)
  if (updateData.emergency_contact_relationship) updateData.emergency_contact_relationship = sanitizeString(updateData.emergency_contact_relationship, 50)
  if (updateData.notes) updateData.notes = sanitizeString(updateData.notes, 1000)

  // If no changes, return early
  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentDriver is JSON-serializable
    const serializableCurrentDriver = currentDriver ? JSON.parse(JSON.stringify(currentDriver, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentDriver, error: null }
  }

  const { data, error } = await supabase
    .from("drivers")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select(`
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at,
      trucks:truck_id (id, truck_number, make, model)
    `)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  // Convert Date objects and other non-serializable values to strings
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    // Convert Date objects to ISO strings
    if (value instanceof Date) {
      return value.toISOString()
    }
    // Handle other non-serializable types
    if (typeof value === 'bigint') {
      return value.toString()
    }
    return value
  })) : null

  // Create audit log entries for each change
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Log each field change separately for better audit trail
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "driver",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            console.log("[updateDriver] ✅ Audit log created for field:", change.field)
          } catch (err: any) {
            // Log error but don't fail the update
            console.error("[updateDriver] ❌ Audit log failed for field", change.field, ":", err.message)
            console.error("[updateDriver] Error code:", err.code)
            // Check if it's a table missing error
            if (err.code === "42P01" || err.message?.includes("relation") || err.message?.includes("does not exist")) {
              console.error("[updateDriver] ⚠️ audit_logs table may not exist. Run: supabase/audit_logs_schema.sql")
            }
            // Check if it's an RLS policy error
            if (err.code === "42501" || err.message?.includes("permission denied") || err.message?.includes("policy")) {
              console.error("[updateDriver] ⚠️ RLS policy blocking audit log insert!")
              console.error("[updateDriver] Please update supabase/audit_logs_schema.sql with INSERT policy")
            }
          }
        }
      } else {
        console.warn("[updateDriver] No user found for audit logging")
      }
    } catch (err: any) {
      console.error("[updateDriver] Failed to import audit log module:", err.message)
    }
  }

  revalidatePath("/dashboard/drivers")
  revalidatePath(`/dashboard/drivers/${id}`)

  return { data: serializableData, error: null }
}

export async function deleteDriver(id: string) {
  // Check permission
  const permission = await checkDeletePermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete drivers" }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found" }
  }

  // BUG-024 FIX: Check for dependencies before deleting driver
  // Check for active loads
  const { data: activeLoads } = await supabase
    .from("loads")
    .select("id, shipment_number, status")
    .eq("driver_id", id)
    .in("status", ["assigned", "in_transit", "delivered", "pending"])

  if (activeLoads && activeLoads.length > 0) {
    const loadNumbers = activeLoads.map((l: { shipment_number: string }) => l.shipment_number).join(", ")
    return { 
      error: `Cannot delete driver. Driver is assigned to ${activeLoads.length} active load(s): ${loadNumbers}. Please reassign or complete these loads first.` 
    }
  }

  // Check for unsubmitted DVIRs
  const { data: openDVIRs } = await supabase
    .from("dvir")
    .select("id, inspection_date")
    .eq("driver_id", id)
    .eq("status", "pending")

  if (openDVIRs && openDVIRs.length > 0) {
    return { 
      error: `Cannot delete driver. Driver has ${openDVIRs.length} unsubmitted DVIR(s). Please submit or delete these DVIRs first.` 
    }
  }

  // Check for ELD device mappings
  const { data: eldDevices } = await supabase
    .from("eld_devices")
    .select("id, device_name")
    .eq("driver_id", id)

  if (eldDevices && eldDevices.length > 0) {
    const deviceNames = eldDevices.map((d: { device_name?: string; id: string }) => d.device_name || d.id).join(", ")
    return { 
      error: `Cannot delete driver. Driver is mapped to ${eldDevices.length} ELD device(s): ${deviceNames}. Please unassign these devices first.` 
    }
  }

  // BUG-024 FIX: Offer soft delete as primary option (set status to inactive)
  // For now, we'll proceed with hard delete but log a warning
  // In the future, consider implementing soft delete as the default

  const { error } = await supabase
    .from("drivers")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  return { error: null }
}

// Bulk operations for workflow optimization
export async function bulkDeleteDrivers(ids: string[]) {
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

  // DAT-004 FIX: Check for active assignments before bulk delete
  // Prevent deleting drivers who are currently on active loads
  const { data: activeLoads } = await supabase
    .from("loads")
    .select("id, driver_id, shipment_number, status")
    .in("driver_id", ids)
    .in("status", ["scheduled", "in_transit"])
    .eq("company_id", userData.company_id)

  if (activeLoads && activeLoads.length > 0) {
    const blockedDriverIds = [...new Set(activeLoads.map((load: { id: string; driver_id: string | null; shipment_number: string | null; status: string }) => load.driver_id))]
    const blockedDrivers = await supabase
      .from("drivers")
      .select("id, name")
      .in("id", blockedDriverIds)
      .eq("company_id", userData.company_id)

    if (blockedDrivers.data && blockedDrivers.data.length > 0) {
      const driverNames = blockedDrivers.data.map((d: { id: string; name: string | null }) => d.name).join(", ")
      return { 
        error: `Cannot delete drivers with active loads: ${driverNames}. Please reassign or complete their loads first.`,
        data: null 
      }
    }
  }

  const { error } = await supabase
    .from("drivers")
    .delete()
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateDriverStatus(ids: string[], status: string) {
  // Check permission
  const permission = await checkEditPermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit drivers", data: null }
  }

  // Validate status value
  const validStatuses = ["active", "inactive", "on_leave"]
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, data: null }
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

  const { error } = await supabase
    .from("drivers")
    .update({ status })
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  return { data: { updated: ids.length }, error: null }
}

