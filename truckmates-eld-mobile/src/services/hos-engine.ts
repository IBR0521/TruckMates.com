import type { DutyStatus } from "../types/eld"
import type { HosClocks, HosExceptionSettings, HosLogEntry } from "../types/hos"

const MINUTES_11_HOURS = 11 * 60
const MINUTES_14_HOURS = 14 * 60
const MINUTES_70_HOURS = 70 * 60
const MINUTES_BEFORE_BREAK_REQUIRED = 8 * 60
const MINUTES_REQUIRED_BREAK = 30

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function clamp(value: number): number {
  return Math.max(0, Math.floor(value))
}

function durationMinutes(entry: HosLogEntry, nowIso: string): number {
  const start = new Date(entry.startTime).getTime()
  const end = new Date(entry.endTime ?? nowIso).getTime()
  return Math.max(0, (end - start) / 60000)
}

export function computeHosClocks(entries: HosLogEntry[], nowIso: string = new Date().toISOString()): HosClocks {
  return computeHosClocksWithSettings(entries, {
    adverseDrivingEnabled: false,
    adverseDrivingReason: "",
  }, nowIso)
}

export function computeHosClocksWithSettings(
  entries: HosLogEntry[],
  settings: HosExceptionSettings,
  nowIso: string = new Date().toISOString()
): HosClocks {
  const today = dateKey(nowIso)
  const last8Days = new Date(nowIso)
  last8Days.setDate(last8Days.getDate() - 7)
  const ordered = [...entries].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
  const adverseConditionApplied = settings.adverseDrivingEnabled && Boolean(settings.adverseDrivingReason.trim())
  const effectiveDriveLimitMinutes = MINUTES_11_HOURS + (adverseConditionApplied ? 120 : 0)
  const effectiveShiftLimitMinutes = MINUTES_14_HOURS + (adverseConditionApplied ? 120 : 0)

  let drivingToday = 0
  let onDutyWindow = 0
  let cycleOnDuty = 0
  let drivingSinceBreak = 0
  let currentBreakProgress = 0

  const restSegments: Array<{ status: DutyStatus; minutes: number }> = []
  let hasSleeperToday = false

  for (const entry of ordered) {
    const minutes = durationMinutes(entry, nowIso)
    const isDriving = entry.status === "driving"
    const isOnDuty = entry.status === "driving" || entry.status === "on_duty"
    const isRest = entry.status === "off_duty" || entry.status === "sleeper_berth"
    const logDay = dateKey(entry.logDate)

    if (logDay === today && isDriving) drivingToday += minutes
    if (logDay === today && isOnDuty) onDutyWindow += minutes
    if (logDay === today && entry.status === "sleeper_berth") hasSleeperToday = true
    if (new Date(entry.logDate) >= last8Days && isOnDuty) cycleOnDuty += minutes

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
  const hasEightHourSleeper = restSegments.some((item) => item.status === "sleeper_berth" && item.minutes >= 480)
  const hasSevenHourSleeper = restSegments.some((item) => item.status === "sleeper_berth" && item.minutes >= 420)
  const splitSleeperEligible = (hasEightHourSleeper && hasTwoHourBreak) || (hasSevenHourSleeper && hasThreeHourBreak)

  let splitSleeperStatus = "No qualifying split-rest pair yet"
  if (splitSleeperEligible) {
    splitSleeperStatus = hasEightHourSleeper ? "8/2 split-rest signals detected" : "7/3 split-rest signals detected"
  } else if (hasTwoHourBreak || hasThreeHourBreak || hasSevenHourSleeper || hasEightHourSleeper) {
    splitSleeperStatus = "Partial split-rest signal detected"
  }

  const shortHaulEligible = !hasSleeperToday && onDutyWindow <= MINUTES_14_HOURS && drivingToday <= MINUTES_11_HOURS
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
    breakDueInMinutes: clamp(MINUTES_BEFORE_BREAK_REQUIRED - drivingSinceBreak),
    currentBreakProgressMinutes: clamp(currentBreakProgress),
    shortHaulEligible,
    shortHaulStatus,
    splitSleeperEligible,
    splitSleeperStatus,
  }
}

export function transitionStatus(entries: HosLogEntry[], nextStatus: DutyStatus, nowIso: string = new Date().toISOString()): HosLogEntry[] {
  const next = [...entries]
  const activeIndex = next.findIndex((item) => !item.endTime)

  if (activeIndex >= 0) {
    next[activeIndex] = {
      ...next[activeIndex],
      endTime: nowIso,
    }
  }

  next.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    logDate: dateKey(nowIso),
    status: nextStatus,
    startTime: nowIso,
  })

  return next
}

export function certifyDay(entries: HosLogEntry[], day: string): HosLogEntry[] {
  return entries.map((entry) => (entry.logDate === day ? { ...entry, certified: true } : entry))
}

export function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hrs}h ${mins}m`
}
