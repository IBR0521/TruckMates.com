"use server"

/**
 * Enhanced DVIR Features
 * - Automated defect to work order flow
 * - PDF generation for audit readiness
 * - Pre-trip requirement checking
 */

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import { checkCreatePermission } from "@/lib/server-permissions"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Check if pre-trip DVIR is required for a truck
 */
export async function checkPreTripDVIRRequired(
  truckId: string,
  date?: string
): Promise<{ data: { required: boolean } | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Validate truck_id ownership
  const { data: truck, error: truckError } = await supabase
    .from("trucks")
    .select("id")
    .eq("id", truckId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (truckError || !truck) {
    return { error: "Truck not found or does not belong to your company", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_pre_trip_dvir_required", {
      p_truck_id: truckId,
      p_date: date || new Date().toISOString().split("T")[0],
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
    }

    return { data: { required: data || false }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to check pre-trip requirement"
    return { error: message, data: null }
  }
}

/**
 * Get DVIRs formatted for audit PDF generation
 */
export async function getDVIRsForAudit(filters?: {
  truck_id?: string
  start_date?: string
  end_date?: string
}): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  /** Drivers use scoped DVIR list; fleet roles keep full audit export access. */
  if (ctx.user && mapLegacyRole(ctx.user.role) === "driver") {
    return {
      error: "Fleet audit export is not available on the driver account. Use DVIR reports for your inspections.",
      data: null,
    }
  }

  try {
    const { data, error } = await supabase.rpc("get_dvirs_for_audit", {
      p_company_id: ctx.companyId,
      p_truck_id: filters?.truck_id || null,
      p_start_date: filters?.start_date || null,
      p_end_date: filters?.end_date || null,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
    }

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to get DVIRs for audit"
    return { error: message, data: null }
  }
}

/**
 * Manually trigger work order creation from DVIR defects
 */
export async function createWorkOrdersFromDVIRDefects(
  dvirId: string
): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create work orders", data: null }
  }

  // Validate dvirId ownership
  const { data: dvir, error: dvirError } = await supabase
    .from("dvir")
    .select("id, company_id")
    .eq("id", dvirId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (dvirError || !dvir) {
    return { error: "DVIR not found or does not belong to your company", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("create_work_orders_from_dvir_defects", {
      p_dvir_id: dvirId,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/dvir")
    revalidatePath(`/dashboard/dvir/${dvirId}`)
    revalidatePath("/dashboard/maintenance/work-orders")

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to create work orders"
    return { error: message, data: null }
  }
}

/**
 * Get work orders created from a DVIR
 */
export async function getDVIRWorkOrders(
  dvirId: string
): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: dvir, error: dvirError } = await supabase
      .from("dvir")
      .select("work_orders_created")
      .eq("id", dvirId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (dvirError || !dvir) {
      return { error: "DVIR not found", data: null }
    }

    const workOrderIds = ((dvir.work_orders_created as any[]) || [])
      .map((wo: any) => wo.work_order_id)
      .filter((id: string) => id)

    if (workOrderIds.length === 0) {
      return { data: [], error: null }
    }

    const { data: workOrders, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        maintenance:maintenance_id (
          id,
          service_type
        )
      `)
      .in("id", workOrderIds)
      .eq("company_id", ctx.companyId)

    if (woError) {
      return { error: woError.message, data: null }
    }

    return { data: workOrders || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to get work orders"
    return { error: message, data: null }
  }
}

/**
 * Trucks with DVIRs that have open defects (not corrected), recent window (default 2 days).
 * One row per truck with aggregated defect counts and max inspection date.
 */
export async function getTrucksWithUnresolvedDVIRDefects(sinceDays = 2): Promise<{
  data: Array<{
    truck_id: string
    truck_number: string | null
    dvir_count: number
    defect_item_count: number
    last_inspection_date: string | null
    highest_severity: "critical" | "major" | "minor" | "other"
  }> | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const since = new Date()
    since.setDate(since.getDate() - sinceDays)
    const sinceStr = since.toISOString().split("T")[0]

    const { data: rows, error } = await supabase
      .from("dvir")
      .select(
        `
        id,
        inspection_date,
        defects_found,
        status,
        defects,
        truck_id,
        trucks:truck_id ( id, truck_number )
      `,
      )
      .eq("company_id", ctx.companyId)
      .eq("defects_found", true)
      .neq("status", "defects_corrected")
      .gte("inspection_date", sinceStr)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    const rank = (s: string) => {
      const x = s.toLowerCase()
      if (x === "critical") return 4
      if (x === "major") return 3
      if (x === "minor") return 2
      return 1
    }

    const byTruck = new Map<
      string,
      {
        truck_id: string
        truck_number: string | null
        dvir_count: number
        defect_item_count: number
        last_inspection_date: string | null
        highest_severity: "critical" | "major" | "minor" | "other"
      }
    >()

    for (const row of rows || []) {
      const tid = row.truck_id as string | null
      if (!tid) continue

      const truckNum = (row.trucks as { truck_number?: string | null } | null)?.truck_number ?? null
      const defects = Array.isArray(row.defects) ? row.defects : []
      let high: "critical" | "major" | "minor" | "other" = "other"
      let highScore = 0
      for (const d of defects) {
        const sev = String((d as { severity?: string }).severity || "").toLowerCase()
        const sc =
          sev === "critical"
            ? 4
            : sev === "major"
              ? 3
              : sev === "minor"
                ? 2
                : 1
        if (sc > highScore) {
          highScore = sc
          high =
            sev === "critical"
              ? "critical"
              : sev === "major"
                ? "major"
                : sev === "minor"
                  ? "minor"
                  : "other"
        }
      }

      const insp = row.inspection_date as string | null
      const existing = byTruck.get(tid)
      if (!existing) {
        byTruck.set(tid, {
          truck_id: tid,
          truck_number: truckNum,
          dvir_count: 1,
          defect_item_count: defects.length,
          last_inspection_date: insp,
          highest_severity: high,
        })
      } else {
        existing.dvir_count += 1
        existing.defect_item_count += defects.length
        if (insp && (!existing.last_inspection_date || insp > existing.last_inspection_date)) {
          existing.last_inspection_date = insp
        }
        if (rank(high) > rank(existing.highest_severity)) {
          existing.highest_severity = high
        }
      }
    }

    const list = Array.from(byTruck.values()).sort((a, b) => {
      const da = a.last_inspection_date || ""
      const db = b.last_inspection_date || ""
      return db.localeCompare(da)
    })

    return { data: list, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load open defects by truck"), data: null }
  }
}

