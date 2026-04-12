/**
 * Single source of truth for "remaining drive / on-duty" for a calendar day
 * from `eld_logs` rows (same rules as mobile hos-engine daily limits: 11h / 14h).
 * Break rule: FMCSA — 30+ min off-duty/sleeper after 8 *cumulative* driving hours
 * since the last qualifying break (not total daily off-duty).
 * Weekly: simplified 70-hour / 8-day on-duty (driving + on-duty not driving) cap.
 */

import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"

export type EldLogLike = {
  log_type: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  log_date?: string
}

const MAX_DRIVING_HOURS = 11
const MAX_ON_DUTY_HOURS = 14
const MIN_QUALIFYING_BREAK_MINUTES = 30
const MAX_DRIVING_MINUTES_WITHOUT_BREAK = 8 * 60
const MAX_WEEKLY_ON_DUTY_HOURS = 70
const WEEKLY_WINDOW_DAYS = 8

export type DailyRemainingHosResult = {
  drivingHours: number
  onDutyHours: number
  offDutyHours: number
  remainingDriving: number
  remainingOnDuty: number
  needsBreak: boolean
  violations: string[]
  canDrive: boolean
  /** Driving + on-duty (excl. sleeper/off) hours in last 8 calendar days — 70h cap (simplified). */
  weeklyOnDutyHours: number
  remainingWeeklyOnDuty: number
  weeklyCapViolation: boolean
}

/** Last 8 calendar days inclusive of `endYmd` (for 70-hour / 8-day roll-up). */
export function getEightCalendarDayWindowYmd(endYmd: string): { minYmd: string; maxYmd: string } {
  const [y, m, d] = endYmd.split("-").map((x) => parseInt(x, 10))
  if (!y || !m || !d) {
    return { minYmd: endYmd, maxYmd: endYmd }
  }
  const end = new Date(y, m - 1, d)
  const start = new Date(end)
  start.setDate(start.getDate() - (WEEKLY_WINDOW_DAYS - 1))
  return { minYmd: calendarDateYmdLocal(start), maxYmd: endYmd }
}

function logDurationMinutes(
  log: EldLogLike,
  idx: number,
  timeline: readonly EldLogLike[],
  nowMs: number,
): number {
  let duration = 0
  const start = log.start_time ? new Date(log.start_time).getTime() : NaN
  const nextStart = timeline[idx + 1]?.start_time ? new Date(timeline[idx + 1].start_time).getTime() : null
  const explicitEnd = log.end_time ? new Date(log.end_time).getTime() : null
  const isOpen = !log.end_time
  if (isOpen && Number.isFinite(start)) {
    const inferredEnd =
      nextStart != null && Number.isFinite(nextStart) && nextStart > start
        ? Math.min(nextStart, nowMs)
        : nowMs
    if (Number.isFinite(inferredEnd) && inferredEnd > start) {
      duration = Math.floor((inferredEnd - start) / 60000)
    }
  } else if (Number.isFinite(start)) {
    duration = log.duration_minutes || 0
    if (!duration) {
      const inferredEnd = explicitEnd ?? nextStart ?? nowMs
      if (Number.isFinite(inferredEnd) && inferredEnd > start) {
        duration = Math.floor((inferredEnd - start) / 60000)
      }
    }
  }
  return Math.max(0, duration)
}

/**
 * @param logsForDay — logs for the **target** calendar day only (or pre-filtered).
 * @param logsForWeekly — optional wider window (e.g. last 8 days) for 70h roll-up; if omitted, weekly fields are 0 / no violation.
 */
