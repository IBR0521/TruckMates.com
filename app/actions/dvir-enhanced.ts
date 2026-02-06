"use server"

/**
 * Enhanced DVIR Features
 * - Automated defect to work order flow
 * - PDF generation for audit readiness
 * - Pre-trip requirement checking
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

/**
 * Check if pre-trip DVIR is required for a truck
 */
export async function checkPreTripDVIRRequired(
  truckId: string,
  date?: string
): Promise<{ data: { required: boolean } | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_pre_trip_dvir_required", {
      p_truck_id: truckId,
      p_date: date || new Date().toISOString().split("T")[0],
    })

    if (error) {
      console.error("[Check Pre-Trip DVIR] Error:", error)
      return { error: error.message, data: null }
    }

    return { data: { required: data || false }, error: null }
  } catch (error: any) {
    console.error("[Check Pre-Trip DVIR] Error:", error)
    return { error: error.message || "Failed to check pre-trip requirement", data: null }
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

  try {
    const { data, error } = await supabase.rpc("get_dvirs_for_audit", {
      p_company_id: result.company_id,
      p_truck_id: filters?.truck_id || null,
      p_start_date: filters?.start_date || null,
      p_end_date: filters?.end_date || null,
    })

    if (error) {
      console.error("[Get DVIRs for Audit] Error:", error)
      return { error: error.message, data: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Get DVIRs for Audit] Error:", error)
    return { error: error.message || "Failed to get DVIRs for audit", data: null }
  }
}

/**
 * Manually trigger work order creation from DVIR defects
 */
export async function createWorkOrdersFromDVIRDefects(
  dvirId: string
): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("create_work_orders_from_dvir_defects", {
      p_dvir_id: dvirId,
    })

    if (error) {
      console.error("[Create Work Orders from DVIR] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/dvir")
    revalidatePath("/dashboard/maintenance/work-orders")

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Create Work Orders from DVIR] Error:", error)
    return { error: error.message || "Failed to create work orders", data: null }
  }
}

/**
 * Get work orders created from a DVIR
 */
export async function getDVIRWorkOrders(
  dvirId: string
): Promise<{ data: any[] | null; error: string | null }> {
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

  try {
    const { data: dvir, error: dvirError } = await supabase
      .from("dvir")
      .select("work_orders_created")
      .eq("id", dvirId)
      .eq("company_id", result.company_id)
      .single()

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
      .eq("company_id", result.company_id)

    if (woError) {
      return { error: woError.message, data: null }
    }

    return { data: workOrders || [], error: null }
  } catch (error: any) {
    console.error("[Get DVIR Work Orders] Error:", error)
    return { error: error.message || "Failed to get work orders", data: null }
  }
}

