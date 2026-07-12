// NOT a "use server" module (F9): these are cron workers that take a companyId and run on the
// service-role admin client. As server actions, any authenticated user could invoke them for an
// arbitrary company (cross-tenant side effects). Imported only by cron routes / the agent executor.

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/app/actions/notifications"
import {
  deliveryDelayHoursLate,
  filterDelayedLoads,
  type DelayedLoadRow,
} from "@/lib/delivery-delay-scan"
import { batchOperations } from "@/lib/performance"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])
const DEDUPE_HOURS = 12

async function wasRecentlyNotified(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  loadId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since)
    .filter("metadata->>event", "eq", "delivery_delay")
    .filter("metadata->>load_id", "eq", loadId)
  return (count ?? 0) > 0
}

/**
 * Scan one company for past-due in-transit/scheduled loads and notify managers when enabled.
 */
export async function scanDeliveryDelaysForCompany(companyId: string): Promise<{
  data: { notified: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from("company_settings")
    .select("notify_on_delivery_delay")
    .eq("company_id", companyId)
    .maybeSingle()

  if (settings?.notify_on_delivery_delay === false) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const { data: loads, error: loadsError } = await admin
    .from("loads")
    .select("id, company_id, shipment_number, origin, destination, status, estimated_delivery, driver_id")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "in_transit"])
    .not("estimated_delivery", "is", null)

  if (loadsError) {
    return { data: null, error: loadsError.message || "Failed to scan loads" }
  }

  const delayed = filterDelayedLoads((loads || []) as DelayedLoadRow[])
  if (delayed.length === 0) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const { data: managers } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager"])

  const managerIds = (managers || [])
    .filter((u: { role?: string | null }) => MANAGER_ROLES.has(String(u.role || "")))
    .map((u: { id: string }) => u.id)

  if (managerIds.length === 0) {
    return { data: { notified: 0, scanned: delayed.length }, error: null }
  }

  let notified = 0
  for (const load of delayed) {
    if (await wasRecentlyNotified(admin, companyId, load.id)) continue

    const hoursLate = deliveryDelayHoursLate(load.estimated_delivery)
    const label = load.shipment_number || load.id
    const routeLabel = [load.origin, load.destination].filter(Boolean).join(" → ") || "Unknown lane"

    for (const userId of managerIds) {
      await sendNotification(userId, "load_update", {
        company_id: companyId,
        shipmentNumber: label,
        title: `Delivery delay: ${label}`,
        status: String(load.status || "in_transit"),
        priority: hoursLate >= 24 ? "high" : "medium",
        event: "delivery_delay",
        load_id: load.id,
        hours_late: hoursLate,
        message: `Load ${label} is ${hoursLate}h past estimated delivery (${routeLabel}).`,
      })
    }
    notified += 1
  }

  return { data: { notified, scanned: delayed.length }, error: null }
}

/** Cron entry: scan all companies for delivery delays. */
export async function scanAllDeliveryDelays(): Promise<{
  data: { companies: number; notified: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: companies, error } = await admin.from("companies").select("id").limit(5000)
  if (error) {
    return { data: null, error: error.message || "Failed to list companies" }
  }

  const companyIds = (companies || [])
    .map((row) => String(row.id || ""))
    .filter(Boolean)

  const results = await batchOperations(companyIds, 8, scanDeliveryDelaysForCompany)
  const notified = results.reduce((sum, result) => sum + (result.data?.notified ?? 0), 0)

  return {
    data: { companies: companyIds.length, notified },
    error: null,
  }
}
