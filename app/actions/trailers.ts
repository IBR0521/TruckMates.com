"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { sanitizeString } from "@/lib/validation"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"

const TRAILER_FULL_SELECT = `
  id, company_id, trailer_number, vin, plate_number, plate_state, year, make, model,
  trailer_type, length_ft, capacity_lbs, door_type, status, current_truck_id, current_location,
  last_dot_inspection_date, next_dot_inspection_date, last_brake_inspection_date,
  reefer_unit_hours, last_reefer_service_date, registration_expiry, created_at, updated_at
`

export async function getTrailers(filters?: { status?: string; limit?: number; offset?: number }) {
  try {
    const permission = await checkViewPermission("vehicles")
    if (!permission.allowed) return { error: permission.error || "You don't have permission to view trailers", data: null, count: 0 }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null, count: 0 }

    let query = supabase
      .from("trailers")
      .select("id, trailer_number, trailer_type, status, make, model, year, current_truck_id, registration_expiry, created_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (filters?.status) query = query.eq("status", filters.status)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      Sentry.captureException(error)
      return { error: "Failed to load trailers", data: null, count: 0 }
    }
    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function getTrailer(id: string) {
  try {
    const permission = await checkViewPermission("vehicles")
    if (!permission.allowed) return { error: permission.error || "You don't have permission to view trailers", data: null }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data, error } = await supabase
      .from("trailers")
      .select(TRAILER_FULL_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      Sentry.captureException(error)
      return { error: "Failed to load trailer", data: null }
    }
    if (!data) return { error: "Trailer not found", data: null }
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function createTrailer(formData: Record<string, any>) {
  const permission = await checkCreatePermission("vehicles")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to create trailers", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const trailerNumber = sanitizeString(formData.trailer_number, 50).toUpperCase()
  const vin = sanitizeString(formData.vin, 17).toUpperCase()
  if (!trailerNumber) return { error: "Trailer number is required", data: null }
  if (!vin || vin.length < 11) return { error: "Valid VIN is required", data: null }

  const { data: existingNumber } = await supabase
    .from("trailers")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("trailer_number", trailerNumber)
    .maybeSingle()
  if (existingNumber) return { error: "Trailer number already exists", data: null }

  const { data: existingVin } = await supabase
    .from("trailers")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("vin", vin)
    .maybeSingle()
  if (existingVin) return { error: "VIN already exists", data: null }

  const payload: Record<string, any> = {
    company_id: ctx.companyId,
    trailer_number: trailerNumber,
    vin,
    trailer_type: formData.trailer_type || "dry_van",
    status: formData.status || "available",
  }

  const stringFields = ["plate_number", "plate_state", "make", "model", "door_type", "current_location"]
  for (const f of stringFields) {
    if (formData[f] !== undefined && formData[f] !== null && String(formData[f]).trim() !== "") {
      payload[f] = sanitizeString(String(formData[f]), 120)
    }
  }
  const numericFields = ["year", "length_ft", "capacity_lbs", "reefer_unit_hours"]
  for (const f of numericFields) {
    if (formData[f] !== undefined && formData[f] !== null && formData[f] !== "") payload[f] = Number(formData[f])
  }
  const dateFields = [
    "last_dot_inspection_date",
    "next_dot_inspection_date",
    "last_brake_inspection_date",
    "last_reefer_service_date",
    "registration_expiry",
  ]
  for (const f of dateFields) {
    if (formData[f]) payload[f] = formData[f]
  }
  if (formData.current_truck_id) payload.current_truck_id = formData.current_truck_id

  const { data, error } = await supabase.from("trailers").insert(payload).select().single()
  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to create trailer", data: null }
  }

  revalidatePath("/dashboard/trailers")
  revalidatePath("/dashboard/trucks")
  return { data, error: null }
}

export async function updateTrailer(id: string, formData: Record<string, any>) {
  const permission = await checkEditPermission("vehicles")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to edit trailers", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const updateData: Record<string, any> = {}
  const fields = [
    "trailer_number",
    "vin",
    "plate_number",
    "plate_state",
    "year",
    "make",
    "model",
    "trailer_type",
    "length_ft",
    "capacity_lbs",
    "door_type",
    "status",
    "current_truck_id",
    "current_location",
    "last_dot_inspection_date",
    "next_dot_inspection_date",
    "last_brake_inspection_date",
    "reefer_unit_hours",
    "last_reefer_service_date",
    "registration_expiry",
  ]
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(formData, field)) {
      const value = formData[field]
      if (["trailer_number", "vin", "plate_number", "plate_state"].includes(field) && typeof value === "string") {
        updateData[field] = sanitizeString(value, 120).toUpperCase()
      } else {
        updateData[field] = value
      }
    }
  }

  const { data, error } = await supabase
    .from("trailers")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to update trailer", data: null }
  }
  revalidatePath("/dashboard/trailers")
  revalidatePath(`/dashboard/trailers/${id}`)
  return { data, error: null }
}

export async function deleteTrailer(id: string) {
  const permission = await checkDeletePermission("vehicles")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to delete trailers" }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }

  const { data: loadRef } = await supabase.from("loads").select("id").eq("company_id", ctx.companyId).eq("trailer_id", id).limit(1)
  if (loadRef && loadRef.length > 0) return { error: "Cannot delete trailer assigned to loads" }

  const { error } = await supabase.from("trailers").delete().eq("id", id).eq("company_id", ctx.companyId)
  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to delete trailer" }
  }
  revalidatePath("/dashboard/trailers")
  return { error: null }
}

export async function bulkDeleteTrailers(ids: string[]) {
  const permission = await checkDeletePermission("vehicles")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to delete trailers", data: null }
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { error } = await supabase.from("trailers").delete().in("id", ids).eq("company_id", ctx.companyId)
  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to delete trailers", data: null }
  }
  revalidatePath("/dashboard/trailers")
  return { data: { deleted: ids.length }, error: null }
}

export async function bulkUpdateTrailerStatus(ids: string[], status: string) {
  const permission = await checkEditPermission("vehicles")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to update trailers", data: null }
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { error } = await supabase.from("trailers").update({ status }).in("id", ids).eq("company_id", ctx.companyId)
  if (error) {
    Sentry.captureException(error)
    return { error: "Failed to update trailer status", data: null }
  }
  revalidatePath("/dashboard/trailers")
  return { data: { updated: ids.length }, error: null }
}
