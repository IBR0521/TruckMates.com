import { runAgentEvaluation } from "@/lib/ai/agent/loop"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEDUPE_LOOKBACK_MS,
  DWELL_LOOKBACK_MS,
  buildMaxDetentionTierByLoad,
  evaluateLoadDetention,
  fetchCustomerDetentionDefaults,
  shouldFireDetentionAlert,
  type DetentionLoadRow,
  type EldLocPoint,
} from "@/lib/detention/dwell-scan"

export async function fireDetentionAlertIfNeeded(params: {
  companyId: string
  load: DetentionLoadRow
  evalResult: NonNullable<Awaited<ReturnType<typeof evaluateLoadDetention>>>
}): Promise<boolean> {
  const admin = createAdminClient()
  const dedupeSince = new Date(Date.now() - DEDUPE_LOOKBACK_MS).toISOString()

  const { data: recentLogsRaw } = await admin
    .from("ai_automation_logs")
    .select("action_payload, triggered")
    .eq("company_id", params.companyId)
    .eq("automation_type", "detention_clock")
    .gte("created_at", dedupeSince)
    .order("created_at", { ascending: false })
    .limit(500)

  const maxTierByLoad = buildMaxDetentionTierByLoad(
    (recentLogsRaw || []) as Array<{
      action_payload: Record<string, unknown> | null
      triggered: boolean | null
    }>,
  )

  const maxTierLastHour = maxTierByLoad.get(params.load.id)
  if (
    !shouldFireDetentionAlert(params.load.id, params.evalResult.excessMinutes, maxTierLastHour)
  ) {
    return false
  }

  const estimatedDetentionFee =
    Math.round((params.evalResult.excessMinutes / 60) * params.evalResult.hourlyRate * 100) / 100

  await runAgentEvaluation({
    companyId: params.companyId,
    trigger: "detention_clock",
    triggerData: {
      loadId: params.load.id,
      shipmentNumber: params.load.shipment_number ?? null,
      truckId: params.load.truck_id ?? null,
      driverId: params.load.driver_id ?? null,
      locationType: params.evalResult.locationType,
      locationName: params.evalResult.locationName,
      minutesStationary: Math.round(params.evalResult.minutesStationary),
      freeTimeMinutes: params.evalResult.freeMinutes,
      excessMinutes: params.evalResult.excessMinutes,
      estimatedDetentionFee,
    },
    contextTypes: ["load", "driver"],
  })

  return true
}

export async function loadEldPointsForTruck(
  companyId: string,
  truckId: string,
): Promise<EldLocPoint[]> {
  const admin = createAdminClient()
  const locationsSince = new Date(Date.now() - DWELL_LOOKBACK_MS).toISOString()
  const { data } = await admin
    .from("eld_locations")
    .select("id, truck_id, latitude, longitude, timestamp")
    .eq("company_id", companyId)
    .eq("truck_id", truckId)
    .gte("timestamp", locationsSince)
    .order("timestamp", { ascending: true })
    .limit(12000)

  return (data || []) as EldLocPoint[]
}

export async function evaluateDetentionForLoadId(loadId: string) {
  const admin = createAdminClient()
  const { data: load } = await admin
    .from("loads")
    .select(
      "id, company_id, status, truck_id, driver_id, shipment_number, customer_id, origin, destination, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, shipper_latitude, shipper_longitude, consignee_latitude, consignee_longitude",
    )
    .eq("id", loadId)
    .maybeSingle()

  if (!load) return null

  const row = load as DetentionLoadRow
  const truckId = String(row.truck_id || "").trim()
  if (!truckId) return null

  const points = await loadEldPointsForTruck(row.company_id, truckId)
  const pointsByTruck = new Map<string, EldLocPoint[]>([[truckId, points]])
  const customerDefaults = await fetchCustomerDetentionDefaults(admin, row.company_id, [
    String(row.customer_id || "").trim(),
  ].filter(Boolean))

  const evalResult = await evaluateLoadDetention(row, customerDefaults, pointsByTruck)
  return { load: row, evalResult }
}
