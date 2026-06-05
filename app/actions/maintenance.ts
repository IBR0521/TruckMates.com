"use server"

import { safeDbError } from "@/lib/utils/error"
import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { invalidateAiContextCache } from "@/lib/ai/answer-cache"
import { sanitizeString, validateRequiredString, validateDate, validatePositiveNumber } from "@/lib/validation"
import {
  checkCreatePermission,
  checkEditPermission,
  checkDeletePermission,
  checkViewPermission,
} from "@/lib/server-permissions"

export type MaintenanceCostByServiceType = {
  service_type: string
  actual_total: number
  estimated_total: number
  completed_count: number
  open_count: number
}

export type MaintenanceCostMonth = {
  month: string
  actual_cost: number
}

export type TruckMaintenanceCostSummary = {
  truck_id: string
  truck_number: string | null
  total_actual_cost: number
  total_estimated_cost: number
  completed_count: number
  open_count: number
  total_record_count: number
  cost_per_mile: number | null
  by_service_type: MaintenanceCostByServiceType[]
  monthly_trend: MaintenanceCostMonth[]
}

type MaintenanceCostRow = {
  truck_id: string | null
  service_type: string | null
  status: string | null
  estimated_cost: number | null
  actual_cost: number | null
  completed_date: string | null
  mileage: number | null
}

