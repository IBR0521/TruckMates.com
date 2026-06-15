"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { requirePlanFeature } from "@/lib/plan-feature-guard"
import { checkViewPermission } from "@/lib/server-permissions"

export async function getHazmatLoads() {
  const permission = await checkViewPermission("loads")
  if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const planError = await requirePlanFeature(ctx.companyId, "hazmat_module")
  if (planError) return { error: planError, data: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, shipment_number, status, origin, destination, driver_id, un_number, hazard_class, proper_shipping_name, drivers(name, license_endorsements)",
    )
    .eq("company_id", ctx.companyId)
    .eq("is_hazardous", true)
    .in("status", ["pending", "confirmed", "scheduled", "in_transit"])
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) return { error: error.message, data: null }
  return { data: data || [], error: null }
}