export function computeDailyRemainingFromEldLogs(
  logsForDay: readonly EldLogLike[],
  nowMs: number = Date.now(),
  logsForWeekly?: readonly EldLogLike[],
): DailyRemainingHosResult {
  let drivingMinutes = 0
  let onDutyMinutes = 0
  let offDutyMinutes = 0
  let sleeperMinutes = 0

  const timeline = [...logsForDay].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  /** FMCSA: 30+ min off-duty or sleeper resets the 8-hour driving clock. */
  let drivingMinutesSinceQualifyingBreak = 0

  timeline.forEach((log, idx) => {
    const duration = logDurationMinutes(log, idx, timeline, nowMs)
    switch (log.log_type) {
      case "driving":
        drivingMinutes += duration
        onDutyMinutes += duration
        drivingMinutesSinceQualifyingBreak += duration
        break
      case "on_duty":
        onDutyMinutes += duration
        break
      case "off_duty":
        offDutyMinutes += duration
        if (duration >= MIN_QUALIFYING_BREAK_MINUTES) {
          drivingMinutesSinceQualifyingBreak = 0
        }
        break
      case "sleeper_berth":
        sleeperMinutes += duration
        if (duration >= MIN_QUALIFYING_BREAK_MINUTES) {
          drivingMinutesSinceQualifyingBreak = 0
        }
        break
      default:
        break
    }
  })

  const drivingHours = drivingMinutes / 60
  const onDutyHours = onDutyMinutes / 60
  const offDutyHours = (offDutyMinutes + sleeperMinutes) / 60

  const remainingDriving = Math.max(0, MAX_DRIVING_HOURS - drivingHours)
  const remainingOnDuty = Math.max(0, MAX_ON_DUTY_HOURS - onDutyHours)
  const needsBreak = drivingMinutesSinceQualifyingBreak >= MAX_DRIVING_MINUTES_WITHOUT_BREAK

  let weeklyOnDutyHours = 0
  let weeklyCapViolation = false
  const todayYmd = calendarDateYmdLocal(new Date(nowMs))
  const { minYmd, maxYmd } = getEightCalendarDayWindowYmd(todayYmd)

  if (logsForWeekly && logsForWeekly.length > 0) {
    const inWindow = logsForWeekly.filter((l) => {
      const ld = l.log_date
      return ld != null && ld >= minYmd && ld <= maxYmd
    })
    const sorted = [...inWindow].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    )
    let weeklyMin = 0
    sorted.forEach((log, idx) => {
      if (log.log_type !== "driving" && log.log_type !== "on_duty") return
      weeklyMin += logDurationMinutes(log, idx, sorted, nowMs)
    })
    weeklyOnDutyHours = weeklyMin / 60
    weeklyCapViolation = weeklyOnDutyHours > MAX_WEEKLY_ON_DUTY_HOURS
  }

  const remainingWeeklyOnDuty = Math.max(0, MAX_WEEKLY_ON_DUTY_HOURS - weeklyOnDutyHours)

  const violations: string[] = []
  if (drivingHours > MAX_DRIVING_HOURS) {
    violations.push(`Exceeded ${MAX_DRIVING_HOURS}-hour driving limit`)
  }
  if (onDutyHours > MAX_ON_DUTY_HOURS) {
    violations.push(`Exceeded ${MAX_ON_DUTY_HOURS}-hour on-duty limit`)
  }
  if (needsBreak) {
    violations.push("Break required: 30 minutes off-duty or sleeper after 8 hours driving since last qualifying break")
  }
  if (weeklyCapViolation) {
    violations.push(
      `Exceeded ${MAX_WEEKLY_ON_DUTY_HOURS}-hour on-duty limit in last ${WEEKLY_WINDOW_DAYS} days (60/70-hour rule, simplified)`,
    )
  }

  return {
    drivingHours: parseFloat(drivingHours.toFixed(2)),
    onDutyHours: parseFloat(onDutyHours.toFixed(2)),
    offDutyHours: parseFloat(offDutyHours.toFixed(2)),
    remainingDriving: parseFloat(remainingDriving.toFixed(2)),
    remainingOnDuty: parseFloat(remainingOnDuty.toFixed(2)),
    needsBreak,
    violations,
    canDrive:
      remainingDriving > 0 &&
      remainingOnDuty > 0 &&
      !needsBreak &&
      !weeklyCapViolation,
    weeklyOnDutyHours: parseFloat(weeklyOnDutyHours.toFixed(2)),
    remainingWeeklyOnDuty: parseFloat(remainingWeeklyOnDuty.toFixed(2)),
    weeklyCapViolation,
  }
}
