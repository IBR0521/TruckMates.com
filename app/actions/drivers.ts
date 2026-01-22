"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { validateDriverData, sanitizeString, sanitizeEmail, sanitizePhone } from "@/lib/validation"

export async function getDrivers(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
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
}

export async function getDriver(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: driver, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: driver, error: null }
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

  // Check for duplicate email if provided
  if (formData.email) {
    const { data: existingDriver } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("email", sanitizeEmail(formData.email))
      .single()

    if (existingDriver) {
      return { error: "Driver with this email already exists", data: null }
    }
  }

  // Check for duplicate license number if provided
  if (formData.license_number) {
    const { data: existingLicense } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("license_number", sanitizeString(formData.license_number, 20).toUpperCase())
      .single()

    if (existingLicense) {
      return { error: "Driver with this license number already exists", data: null }
    }
  }

  // Validate truck assignment if provided
  if (formData.truck_id) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, status, company_id, current_driver_id")
      .eq("id", formData.truck_id)
      .eq("company_id", userData.company_id)
      .single()

    if (truckError || !truck) {
      return { error: "Invalid truck selected", data: null }
    }

    if (truck.current_driver_id && truck.current_driver_id !== formData.truck_id) {
      return { error: "Truck is already assigned to another driver", data: null }
    }
  }

  // Build insert data with professional sanitization
  // Only include fields that exist in the drivers table schema
  const driverData: any = {
    company_id: userData.company_id,
    name: sanitizeString(formData.name, 100),
    status: formData.status || "active",
  }

  // Add optional fields with validation and sanitization (only fields that exist in schema)
  if (formData.email) driverData.email = sanitizeEmail(formData.email)
  if (formData.phone) driverData.phone = sanitizePhone(formData.phone)
  if (formData.license_number) driverData.license_number = sanitizeString(formData.license_number, 20).toUpperCase()
  if (formData.license_expiry) driverData.license_expiry = formData.license_expiry
  if (formData.truck_id) driverData.truck_id = formData.truck_id

  const { data, error } = await supabase
    .from("drivers")
    .insert(driverData)
    .select()
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
  const supabase = await createClient()

  // Build update data, only including fields that are provided
  // Only include fields that exist in the drivers table schema
  const updateData: any = {}
  
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.email !== undefined) updateData.email = formData.email
  if (formData.phone !== undefined) updateData.phone = formData.phone
  if (formData.license_number !== undefined) updateData.license_number = formData.license_number
  if (formData.license_expiry !== undefined) updateData.license_expiry = formData.license_expiry || null
  if (formData.status !== undefined) updateData.status = formData.status
  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
  // Note: pay_rate column doesn't exist in drivers table schema

  const { data, error } = await supabase
    .from("drivers")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  revalidatePath(`/dashboard/drivers/${id}`)

  return { data, error: null }
}

export async function deleteDriver(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("drivers").delete().eq("id", id)

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

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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

