import type { SupabaseClient } from "@supabase/supabase-js"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"

const ELD_LOG_DUTY_SELECT = "log_type"

/** Current duty segment: open log today, else latest log today. */
export async function getDriverCurrentDutyLogType(
  admin: SupabaseClient,
  driverId: string,
  companyId: string,
): Promise<string | null> {
  const todayYmd = calendarDateYmdLocal(new Date())

  const { data: open } = await admin
    .from("eld_logs")
    .select(ELD_LOG_DUTY_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", companyId)
    .eq("log_date", todayYmd)
    .is("end_time", null)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open?.log_type) return String(open.log_type)

  const { data: latest } = await admin
    .from("eld_logs")
    .select(ELD_LOG_DUTY_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", companyId)
    .eq("log_date", todayYmd)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle()

  return latest?.log_type ? String(latest.log_type) : null
}

export async function snapshotDriverDutyForEldLogSync(
  admin: SupabaseClient,
  companyId: string,
  logs: Array<{ driver_id: string | null }>,
): Promise<Map<string, string | null>> {
  const driverIds = [
    ...new Set(logs.map((row) => row.driver_id).filter((id): id is string => Boolean(id))),
  ]
  const snapshot = new Map<string, string | null>()
  await Promise.all(
    driverIds.map(async (driverId) => {
      snapshot.set(driverId, await getDriverCurrentDutyLogType(admin, driverId, companyId))
    }),
  )
  return snapshot
}

/** Recompute HOS deadlines only for drivers whose current duty log_type changed after sync. */
export async function recomputeHosDeadlinesAfterEldLogSync(
  admin: SupabaseClient,
  companyId: string,
  before: Map<string, string | null>,
): Promise<void> {
  for (const [driverId, previous] of before) {
    const current = await getDriverCurrentDutyLogType(admin, driverId, companyId)
    if (current === previous) continue
    try {
      const { recomputeDriverHosDeadline } = await import("@/lib/deadlines/recompute-driver-hos-deadline")
      await recomputeDriverHosDeadline(driverId)
    } catch {
      // non-blocking — sweep will catch up
    }
  }
}
