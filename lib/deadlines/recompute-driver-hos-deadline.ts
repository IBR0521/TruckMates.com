import { createAdminClient } from "@/lib/supabase/admin"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import {
  computeDailyRemainingFromEldLogs,
  computeNextHosDeadlineFromEldLogs,
  getEightCalendarDayWindowYmd,
  type EldLogLike,
} from "@/lib/hos/compute-daily-remaining"
import { clearDeadline, upsertDeadline } from "@/lib/deadlines/scheduled-deadlines"

const ELD_LOG_SELECT = "log_type, start_time, end_time, duration_minutes, log_date"

export async function recomputeDriverHosDeadline(driverId: string): Promise<void> {
  const admin = createAdminClient()
  const now = new Date()
  const nowMs = now.getTime()
  const todayYmd = calendarDateYmdLocal(now)
  const { minYmd } = getEightCalendarDayWindowYmd(todayYmd)

  const { data: driver } = await admin
    .from("drivers")
    .select("id, company_id")
    .eq("id", driverId)
    .maybeSingle()

  if (!driver?.company_id) return

  const { data: todayLogs } = await admin
    .from("eld_logs")
    .select(ELD_LOG_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", driver.company_id)
    .eq("log_date", todayYmd)
    .order("start_time", { ascending: true })

  const { data: weekLogs } = await admin
    .from("eld_logs")
    .select(ELD_LOG_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", driver.company_id)
    .gte("log_date", minYmd)
    .lte("log_date", todayYmd)
    .order("start_time", { ascending: true })

  const today = (todayLogs || []) as EldLogLike[]
  const week = (weekLogs || []) as EldLogLike[]
  const next = computeNextHosDeadlineFromEldLogs(today, nowMs, week)

  if (next.kind === "clear") {
    await clearDeadline("driver_hos", driverId)
    return
  }

  if (next.kind === "violated_now") {
    await upsertDeadline("driver_hos", driverId, now, next.reason)
    return
  }

  await upsertDeadline("driver_hos", driverId, next.deadlineAt, next.reason)
}

export async function fetchDriverHosSnapshot(driverId: string, companyId: string) {
  const admin = createAdminClient()
  const nowMs = Date.now()
  const todayYmd = calendarDateYmdLocal(new Date(nowMs))
  const { minYmd } = getEightCalendarDayWindowYmd(todayYmd)

  const { data: todayLogs } = await admin
    .from("eld_logs")
    .select(ELD_LOG_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", companyId)
    .eq("log_date", todayYmd)
    .order("start_time", { ascending: true })

  const { data: weekLogs } = await admin
    .from("eld_logs")
    .select(ELD_LOG_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", companyId)
    .gte("log_date", minYmd)
    .lte("log_date", todayYmd)
    .order("start_time", { ascending: true })

  const today = (todayLogs || []) as EldLogLike[]
  const week = (weekLogs || []) as EldLogLike[]
  return {
    summary: computeDailyRemainingFromEldLogs(today, nowMs, week),
    next: computeNextHosDeadlineFromEldLogs(today, nowMs, week),
  }
}
