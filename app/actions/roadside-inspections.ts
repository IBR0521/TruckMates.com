"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { checkCreatePermission, checkDeletePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"
import { createClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/validation"

type RoadsideInspectionLevel = "I" | "II" | "III" | "IV" | "V" | "VI"

const INSPECTION_SELECT = `
  id, company_id, inspection_date, location, inspector_name, level, violations,
  out_of_service, out_of_service_cleared_date, driver_id, truck_id, created_at, updated_at
`

function parseViolations(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((v: unknown) => sanitizeString(String(v), 300))
      .filter((value: string) => value.length > 0)
  }
  return []
}

export async function getRoadsideInspections(filters?: {
  driver_id?: string
  truck_id?: string
  limit?: number
  offset?: number
}) {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null, count: 0 }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null, count: 0 }

    const supabase = await createClient()
    let query = supabase
      .from("roadside_inspections")
      .select(INSPECTION_SELECT, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("inspection_date", { ascending: false })

    if (filters?.driver_id) query = query.eq("driver_id", filters.driver_id)
    if (filters?.truck_id) query = query.eq("truck_id", filters.truck_id)

    const limit = Math.min(filters?.limit || 200, 500)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return { error: "Failed to load roadside inspections", data: null, count: 0 }
    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load roadside inspections"), data: null, count: 0 }
  }
}

export async function createRoadsideInspection(formData: {
  inspection_date: string
  location?: string
  inspector_name?: string
  level: RoadsideInspectionLevel
  violations?: string[]
  out_of_service?: boolean
  out_of_service_cleared_date?: string
  driver_id?: string
  truck_id?: string
}) {
  try {
    const permission = await checkCreatePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }
    if (!formData.inspection_date) return { error: "Inspection date is required", data: null }
    if (!formData.level) return { error: "Inspection level is required", data: null }

    const supabase = await createClient()
    const payload = {
      company_id: ctx.companyId,
      inspection_date: formData.inspection_date,
      location: formData.location ? sanitizeString(formData.location, 200) : null,
      inspector_name: formData.inspector_name ? sanitizeString(formData.inspector_name, 120) : null,
      level: formData.level,
      violations: parseViolations(formData.violations),
      out_of_service: Boolean(formData.out_of_service),
      out_of_service_cleared_date: formData.out_of_service_cleared_date || null,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
    }

    const { data, error } = await supabase.from("roadside_inspections").insert(payload).select(INSPECTION_SELECT).single()
    if (error) return { error: "Failed to create roadside inspection", data: null }

    revalidatePath("/dashboard/compliance")
    if (payload.driver_id) revalidatePath(`/dashboard/drivers/${payload.driver_id}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create roadside inspection"), data: null }
  }
}

export async function updateRoadsideInspection(
  id: string,
  formData: Partial<{
    inspection_date: string
    location: string
    inspector_name: string
    level: RoadsideInspectionLevel
    violations: string[]
    out_of_service: boolean
    out_of_service_cleared_date: string
    driver_id: string
    truck_id: string
  }>,
) {
  try {
    const permission = await checkEditPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const updateData: Record<string, unknown> = {}
    if (formData.inspection_date !== undefined) updateData.inspection_date = formData.inspection_date
    if (formData.location !== undefined) updateData.location = formData.location ? sanitizeString(formData.location, 200) : null
    if (formData.inspector_name !== undefined) updateData.inspector_name = formData.inspector_name ? sanitizeString(formData.inspector_name, 120) : null
    if (formData.level !== undefined) updateData.level = formData.level
    if (formData.violations !== undefined) updateData.violations = parseViolations(formData.violations)
    if (formData.out_of_service !== undefined) updateData.out_of_service = formData.out_of_service
    if (formData.out_of_service_cleared_date !== undefined) updateData.out_of_service_cleared_date = formData.out_of_service_cleared_date || null
    if (formData.driver_id !== undefined) updateData.driver_id = formData.driver_id || null
    if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null

    if (Object.keys(updateData).length === 0) return { error: "No changes provided", data: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("roadside_inspections")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select(INSPECTION_SELECT)
      .single()

    if (error) return { error: "Failed to update roadside inspection", data: null }
    revalidatePath("/dashboard/compliance")
    if (data?.driver_id) revalidatePath(`/dashboard/drivers/${data.driver_id}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update roadside inspection"), data: null }
  }
}

export async function deleteRoadsideInspection(id: string) {
  try {
    const permission = await checkDeletePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied" }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }

    const supabase = await createClient()
    const { data: current } = await supabase
      .from("roadside_inspections")
      .select("id, driver_id")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    const { error } = await supabase.from("roadside_inspections").delete().eq("id", id).eq("company_id", ctx.companyId)
    if (error) return { error: "Failed to delete roadside inspection" }

    revalidatePath("/dashboard/compliance")
    if (current?.driver_id) revalidatePath(`/dashboard/drivers/${current.driver_id}`)
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete roadside inspection") }
  }
}

export async function getDriverRoadsideInspectionStats(driverId: string) {
  try {
    const permission = await checkViewPermission("drivers")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("roadside_inspections")
      .select("id, out_of_service, violations")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .limit(5000)

    if (error) return { error: "Failed to load driver inspection stats", data: null }

    const totalInspections = (data || []).length
    const oosCount = (data || []).filter((r: { out_of_service?: boolean | null }) => Boolean(r.out_of_service)).length
    const violationCount = (data || []).reduce((sum: number, r: { violations?: unknown }) => {
      const count = Array.isArray(r.violations) ? r.violations.length : 0
      return sum + count
    }, 0)
    const oosRate = totalInspections > 0 ? (oosCount / totalInspections) * 100 : 0

    return {
      data: {
        total_inspections: totalInspections,
        oos_rate: oosRate,
        violation_count: violationCount,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load driver inspection stats"), data: null }
  }
}

