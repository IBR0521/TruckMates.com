/**
 * Hours of Service (HOS) Tracking Service
 * Manages driver status, log entries, and violation detection
 */

import { format, parseISO, addMinutes, differenceInMinutes } from 'date-fns'
import type { LogType, HOSLog, ELDEvent, DriverStatus } from '@/types'
import { HOS_RULES, VIOLATION_THRESHOLDS } from '@/constants/config'

/**
 * Calculate remaining drive time based on current status and history
 */
export function calculateRemainingDriveTime(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  // If not driving, return full drive time
  if (currentStatus !== 'driving') {
    return HOS_RULES.MAX_DRIVE_TIME_HOURS * 60 // Convert to minutes
  }

  // Calculate how long driver has been driving
  const startTime = parseISO(currentStatusStartTime)
  const now = new Date()
  const drivingMinutes = differenceInMinutes(now, startTime)

  // Calculate total driving time in last 11 hours (rolling window)
  const elevenHoursAgo = addMinutes(now, -HOS_RULES.MAX_DRIVE_TIME_HOURS * 60)
  const recentDrivingLogs = recentLogs.filter(
    (log) =>
      log.log_type === 'driving' &&
      parseISO(log.start_time) >= elevenHoursAgo &&
      log.duration_minutes
  )

  const totalDrivingMinutes =
    recentDrivingLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) +
    drivingMinutes

  const remainingMinutes =
    HOS_RULES.MAX_DRIVE_TIME_HOURS * 60 - totalDrivingMinutes

  return Math.max(0, remainingMinutes)
}

/**
 * Calculate remaining on-duty time
 */
export function calculateRemainingOnDutyTime(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  // If off-duty or sleeper, return full on-duty time
  if (currentStatus === 'off_duty' || currentStatus === 'sleeper_berth') {
    return HOS_RULES.MAX_ON_DUTY_TIME_HOURS * 60
  }

  const startTime = parseISO(currentStatusStartTime)
  const now = new Date()
  const onDutyMinutes = differenceInMinutes(now, startTime)

  // Calculate total on-duty time in last 14 hours
  const fourteenHoursAgo = addMinutes(
    now,
    -HOS_RULES.MAX_ON_DUTY_TIME_HOURS * 60
  )
  const recentOnDutyLogs = recentLogs.filter(
    (log) =>
      (log.log_type === 'driving' || log.log_type === 'on_duty') &&
      parseISO(log.start_time) >= fourteenHoursAgo &&
      log.duration_minutes
  )

  const totalOnDutyMinutes =
    recentOnDutyLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) +
    onDutyMinutes

  const remainingMinutes =
    HOS_RULES.MAX_ON_DUTY_TIME_HOURS * 60 - totalOnDutyMinutes

  return Math.max(0, remainingMinutes)
}

/**
 * Check if break is required
 */
export function isBreakRequired(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): boolean {
  if (currentStatus === 'off_duty' || currentStatus === 'sleeper_berth') {
    return false
  }

  const startTime = parseISO(currentStatusStartTime)
  const now = new Date()
  const onDutyMinutes = differenceInMinutes(now, startTime)

  // Check if 8 hours of on-duty time without break
  const eightHoursAgo = addMinutes(now, -8 * 60)
  const hasRecentBreak = recentLogs.some(
    (log) =>
      (log.log_type === 'off_duty' || log.log_type === 'sleeper_berth') &&
      parseISO(log.start_time) >= eightHoursAgo &&
      (log.duration_minutes || 0) >= HOS_RULES.REQUIRED_BREAK_HOURS * 60
  )

  return onDutyMinutes >= 8 * 60 && !hasRecentBreak
}

/**
 * Detect HOS violations
 */
