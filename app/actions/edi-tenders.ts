"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { requirePlanFeature } from "@/lib/plan-feature-guard"
import { checkViewPermission } from "@/lib/server-permissions"

export async function getEdiTenders() {
  const permission = await checkViewPermission("loads")
  if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const planError = await requirePlanFeature(ctx.companyId, "edi_receiving")
  if (planError) return { error: planError, data: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("edi_load_tenders")
    .select(
      "id, tender_number, shipment_reference, status, shipper_name, consignee_name, pickup_date, delivery_date, weight_lbs, load_id, created_at",
    )
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === "42P01") return { data: [], error: null }
    return { error: error.message, data: null }
  }
  return { data: data || [], error: null }
}
