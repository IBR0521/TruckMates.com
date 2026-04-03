/**
 * Single source of truth for "remaining drive / on-duty" for a calendar day
 * from `eld_logs` rows (same rules as mobile hos-engine daily limits: 11h / 14h).
 */

export type EldLogLike = {
  log_type: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  log_date?: string
}

const MAX_DRIVING_HOURS = 11
const MAX_ON_DUTY_HOURS = 14
const MIN_BREAK_HOURS = 0.5

export type DailyRemainingHosResult = {
  drivingHours: number
  onDutyHours: number
  offDutyHours: number
  remainingDriving: number
  remainingOnDuty: number
  needsBreak: boolean
  violations: string[]
  canDrive: boolean
}

export function computeDailyRemainingFromEldLogs(
  logs: readonly EldLogLike[],
  nowMs: number = Date.now()
): DailyRemainingHosResult {
  let drivingMinutes = 0
  let onDutyMinutes = 0
  let offDutyMinutes = 0
  let sleeperMinutes = 0

  const timeline = [...logs].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  timeline.forEach((log, idx) => {
    let duration = log.duration_minutes || 0
    if (!duration && log.start_time) {
      const start = new Date(log.start_time).getTime()
      const nextStart = timeline[idx + 1]?.start_time
        ? new Date(timeline[idx + 1].start_time).getTime()
        : null
      const explicitEnd = log.end_time ? new Date(log.end_time).getTime() : null
      const inferredEnd = explicitEnd || nextStart || nowMs
      if (Number.isFinite(start) && Number.isFinite(inferredEnd) && inferredEnd > start) {
        duration = Math.floor((inferredEnd - start) / 60000)
      }
    }
    switch (log.log_type) {
      case "driving":
        drivingMinutes += duration
        onDutyMinutes += duration
        break
      case "on_duty":
        onDutyMinutes += duration
        break
      case "off_duty":
        offDutyMinutes += duration
        break
      case "sleeper_berth":
        sleeperMinutes += duration
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
  const needsBreak = drivingHours >= 8 && offDutyHours < MIN_BREAK_HOURS

  const violations: string[] = []
  if (drivingHours > MAX_DRIVING_HOURS) {
    violations.push(`Exceeded ${MAX_DRIVING_HOURS}-hour driving limit`)
  }
  if (onDutyHours > MAX_ON_DUTY_HOURS) {
    violations.push(`Exceeded ${MAX_ON_DUTY_HOURS}-hour on-duty limit`)
  }
  if (needsBreak) {
    violations.push("Break required: 30 minutes off-duty needed after 8 hours driving")
  }

  return {
    drivingHours: parseFloat(drivingHours.toFixed(2)),
    onDutyHours: parseFloat(onDutyHours.toFixed(2)),
    offDutyHours: parseFloat(offDutyHours.toFixed(2)),
    remainingDriving: parseFloat(remainingDriving.toFixed(2)),
    remainingOnDuty: parseFloat(remainingOnDuty.toFixed(2)),
    needsBreak,
    violations,
    canDrive: remainingDriving > 0 && remainingOnDuty > 0 && !needsBreak,
  }
}