const OPEN_MAINTENANCE_STATUSES = new Set(["scheduled", "in_progress", "overdue"])

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function monthKey(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function aggregateMaintenanceCosts(
  records: MaintenanceCostRow[],
  truckId: string,
  truckNumber: string | null,
): TruckMaintenanceCostSummary {
  const byService = new Map<string, MaintenanceCostByServiceType>()
  const monthly = new Map<string, number>()
  const mileages: number[] = []

  let totalActual = 0
  let totalEstimated = 0
  let completedCount = 0
  let openCount = 0

  for (const row of records) {
    if (!row.truck_id || row.truck_id !== truckId) continue
    const status = String(row.status || "").toLowerCase()
    const serviceType = row.service_type?.trim() || "Other"

    if (!byService.has(serviceType)) {
      byService.set(serviceType, {
        service_type: serviceType,
        actual_total: 0,
        estimated_total: 0,
        completed_count: 0,
        open_count: 0,
      })
    }
    const svc = byService.get(serviceType)!

    if (status === "completed") {
      const actual = num(row.actual_cost)
      totalActual += actual
      completedCount += 1
      svc.actual_total += actual
      svc.completed_count += 1

      const mk = monthKey(row.completed_date)
      if (mk) {
        monthly.set(mk, (monthly.get(mk) || 0) + actual)
      }
      if (row.mileage != null && num(row.mileage) > 0) {
        mileages.push(num(row.mileage))
      }
    } else if (OPEN_MAINTENANCE_STATUSES.has(status)) {
      const estimated = num(row.estimated_cost)
      totalEstimated += estimated
      openCount += 1
      svc.estimated_total += estimated
      svc.open_count += 1
    }
  }

  let costPerMile: number | null = null
  if (mileages.length >= 2 && totalActual > 0) {
    const minM = Math.min(...mileages)
    const maxM = Math.max(...mileages)
    const milesCovered = maxM - minM
    if (milesCovered > 0) {
      costPerMile = totalActual / milesCovered
    }
  }

  const monthly_trend = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, actual_cost]) => ({ month, actual_cost }))

  const by_service_type = [...byService.values()].sort(
    (a, b) => b.actual_total + b.estimated_total - (a.actual_total + a.estimated_total),
  )

  return {
    truck_id: truckId,
    truck_number: truckNumber,
    total_actual_cost: totalActual,
    total_estimated_cost: totalEstimated,
    completed_count: completedCount,
    open_count: openCount,
    total_record_count: completedCount + openCount,
    cost_per_mile: costPerMile,
    by_service_type,
    monthly_trend,
  }
}
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
        "id, company_id, truck_id, trailer_id, service_type, scheduled_date, completed_date, status, priority, estimated_cost, actual_cost, vendor, mileage, created_at",
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
      return { error: safeDbError(error), data: null, count: 0 }
    }

    return { data: maintenance || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function createMaintenance(formData: {
  truck_id?: string
  trailer_id?: string
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

  if (!formData.truck_id && !formData.trailer_id) {
    return { error: "Truck or trailer is required", data: null }
  }
  if (formData.truck_id && formData.trailer_id) {
    return { error: "Maintenance can target either a truck or trailer, not both", data: null }
  }

  // Validate asset ownership
  if (formData.truck_id) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id")
      .eq("id", formData.truck_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (truckError || !truck) {
      return { error: "Truck not found or does not belong to your company", data: null }
    }
  }

  if (formData.trailer_id) {
    const { data: trailer, error: trailerError } = await supabase
      .from("trailers")
      .select("id")
      .eq("id", formData.trailer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (trailerError || !trailer) {
      return { error: "Trailer not found or does not belong to your company", data: null }
    }
  }

  // Validate and sanitize input
  if (formData.truck_id && !validateRequiredString(formData.truck_id, 1, 100)) {
    return { error: "Truck ID is invalid", data: null }
  }
  if (formData.trailer_id && !validateRequiredString(formData.trailer_id, 1, 100)) {
    return { error: "Trailer ID is invalid", data: null }
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
      truck_id: formData.truck_id ? sanitizeString(formData.truck_id, 100) : null,
      trailer_id: formData.trailer_id ? sanitizeString(formData.trailer_id, 100) : null,
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
    return { error: safeDbError(error), data: null }
  }

    void invalidateAiContextCache(ctx.companyId, "maintenance")
    revalidatePath("/dashboard/maintenance")
    
    // Trigger webhook
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(ctx.companyId, "maintenance.scheduled", {
        maintenance_id: data.id,
      truck_id: formData.truck_id || null,
      trailer_id: formData.trailer_id || null,
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

/** Service-role insert for cron / background jobs. Validates asset belongs to `companyId`. */
export async function createMaintenanceAdmin(
  companyId: string,
  formData: {
    truck_id?: string
    trailer_id?: string
    service_type: string
    scheduled_date: string
    current_mileage?: number
    priority?: string
    estimated_cost?: number
    notes?: string
    vendor?: string
  },
) {
  try {
    const admin = createAdminClient()
    const cid = String(companyId || "").trim()
    if (!cid) return { error: "companyId is required", data: null }

    if (!formData.truck_id && !formData.trailer_id) {
      return { error: "Truck or trailer is required", data: null }
    }
    if (formData.truck_id && formData.trailer_id) {
      return { error: "Maintenance can target either a truck or trailer, not both", data: null }
    }

    if (formData.truck_id) {
      const { data: truck, error: truckError } = await admin
        .from("trucks")
        .select("id")
        .eq("id", formData.truck_id)
        .eq("company_id", cid)
        .maybeSingle()
      if (truckError || !truck) {
        return { error: "Truck not found or does not belong to company", data: null }
      }
    }

    if (formData.trailer_id) {
      const { data: trailer, error: trailerError } = await admin
        .from("trailers")
        .select("id")
        .eq("id", formData.trailer_id)
        .eq("company_id", cid)
        .maybeSingle()
      if (trailerError || !trailer) {
        return { error: "Trailer not found or does not belong to company", data: null }
      }
    }

    if (formData.truck_id && !validateRequiredString(formData.truck_id, 1, 100)) {
      return { error: "Truck ID is invalid", data: null }
    }
    if (formData.trailer_id && !validateRequiredString(formData.trailer_id, 1, 100)) {
      return { error: "Trailer ID is invalid", data: null }
    }
    if (!validateRequiredString(formData.service_type, 1, 100)) {
      return { error: "Service type is required and must be between 1 and 100 characters", data: null }
    }
    if (!validateDate(formData.scheduled_date)) {
      return { error: "Invalid scheduled date format (use YYYY-MM-DD)", data: null }
    }

    const sanitizedServiceType = sanitizeString(formData.service_type, 100)
    const sanitizedPriority = formData.priority ? sanitizeString(formData.priority, 20) : "normal"
    const sanitizedNotes = formData.notes ? sanitizeString(formData.notes, 2000) : null
    const sanitizedVendor = formData.vendor ? sanitizeString(formData.vendor, 200) : null

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

    const { data, error } = await admin
      .from("maintenance")
      .insert({
        company_id: cid,
        truck_id: formData.truck_id ? sanitizeString(formData.truck_id, 100) : null,
        trailer_id: formData.trailer_id ? sanitizeString(formData.trailer_id, 100) : null,
        service_type: sanitizedServiceType,
        scheduled_date: formData.scheduled_date,
        mileage: formData.current_mileage ? Number(formData.current_mileage) : null,
        priority: sanitizedPriority,
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : null,
        notes: sanitizedNotes,
        vendor: sanitizedVendor,
        status: "scheduled",
      })
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    void invalidateAiContextCache(cid, "maintenance")
    revalidatePath("/dashboard/maintenance")
    try {
      const { triggerWebhook } = await import("./webhooks")
      await triggerWebhook(cid, "maintenance.scheduled", {
        maintenance_id: data.id,
        truck_id: formData.truck_id || null,
        trailer_id: formData.trailer_id || null,
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
      ),
      trailer:trailer_id (
        id,
        trailer_number,
        trailer_type,
        year
      )
    `)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    return { error: safeDbError(error), data: null }
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

  const updateData: Record<string, unknown> = {
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
    return { error: safeDbError(error), data: null }
  }

  void invalidateAiContextCache(ctx.companyId, "maintenance")
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
    return { error: safeDbError(error) }
  }

  void invalidateAiContextCache(ctx.companyId, "maintenance")
  revalidatePath("/dashboard/maintenance")
  return { error: null }
}

/** Read-only maintenance spend aggregates — actual (completed) vs estimated (open) kept separate. */
export async function getTruckMaintenanceCostHistory(truckId?: string): Promise<{
  data: {
    truck: TruckMaintenanceCostSummary | null
    fleet: TruckMaintenanceCostSummary[]
  } | null
  error: string | null
}> {
  const permission = await checkViewPermission("maintenance")
  if (!permission.allowed) {
    return {
      error: permission.error || "You don't have permission to view maintenance",
      data: null,
    }
  }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    let maintQuery = supabase
      .from("maintenance")
      .select(
        "truck_id, service_type, status, estimated_cost, actual_cost, completed_date, mileage",
      )
      .eq("company_id", ctx.companyId)
      .not("truck_id", "is", null)

    if (truckId) {
      const { data: truck } = await supabase
        .from("trucks")
        .select("id")
        .eq("id", truckId)
        .eq("company_id", ctx.companyId)
        .maybeSingle()
      if (!truck) {
        return { error: "Truck not found", data: null }
      }
      maintQuery = maintQuery.eq("truck_id", truckId)
    }

    const { data: rows, error: mErr } = await maintQuery
    if (mErr) {
      return { error: safeDbError(mErr), data: null }
    }

    const records = (rows ?? []) as MaintenanceCostRow[]

    const { data: trucks } = await supabase
      .from("trucks")
      .select("id, truck_number")
      .eq("company_id", ctx.companyId)

    const truckNumberMap = new Map<string, string | null>()
    for (const t of trucks ?? []) {
      const row = t as { id: string; truck_number?: string | null }
      truckNumberMap.set(row.id, row.truck_number ?? null)
    }

    if (truckId) {
      const summary = aggregateMaintenanceCosts(
        records,
        truckId,
        truckNumberMap.get(truckId) ?? null,
      )
      return { data: { truck: summary, fleet: [] }, error: null }
    }

    const truckIds = new Set<string>()
    for (const r of records) {
      if (r.truck_id) truckIds.add(r.truck_id)
    }

    const fleet: TruckMaintenanceCostSummary[] = []
    for (const tid of truckIds) {
      fleet.push(
        aggregateMaintenanceCosts(records, tid, truckNumberMap.get(tid) ?? null),
      )
    }

    fleet.sort((a, b) => b.total_actual_cost - a.total_actual_cost)

    return { data: { truck: null, fleet }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load maintenance cost history"), data: null }
  }
}

