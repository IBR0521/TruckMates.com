import { createAdminClient } from "@/lib/supabase/admin"

const DEDUP_WINDOW_MS = 60 * 60 * 1000

type DedupParams = {
  companyId: string
  notificationTypes: string[]
  entityMetadataKeys: string[]
  entityId: string
  metadataEvent?: string
}

/**
 * Returns true when an in-app notification for the same entity was created within the last hour.
 */
export async function hasRecentDeadlineSweepNotification(params: DedupParams): Promise<boolean> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()

  for (const metadataKey of params.entityMetadataKeys) {
    let query = admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .gte("created_at", since)
      .in("type", params.notificationTypes)
      .filter(`metadata->>${metadataKey}`, "eq", params.entityId)

    if (params.metadataEvent) {
      query = query.filter("metadata->>event", "eq", params.metadataEvent)
    }

    const { count, error } = await query
    if (error) continue
    if ((count ?? 0) > 0) return true
  }

  return false
}

export const DEADLINE_SWEEP_DEDUP = {
  hos: {
    notificationTypes: ["violation_alert", "load_update"],
    entityMetadataKeys: ["driver_id", "driverId"],
  },
  detention: {
    notificationTypes: ["load_update"],
    entityMetadataKeys: ["load_id", "loadId"],
    metadataEvent: "detention_clock",
  },
  delivery: {
    notificationTypes: ["load_update"],
    entityMetadataKeys: ["load_id", "loadId"],
    metadataEvent: "delivery_delay",
  },
} as const
