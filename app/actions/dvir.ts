"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { validateRequiredString, validateNonNegativeNumber, validateDate, sanitizeString } from "@/lib/validation"

/**
 * Get all DVIRs with optional filters
 */
export async function getDVIRs(filters?: {
  driver_id?: string
  truck_id?: string
  status?: string
  inspection_type?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  try {
    // Build query with pagination
    let query = supabase
      .from("dvir")
      .select(`
        id,
        driver_id,
        truck_id,
        inspection_type,
        inspection_date,
        inspection_time,
        location,
        mileage,
        odometer_reading,
        status,
        defects_found,
        safe_to_operate,
        defects,
        notes,
        corrective_action,
        certified,
        certified_by,
        certified_date,
        created_at,
        drivers:driver_id (id, name),
        trucks:truck_id (id, truck_number, make, model)
      `, { count: "exact" })
      .eq("company_id", company_id)
      .order("inspection_date", { ascending: false })
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.inspection_type) {
      query = query.eq("inspection_type", filters.inspection_type)
    }
    if (filters?.start_date) {
      query = query.gte("inspection_date", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("inspection_date", filters.end_date)
    }

    // Apply pagination
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: dvirs, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: dvirs || [], error: null, count: count || 0 }
  } catch (error: any) {
    return { error: error.message || "Failed to get DVIRs", data: null, count: 0 }
  }
}

/**
 * Get single DVIR by ID
 */
export async function getDVIR(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data: dvir, error } = await supabase
      .from("dvir")
      .select(`
        *,
        drivers:driver_id (id, name, license_number),
        trucks:truck_id (id, truck_number, make, model, year, vin),
        certified_by_user:certified_by (id, full_name, email)
      `)
      .eq("id", id)
      .eq("company_id", company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: dvir, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get DVIR", data: null }
  }
}

/**
 * Create new DVIR
 */
