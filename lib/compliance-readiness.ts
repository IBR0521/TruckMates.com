import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDailyRemainingFromEldLogs, type EldLogLike } from "@/lib/hos/compute-daily-remaining"
import { isDispatchStatus } from "@/lib/dispatch-gates"

export function driverHasHazmatEndorsement(endorsements: unknown): boolean {
  if (!endorsements) return false
  if (Array.isArray(endorsements)) {
    return endorsements.some((e) => String(e).toUpperCase().includes("H"))
  }
  const normalized = String(endorsements).toUpperCase()
  return normalized.includes("H") || normalized.includes("HAZMAT") || normalized.includes("HAZ MAT")
}

export type HazmatLoadFields = {
  is_hazardous?: boolean | null
  un_number?: string | null
  hazard_class?: string | null
  proper_shipping_name?: string | null
}

/** Returns blocking error for HAZMAT loads at dispatch, or null if OK. */
export async function getHazmatReadinessError(
  supabase: SupabaseClient,
  companyId: string,
  load: HazmatLoadFields,
  driverId?: string | null,
): Promise<string | null> {
  if (!load.is_hazardous) return null

  if (!load.un_number || !load.hazard_class || !load.proper_shipping_name) {
    return "HAZMAT loads require UN number, hazard class, and proper shipping name before dispatch."
  }

  const id = String(driverId ?? "").trim()
  if (!id) {
    return "HAZMAT loads require a driver with HAZMAT endorsement (H) before dispatch."
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("license_endorsements")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!driver || !driverHasHazmatEndorsement(driver.license_endorsements)) {
    return "Assigned driver does not have required HAZMAT endorsement (H)."
  }

  return null
}

/** Returns blocking error when consider_driver_hours is on and driver cannot drive. */
export async function getHosReadinessError(
  supabase: SupabaseClient,
  companyId: string,
  driverId: string | null | undefined,
  considerDriverHours: boolean,
  nextStatus: string,
): Promise<string | null> {
  if (!considerDriverHours) return null
  if (!isDispatchStatus(String(nextStatus || "").toLowerCase())) return null

  const id = String(driverId ?? "").trim()
  if (!id) return null

  const today = new Date().toISOString().split("T")[0]
  const { data: logs } = await supabase
    .from("eld_logs")
    .select("id, log_date, log_type, start_time, end_time, duration_minutes, miles_driven")
    .eq("company_id", companyId)
    .eq("driver_id", id)
    .gte("log_date", today)
    .lte("log_date", today)
    .limit(500)

  const todayLogs = (logs || []).filter((l: { log_date?: string }) => l.log_date === today) as EldLogLike[]
  const computed = computeDailyRemainingFromEldLogs(todayLogs, Date.now(), (logs || []) as EldLogLike[])

  if (!computed.canDrive || computed.violations.length > 0) {
    const detail = computed.violations[0] || "insufficient drive time remaining"
    return `Driver HOS check failed: ${detail}. Enable consider_driver_hours blocks dispatch when driver is out of hours.`
  }

  if (computed.remainingDriving < 2) {
    return "Driver has less than 2 hours of drive time remaining and cannot be dispatched."
  }

  return null
}
