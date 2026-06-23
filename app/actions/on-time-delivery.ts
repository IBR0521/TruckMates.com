"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import { computeOnTimeDeliveryByCustomer } from "@/lib/analytics/on-time-delivery"
/**
 * Get on-time delivery analytics by customer
 */
export async function getOnTimeDeliveryAnalytics(filters?: {
  start_date?: string
  end_date?: string
  customer_id?: string
}) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
  }

  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const result = await computeOnTimeDeliveryByCustomer(supabase, ctx.companyId, filters)

    if (result.error || !result.data) {
      return { error: result.error || "Failed to get on-time delivery analytics", data: null }
    }

    return { data: result.data, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get on-time delivery analytics"), data: null }
  }
}