export async function createDVIR(formData: {
  driver_id: string
  truck_id: string
  inspection_type: string
  inspection_date: string
  inspection_time?: string
  location?: string
  mileage?: number
  odometer_reading?: number
  defects_found?: boolean
  safe_to_operate?: boolean
  defects?: Array<{
    component: string
    description: string
    severity: string
    corrected?: boolean
  }>
  notes?: string
  corrective_action?: string
  driver_signature?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  // Validation
  if (!validateRequiredString(formData.driver_id, 1, 100)) {
    return { error: "Driver is required", data: null }
  }

  if (!validateRequiredString(formData.truck_id, 1, 100)) {
    return { error: "Truck is required", data: null }
  }

  if (!validateRequiredString(formData.inspection_type, 1, 50)) {
    return { error: "Inspection type is required", data: null }
  }

  if (!validateDate(formData.inspection_date)) {
    return { error: "Invalid inspection date format", data: null }
  }

  if (formData.mileage !== undefined && formData.mileage !== null) {
    if (!validateNonNegativeNumber(formData.mileage)) {
      return { error: "Mileage must be a non-negative number", data: null }
    }
  }

  if (formData.odometer_reading !== undefined && formData.odometer_reading !== null) {
    if (!validateNonNegativeNumber(formData.odometer_reading)) {
      return { error: "Odometer reading must be a non-negative number", data: null }
    }
  }

  try {
    // Determine status based on defects
    let status = "passed"
    if (formData.defects_found) {
      status = "failed"
      // Check if all defects are corrected
      if (formData.defects && formData.defects.length > 0) {
        const allCorrected = formData.defects.every((d) => d.corrected === true)
        if (allCorrected) {
          status = "defects_corrected"
        }
      }
    }

    const { data: dvir, error } = await supabase
      .from("dvir")
      .insert({
        company_id,
        driver_id: formData.driver_id,
        truck_id: formData.truck_id,
        inspection_type: sanitizeString(formData.inspection_type, 50),
        inspection_date: formData.inspection_date,
        inspection_time: formData.inspection_time || null,
        location: formData.location ? sanitizeString(formData.location, 500) : null,
        mileage: formData.mileage || null,
        odometer_reading: formData.odometer_reading || null,
        status,
        defects_found: formData.defects_found || false,
        safe_to_operate: formData.safe_to_operate !== undefined ? formData.safe_to_operate : true,
        defects: formData.defects && formData.defects.length > 0 ? formData.defects : null,
        notes: formData.notes ? sanitizeString(formData.notes, 1000) : null,
        corrective_action: formData.corrective_action ? sanitizeString(formData.corrective_action, 1000) : null,
        driver_signature: formData.driver_signature || null,
        driver_signature_date: formData.driver_signature ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/dvir")
    return { data: dvir, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to create DVIR", data: null }
  }
}

/**
 * Update DVIR
 */
export async function updateDVIR(id: string, formData: {
  inspection_type?: string
  inspection_date?: string
  inspection_time?: string
  location?: string
  mileage?: number
  odometer_reading?: number
  defects_found?: boolean
  safe_to_operate?: boolean
  defects?: Array<{
    component: string
    description: string
    severity: string
    corrected?: boolean
  }>
  notes?: string
  corrective_action?: string
  driver_signature?: string
  certified?: boolean
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (formData.inspection_type !== undefined) {
      updateData.inspection_type = sanitizeString(formData.inspection_type, 50)
    }
    if (formData.inspection_date !== undefined) {
      if (!validateDate(formData.inspection_date)) {
        return { error: "Invalid inspection date format", data: null }
      }
      updateData.inspection_date = formData.inspection_date
    }
    if (formData.inspection_time !== undefined) {
      updateData.inspection_time = formData.inspection_time || null
    }
    if (formData.location !== undefined) {
      updateData.location = formData.location ? sanitizeString(formData.location, 500) : null
    }
    if (formData.mileage !== undefined) {
      updateData.mileage = formData.mileage || null
    }
    if (formData.odometer_reading !== undefined) {
      updateData.odometer_reading = formData.odometer_reading || null
    }
    if (formData.defects_found !== undefined) {
      updateData.defects_found = formData.defects_found
    }
    if (formData.safe_to_operate !== undefined) {
      updateData.safe_to_operate = formData.safe_to_operate
    }
    if (formData.defects !== undefined) {
      updateData.defects = formData.defects && formData.defects.length > 0 ? formData.defects : null
    }
    if (formData.notes !== undefined) {
      updateData.notes = formData.notes ? sanitizeString(formData.notes, 1000) : null
    }
    if (formData.corrective_action !== undefined) {
      updateData.corrective_action = formData.corrective_action ? sanitizeString(formData.corrective_action, 1000) : null
    }
    if (formData.driver_signature !== undefined) {
      updateData.driver_signature = formData.driver_signature || null
      if (formData.driver_signature) {
        updateData.driver_signature_date = new Date().toISOString()
      }
    }
    if (formData.certified !== undefined) {
      updateData.certified = formData.certified
      if (formData.certified) {
        updateData.certified_by = user.id
        updateData.certified_date = new Date().toISOString()
      } else {
        updateData.certified_by = null
        updateData.certified_date = null
      }
    }

    // Determine status based on defects
    if (formData.defects_found !== undefined || formData.defects !== undefined) {
      const defectsFound = formData.defects_found !== undefined ? formData.defects_found : updateData.defects_found
      const defects = formData.defects !== undefined ? formData.defects : updateData.defects

      if (defectsFound && defects && defects.length > 0) {
        const allCorrected = defects.every((d: any) => d.corrected === true)
        updateData.status = allCorrected ? "defects_corrected" : "failed"
      } else if (!defectsFound) {
        updateData.status = "passed"
      }
    }

    const { data: dvir, error } = await supabase
      .from("dvir")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/dvir")
    revalidatePath(`/dashboard/dvir/${id}`)
    return { data: dvir, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update DVIR", data: null }
  }
}

/**
 * Delete DVIR
 */
export async function deleteDVIR(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { error } = await supabase
      .from("dvir")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/dvir")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to delete DVIR", data: null }
  }
}

/**
 * Get DVIR statistics
 */
export async function getDVIRStats(filters?: {
  driver_id?: string
  truck_id?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("dvir")
      .select("id, status, defects_found, safe_to_operate, inspection_type")
      .eq("company_id", company_id)

    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.start_date) {
      query = query.gte("inspection_date", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("inspection_date", filters.end_date)
    }

    const { data: dvirs, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    const stats = {
      total: dvirs?.length || 0,
      passed: dvirs?.filter((d) => d.status === "passed").length || 0,
      failed: dvirs?.filter((d) => d.status === "failed").length || 0,
      defects_corrected: dvirs?.filter((d) => d.status === "defects_corrected").length || 0,
      with_defects: dvirs?.filter((d) => d.defects_found === true).length || 0,
      unsafe: dvirs?.filter((d) => d.safe_to_operate === false).length || 0,
      pre_trip: dvirs?.filter((d) => d.inspection_type === "pre_trip").length || 0,
      post_trip: dvirs?.filter((d) => d.inspection_type === "post_trip").length || 0,
      on_road: dvirs?.filter((d) => d.inspection_type === "on_road").length || 0,
    }

    return { data: stats, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get DVIR stats", data: null }
  }
}