export function detectHOSViolations(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): ELDEvent[] {
  const violations: ELDEvent[] = []
  const now = new Date().toISOString()

  // Check drive time violation
  const remainingDriveTime = calculateRemainingDriveTime(
    currentStatus,
    currentStatusStartTime,
    recentLogs
  )
  if (remainingDriveTime <= 0 && currentStatus === 'driving') {
    violations.push({
      event_type: 'hos_violation',
      severity: 'critical',
      title: 'Drive Time Violation',
      description: 'Exceeded maximum 11-hour drive time limit',
      event_time: now,
    })
  }

  // Check on-duty time violation
  const remainingOnDutyTime = calculateRemainingOnDutyTime(
    currentStatus,
    currentStatusStartTime,
    recentLogs
  )
  if (remainingOnDutyTime <= 0) {
    violations.push({
      event_type: 'hos_violation',
      severity: 'critical',
      title: 'On-Duty Time Violation',
      description: 'Exceeded maximum 14-hour on-duty time limit',
      event_time: now,
    })
  }

  // Check break requirement
  if (isBreakRequired(currentStatus, currentStatusStartTime, recentLogs)) {
    violations.push({
      event_type: 'hos_violation',
      severity: 'warning',
      title: 'Break Required',
      description: '30-minute break required after 8 hours on duty',
      event_time: now,
    })
  }

  return violations
}

/**
 * Create a new HOS log entry
 */
export function createHOSLog(
  logType: LogType,
  startTime: string,
  endTime?: string,
  locationStart?: { lat: number; lng: number },
  locationEnd?: { lat: number; lng: number },
  odometerStart?: number,
  odometerEnd?: number
): HOSLog {
  const start = parseISO(startTime)
  const end = endTime ? parseISO(endTime) : new Date()
  const durationMinutes = differenceInMinutes(end, start)
  const logDate = format(start, 'yyyy-MM-dd')

  return {
    log_date: logDate,
    log_type: logType,
    start_time: startTime,
    end_time: endTime || null,
    duration_minutes: durationMinutes,
    location_start: locationStart,
    location_end: locationEnd,
    odometer_start: odometerStart,
    odometer_end: odometerEnd,
    miles_driven:
      odometerStart && odometerEnd
        ? odometerEnd - odometerStart
        : undefined,
  }
}

/**
 * Detect speeding violation
 */
export function detectSpeeding(speed: number, speedLimit: number = 65): ELDEvent | null {
  if (speed > Math.max(speedLimit, VIOLATION_THRESHOLDS.SPEEDING_MPH)) {
    return {
      event_type: 'speeding',
      severity: 'warning',
      title: 'Speeding Violation',
      description: `Driving at ${speed.toFixed(0)} MPH (limit: ${speedLimit} MPH)`,
      event_time: new Date().toISOString(),
      metadata: {
        speed,
        speed_limit: speedLimit,
      },
    }
  }
  return null
}

/**
 * Detect hard braking (based on speed change)
 */
export function detectHardBrake(
  previousSpeed: number,
  currentSpeed: number,
  timeDeltaSeconds: number
): ELDEvent | null {
  if (timeDeltaSeconds <= 0) return null

  const speedChange = currentSpeed - previousSpeed // Negative for braking
  const acceleration = speedChange / timeDeltaSeconds // MPH per second
  const gForce = acceleration / 21.936 // Convert to g-force (1g ≈ 21.936 MPH/s)

  if (gForce <= VIOLATION_THRESHOLDS.HARD_BRAKE_G_FORCE) {
    return {
      event_type: 'hard_brake',
      severity: 'warning',
      title: 'Hard Braking Event',
      description: `Hard brake detected (${gForce.toFixed(2)}g)`,
      event_time: new Date().toISOString(),
      metadata: {
        g_force: gForce,
        speed_change: speedChange,
      },
    }
  }
  return null
}

/**
 * Detect hard acceleration
 */
export function detectHardAccel(
  previousSpeed: number,
  currentSpeed: number,
  timeDeltaSeconds: number
): ELDEvent | null {
  if (timeDeltaSeconds <= 0) return null

  const speedChange = currentSpeed - previousSpeed
  const acceleration = speedChange / timeDeltaSeconds
  const gForce = acceleration / 21.936

  if (gForce >= VIOLATION_THRESHOLDS.HARD_ACCEL_G_FORCE) {
    return {
      event_type: 'hard_accel',
      severity: 'info',
      title: 'Hard Acceleration Event',
      description: `Hard acceleration detected (${gForce.toFixed(2)}g)`,
      event_time: new Date().toISOString(),
      metadata: {
        g_force: gForce,
        speed_change: speedChange,
      },
    }
  }
  return null
}

