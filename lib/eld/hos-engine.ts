/**
 * HOS clocks used by dashboards/tests — aligned with `truckmates-eld-mobile` hos-engine
 * (11h driving, 14h window, break after 8h driving, simplified 70h/8-day, split-sleeper signals).
 */

export type HosDutyStatus =
  | "off_duty"
  | "sleeper_berth"
  | "driving"
  | "on_duty"

export type HosLogEntry = {
  id: string
  logDate: string
  status: HosDutyStatus
  startTime: string
  endTime?: string
}

export type HosClocks = {
  driveMinutesLeft: number
  shiftMinutesLeft: number
  cycleMinutesLeft: number
  effectiveDriveLimitMinutes: number
  effectiveShiftLimitMinutes: number
  adverseConditionApplied: boolean
  breakDueInMinutes: number
  currentBreakProgressMinutes: number
  shortHaulEligible: boolean
  shortHaulStatus: string
  splitSleeperEligible: boolean
  splitSleeperStatus: string
}

export type HosExceptionSettings = {
  adverseDrivingEnabled: boolean
  adverseDrivingReason: string
}

const MINUTES_11_HOURS = 11 * 60
const MINUTES_14_HOURS = 14 * 60
const MINUTES_70_HOURS = 70 * 60
const MINUTES_BEFORE_BREAK_REQUIRED = 8 * 60
const MINUTES_REQUIRED_BREAK = 30

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Inclusive `[min..max]` YMD calendar window ending on `endYmd`, length 8 days. */
function getEightCalendarDayWindowYmd(endYmd: string): { minYmd: string; maxYmd: string } {
  const [y, m, d] = endYmd.split("-").map((x) => parseInt(x, 10))
  if (!y || !m || !d) return { minYmd: endYmd, maxYmd: endYmd }
  const startMs = Date.UTC(y, m - 1, d - 7)
  const s = new Date(startMs)
  const minYmd = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`
  return { minYmd, maxYmd: endYmd }
}

function clamp(value: number): number {
  return Math.max(0, value)
}

function durationMinutes(entry: HosLogEntry, nowIso: string): number {
  const start = new Date(entry.startTime).getTime()
  const end = new Date(entry.endTime ?? nowIso).getTime()
  return Math.max(0, (end - start) / 60000)
}

export function computeHosClocks(
  entries: HosLogEntry[],
  nowIso: string = new Date().toISOString(),
): HosClocks {
  return computeHosClocksWithSettings(
    entries,
    {
      adverseDrivingEnabled: false,
      adverseDrivingReason: "",
    },
    nowIso,
  )
}

export function computeHosClocksWithSettings(
  entries: HosLogEntry[],
  settings: HosExceptionSettings,
  nowIso: string = new Date().toISOString(),
): HosClocks {
  const today = dateKey(nowIso)
  const cycleWindow = getEightCalendarDayWindowYmd(today)
  const ordered = [...entries].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
  const adverseConditionApplied =
    settings.adverseDrivingEnabled && Boolean(settings.adverseDrivingReason.trim())
  const effectiveDriveLimitMinutes =
    MINUTES_11_HOURS + (adverseConditionApplied ? 120 : 0)
  const effectiveShiftLimitMinutes =
    MINUTES_14_HOURS + (adverseConditionApplied ? 120 : 0)

  let drivingToday = 0
  let onDutyWindow = 0
  let cycleOnDuty = 0
  let drivingSinceBreak = 0
  let currentBreakProgress = 0

  const restSegments: Array<{ status: HosDutyStatus; minutes: number }> = []
  let hasSleeperToday = false

  for (const entry of ordered) {
    const minutes = durationMinutes(entry, nowIso)
    const isDriving = entry.status === "driving"
    const isOnDuty = entry.status === "driving" || entry.status === "on_duty"
    const isRest =
      entry.status === "off_duty" || entry.status === "sleeper_berth"
    const logDay = dateKey(entry.logDate)

    if (logDay === today && isDriving) drivingToday += minutes
    if (logDay === today && isOnDuty) onDutyWindow += minutes
    if (logDay === today && entry.status === "sleeper_berth")
      hasSleeperToday = true
    if (
      entry.logDate >= cycleWindow.minYmd &&
      entry.logDate <= cycleWindow.maxYmd &&
      isOnDuty
    ) {
      cycleOnDuty += minutes
    }

    if (logDay === today) {
      if (isDriving) {
        drivingSinceBreak += minutes
        currentBreakProgress = 0
      } else {
        currentBreakProgress += minutes
        if (currentBreakProgress >= MINUTES_REQUIRED_BREAK) {
          drivingSinceBreak = 0
        }
      }
    }

    if (isRest) {
      restSegments.push({ status: entry.status, minutes })
    }
  }

  const hasTwoHourBreak = restSegments.some((item) => item.minutes >= 120)
  const hasThreeHourBreak = restSegments.some((item) => item.minutes >= 180)
  const hasEightHourSleeper = restSegments.some(
    (item) => item.status === "sleeper_berth" && item.minutes >= 480,
  )
  const hasSevenHourSleeper = restSegments.some(
    (item) => item.status === "sleeper_berth" && item.minutes >= 420,
  )
  const splitSleeperEligible =
    (hasEightHourSleeper && hasTwoHourBreak) ||
    (hasSevenHourSleeper && hasThreeHourBreak)

  let splitSleeperStatus = "No qualifying split-rest pair yet"
  if (splitSleeperEligible) {
    splitSleeperStatus = hasEightHourSleeper
      ? "8/2 split-rest signals detected"
      : "7/3 split-rest signals detected"
  } else if (
    hasTwoHourBreak ||
    hasThreeHourBreak ||
    hasSevenHourSleeper ||
    hasEightHourSleeper
  ) {
    splitSleeperStatus = "Partial split-rest signal detected"
  }

  const shortHaulEligible =
    !hasSleeperToday &&
    onDutyWindow <= MINUTES_14_HOURS &&
    drivingToday <= MINUTES_11_HOURS
  let shortHaulStatus = "Not eligible for short-haul signal"
  if (shortHaulEligible) {
    shortHaulStatus = "Time-window short-haul signal detected"
  } else if (hasSleeperToday) {
    shortHaulStatus = "Sleeper berth usage excludes short-haul signal"
  } else if (onDutyWindow > MINUTES_14_HOURS) {
    shortHaulStatus = "Shift window exceeds short-haul limit"
  } else if (drivingToday > MINUTES_11_HOURS) {
    shortHaulStatus = "Driving window exceeds short-haul limit"
  }

  return {
    driveMinutesLeft: clamp(effectiveDriveLimitMinutes - drivingToday),
    shiftMinutesLeft: clamp(effectiveShiftLimitMinutes - onDutyWindow),
    cycleMinutesLeft: clamp(MINUTES_70_HOURS - cycleOnDuty),
    effectiveDriveLimitMinutes,
    effectiveShiftLimitMinutes,
    adverseConditionApplied,
    breakDueInMinutes: clamp(
      MINUTES_BEFORE_BREAK_REQUIRED - drivingSinceBreak,
    ),
    currentBreakProgressMinutes: clamp(currentBreakProgress),
    shortHaulEligible,
    shortHaulStatus,
    splitSleeperEligible,
    splitSleeperStatus,
  }
}
