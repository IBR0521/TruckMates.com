import { runAgentEvaluation } from "@/lib/ai/agent/loop"
import { createAdminClient } from "@/lib/supabase/admin"
import type { DailyRemainingHosResult } from "@/lib/hos/compute-daily-remaining"

type Severity = "critical" | "high" | "medium"

const LOOKBACK_ISO_MINUTES = 30

function classifyDriveRemainingHours(h: number | null): Severity | null {
  if (h === null || !Number.isFinite(h)) return null
  if (h < 0.5) return "critical"
  if (h < 1) return "high"
  if (h < 2) return "medium"
  return null
}

function extractRecentHosDedupeKeys(
  rows: Array<{ action_payload: Record<string, unknown> | null }> | null,
): Set<string> {
  const skip = new Set<string>()
  for (const row of rows || []) {
    const payload = row.action_payload || {}
    const triggerData = payload.triggerData
    let driverId = ""
    let severity = ""
    if (triggerData && typeof triggerData === "object") {
      const td = triggerData as Record<string, unknown>
      driverId = String(td.driverId || td.driver_id || "")
      severity = String(td.severity || "").toLowerCase()
    }
    if (!driverId) {
      const apAction = payload.action as Record<string, unknown> | undefined
      const sub = apAction?.payload as Record<string, unknown> | undefined
      driverId = String(
        sub?.driverId || sub?.driver_id || payload.driverId || payload.driver_id || "",
      )
      severity = String(sub?.severity || payload.severity || "").toLowerCase()
    }
    if (driverId && severity && (severity === "critical" || severity === "high" || severity === "medium")) {
      skip.add(`${driverId}:${severity}`)
    }
  }
  return skip
}

function formatLocation(
  addr: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  const a = String(addr || "").trim()
  if (a) return a
  if (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
  return null
}

export function hosSummaryHasActiveViolation(summary: DailyRemainingHosResult): boolean {
  return summary.violations.length > 0
}

export function hosSeverityFromSummary(summary: DailyRemainingHosResult): Severity | null {
  return classifyDriveRemainingHours(summary.remainingDriving)
}

/**
 * Fires the same HOS prevention alert used by scan-hos-violations (deduped per driver/severity).
 */
export async function fireHosViolationAlertIfNeeded(params: {
  companyId: string
  driverId: string
  summary: DailyRemainingHosResult
}): Promise<boolean> {
  const { companyId, driverId, summary } = params
  if (!hosSummaryHasActiveViolation(summary) && !summary.needsBreak) {
    return false
  }

  const severity: Severity =
    hosSeverityFromSummary(summary) || (summary.needsBreak ? "medium" : "high")

  if (!severity) return false

  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - LOOKBACK_ISO_MINUTES * 60 * 1000).toISOString()

  const { data: recentLogsDup } = await admin
    .from("ai_automation_logs")
    .select("action_payload")
    .eq("company_id", companyId)
    .eq("automation_type", "hos_violation_prevention")
    .gte("created_at", sinceIso)
    .limit(200)

  const dedupe = extractRecentHosDedupeKeys(
    (recentLogsDup || []) as Array<{ action_payload: Record<string, unknown> | null }>,
  )
  const dedupeKey = `${driverId}:${severity}`
  if (dedupe.has(dedupeKey)) return false

  let locRows: {
    driver_id: string
    address: string | null
    latitude: number | null
    longitude: number | null
  }[] = []

  try {
    const rpc = await admin.rpc("get_latest_eld_locations_for_drivers", {
      p_company_id: companyId,
      p_driver_ids: [driverId],
    })
    if (!rpc.error && Array.isArray(rpc.data)) {
      locRows = rpc.data as typeof locRows
    }
  } catch {
    // optional RPC
  }

  const loc = locRows.find((r) => String(r.driver_id) === driverId)

  const { data: activeLoadsRaw } = await admin
    .from("loads")
    .select("id, destination, shipment_number, driver_id, updated_at")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .in("status", ["pending", "scheduled", "confirmed", "in_transit"])
    .order("updated_at", { ascending: false })
    .limit(1)

  const ld = activeLoadsRaw?.[0] as
    | { id: string; destination: string | null; shipment_number: string | null }
    | undefined

  const { data: driversMeta } = await admin
    .from("drivers")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("id", driverId)
    .maybeSingle()

  const driverName = String((driversMeta as { name?: string } | null)?.name || "").trim() || "Driver"

  await runAgentEvaluation({
    companyId,
    trigger: "hos_violation_prevention",
    triggerData: {
      driverId,
      driverName,
      currentLocation: formatLocation(loc?.address ?? null, loc?.latitude ?? null, loc?.longitude ?? null),
      remainingDriveHours: Number(summary.remainingDriving.toFixed(3)),
      remainingOnDutyHours: Number(summary.remainingOnDuty.toFixed(3)),
      severity,
      currentLoadId: ld?.id || null,
      currentLoadDestination: ld?.destination || null,
      shipmentNumber: ld?.shipment_number || null,
    },
    contextTypes: ["driver", "load"],
  })

  return true
}
