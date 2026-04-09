"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { sanitizeString, validateRequiredString, validateDate, validatePositiveNumber } from "@/lib/validation"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

export async function getMaintenance(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null, count: 0 }
    }

    let query = supabase
      .from("maintenance")
      .select(
        "id, company_id, truck_id, service_type, scheduled_date, completed_date, status, priority, estimated_cost, actual_cost, vendor, mileage, created_at",
        { count: "exact" },
      )
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // Pagination: default 25, max 100
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: maintenance, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: maintenance || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function createMaintenance(formData: {
  truck_id: string
  service_type: string
  scheduled_date: string
  current_mileage?: number
  priority?: string
  estimated_cost?: number
  notes?: string
  vendor?: string // Changed from vendor_id to vendor (TEXT field, not UUID)
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create maintenance records", data: null }
  }

  // Validate truck_id ownership
  const { data: truck, error: truckError } = await supabase
    .from("trucks")
    .select("id")
    .eq("id", formData.truck_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (truckError || !truck) {
    return { error: "Truck not found or does not belong to your company", data: null }
  }

  // Validate and sanitize input
  if (!validateRequiredString(formData.truck_id, 1, 100)) {
    return { error: "Truck ID is required", data: null }
  }

  if (!validateRequiredString(formData.service_type, 1, 100)) {
    return { error: "Service type is required and must be between 1 and 100 characters", data: null }
  }

  if (!validateDate(formData.scheduled_date)) {
    return { error: "Invalid scheduled date format (use YYYY-MM-DD)", data: null }
  }

  // Sanitize string inputs (sanitizeString takes maxLength only, not minLength)
  const sanitizedServiceType = sanitizeString(formData.service_type, 100)
  const sanitizedPriority = formData.priority ? sanitizeString(formData.priority, 20) : "normal"
  const sanitizedNotes = formData.notes ? sanitizeString(formData.notes, 2000) : null
  const sanitizedVendor = formData.vendor ? sanitizeString(formData.vendor, 200) : null

  // Validate numeric fields
  if (formData.current_mileage !== undefined && formData.current_mileage !== null) {
    if (!validatePositiveNumber(formData.current_mileage)) {
      return { error: "Current mileage must be a positive number", data: null }
    }
  }

  if (formData.estimated_cost !== undefined && formData.estimated_cost !== null) {
    if (!validatePositiveNumber(formData.estimated_cost)) {
      return { error: "Estimated cost must be a positive number", data: null }
    }
  }

  const { data, error } = await supabase
    .from("maintenance")
    .insert({
      company_id: ctx.companyId,
      truck_id: sanitizeString(formData.truck_id, 100),
      service_type: sanitizedServiceType,
      scheduled_date: formData.scheduled_date,
      mileage: formData.current_mileage ? Number(formData.current_mileage) : null,
      priority: sanitizedPriority,
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : null,
      notes: sanitizedNotes,
      vendor: sanitizedVendor, // Schema has 'vendor' TEXT, not 'vendor_id' UUID
      status: "scheduled",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

    revalidatePath("/dashboard/maintenance")
    
    // Trigger webhook
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(ctx.companyId, "maintenance.scheduled", {
        maintenance_id: data.id,
      truck_id: formData.truck_id,
      service_type: formData.service_type,
      scheduled_date: formData.scheduled_date,
    })
    } catch (error) {
      Sentry.captureException(error)
    }
    
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function getMaintenanceById(id: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data: maintenance, error } = await supabase
    .from("maintenance")
    .select(`
      *,
      truck:truck_id (
        id,
        truck_number,
        make,
        model,
        year,
        mileage
      )
    `)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    return { error: error.message, data: null }
  }
  if (!maintenance) {
    return { error: "Maintenance record not found", data: null }
  }

  return { data: maintenance, error: null }
}

export async function updateMaintenanceStatus(
  id: string,
  status: string,
  actualCost?: number,
  completedDate?: string
) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkEditPermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to update maintenance records", data: null }
  }

  // Validate status enum
  const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"]
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, data: null }
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "completed") {
    updateData.completed_date = completedDate || new Date().toISOString().split("T")[0]
    if (actualCost !== undefined) {
      updateData.actual_cost = actualCost
    }
  }

  const { data, error } = await supabase
    .from("maintenance")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance")
  revalidatePath(`/dashboard/maintenance/${id}`)

  return { data, error: null }
}

export async function deleteMaintenance(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete maintenance records" }
  }

  const { error } = await supabase
    .from("maintenance")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/maintenance")
  return { error: null }
}

