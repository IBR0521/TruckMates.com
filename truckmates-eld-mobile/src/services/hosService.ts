/**
 * Hours of Service (HOS) Tracking Service
 * Manages driver status, log entries, and violation detection
 */

import { format, parseISO, addMinutes, differenceInMinutes, subDays } from 'date-fns'
import type { LogType, HOSLog, ELDEvent, DriverStatus } from '@/types'
import { HOS_RULES, VIOLATION_THRESHOLDS } from '@/constants/config'

/**
 * Calculate remaining drive time based on current status and history
 * Uses rolling 11-hour window - remaining time doesn't reset when off-duty
 */
export function calculateRemainingDriveTime(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  const now = new Date()
  
  // Calculate total driving time in last 11 hours (rolling window)
  // CRITICAL FIX: Include logs that OVERLAP the window, not just logs that START within it
  const elevenHoursAgo = addMinutes(now, -HOS_RULES.MAX_DRIVE_TIME_HOURS * 60)
  const recentDrivingLogs = recentLogs.filter(
    (log) => {
      if (log.log_type !== 'driving' || !log.end_time) return false
      
      const logStart = parseISO(log.start_time)
      const logEnd = parseISO(log.end_time)
      
      // Include log if it overlaps the 11-hour window (ends after elevenHoursAgo)
      return logEnd > elevenHoursAgo
    }
  )

  // Sum up all driving time from closed logs in the rolling window
  // CRITICAL FIX: Clip start time to elevenHoursAgo when computing duration within window
  let totalDrivingMinutes = recentDrivingLogs.reduce((sum, log) => {
    const logStart = parseISO(log.start_time)
    const logEnd = parseISO(log.end_time!)
    
    // Clip start time to window start if log started before the window
    const effectiveStart = logStart > elevenHoursAgo ? logStart : elevenHoursAgo
    
    // Calculate duration within the 11-hour window
    const duration = differenceInMinutes(logEnd, effectiveStart)
    
    return sum + Math.max(0, duration) // Ensure non-negative
  }, 0)

  // If currently driving, add the current driving session time
  if (currentStatus === 'driving') {
    const startTime = parseISO(currentStatusStartTime)
    const currentDrivingMinutes = differenceInMinutes(now, startTime)
    totalDrivingMinutes += currentDrivingMinutes
  }

  const remainingMinutes =
    HOS_RULES.MAX_DRIVE_TIME_HOURS * 60 - totalDrivingMinutes

  return Math.max(0, remainingMinutes)
}

/**
 * Calculate weekly on-duty hours (70-hour/8-day rule)
 * Returns total on-duty hours in the last 8 days
 */
export function calculateWeeklyOnDutyHours(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  const now = new Date()
  const eightDaysAgo = subDays(now, 8) // 8 days ago
  
  const weeklyLogs = recentLogs.filter(
    (log) =>
      (log.log_type === 'driving' || log.log_type === 'on_duty') &&
      parseISO(log.start_time) >= eightDaysAgo &&
      log.end_time // Only count closed logs for historical data
  )

  // Sum up all on-duty time from closed logs
  let totalOnDutyMinutes = weeklyLogs.reduce((sum, log) => {
    let duration = log.duration_minutes
    if (!duration && log.start_time && log.end_time) {
      duration = differenceInMinutes(parseISO(log.end_time), parseISO(log.start_time))
    }
    return sum + (duration || 0)
  }, 0)

  // If currently on-duty or driving, add the current session time
  if (currentStatus === 'driving' || currentStatus === 'on_duty') {
    const startTime = parseISO(currentStatusStartTime)
    const currentOnDutyMinutes = differenceInMinutes(now, startTime)
    totalOnDutyMinutes += currentOnDutyMinutes
  }

  return Math.floor(totalOnDutyMinutes / 60) // Return hours
}

/**
 * Calculate remaining weekly on-duty hours (70-hour rule)
 */
export function calculateRemainingWeeklyHours(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  const weeklyHours = calculateWeeklyOnDutyHours(currentStatus, currentStatusStartTime, recentLogs)
  const remainingHours = HOS_RULES.MAX_ON_DUTY_WEEKLY_HOURS - weeklyHours
  return Math.max(0, remainingHours)
}

/**
 * Calculate remaining on-duty time
 * Uses rolling 14-hour window - remaining time doesn't reset when off-duty
 */
export function calculateRemainingOnDutyTime(
  currentStatus: LogType,
  currentStatusStartTime: string,
  recentLogs: HOSLog[]
): number {
  const now = new Date()

  // Calculate total on-duty time in last 14 hours (rolling window)
  // CRITICAL FIX: Include logs that OVERLAP the window, not just logs that START within it
  const fourteenHoursAgo = addMinutes(
    now,
    -HOS_RULES.MAX_ON_DUTY_TIME_HOURS * 60
  )
  const recentOnDutyLogs = recentLogs.filter(
    (log) => {
      if ((log.log_type !== 'driving' && log.log_type !== 'on_duty') || !log.end_time) return false
      
      const logStart = parseISO(log.start_time)
      const logEnd = parseISO(log.end_time)
      
      // Include log if it overlaps the 14-hour window (ends after fourteenHoursAgo)
      return logEnd > fourteenHoursAgo
    }
  )

  // Sum up all on-duty time from closed logs in the rolling window
  // CRITICAL FIX: Clip start time to fourteenHoursAgo when computing duration within window
  let totalOnDutyMinutes = recentOnDutyLogs.reduce((sum, log) => {
    const logStart = parseISO(log.start_time)
    const logEnd = parseISO(log.end_time!)
    
    // Clip start time to window start if log started before the window
    const effectiveStart = logStart > fourteenHoursAgo ? logStart : fourteenHoursAgo
    
    // Calculate duration within the 14-hour window
    const duration = differenceInMinutes(logEnd, effectiveStart)
    
    return sum + Math.max(0, duration) // Ensure non-negative
  }, 0)

  // If currently on-duty or driving, add the current session time
  if (currentStatus === 'driving' || currentStatus === 'on_duty') {
    const startTime = parseISO(currentStatusStartTime)
    const currentOnDutyMinutes = differenceInMinutes(now, startTime)
    totalOnDutyMinutes += currentOnDutyMinutes
  }

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

  const now = new Date()
  
  // CRITICAL FIX: Calculate cumulative on-duty time since last qualifying break
  // Not just time since current status start - need to sum all on-duty/driving logs
  const eightHoursAgo = addMinutes(now, -8 * 60)
  
  // Find the most recent qualifying break (30+ min off-duty or sleeper)
  let lastBreakEnd: Date | null = null
  for (const log of recentLogs.sort((a, b) => 
    parseISO(b.start_time).getTime() - parseISO(a.start_time).getTime()
  )) {
    if ((log.log_type === 'off_duty' || log.log_type === 'sleeper_berth') && log.end_time) {
      const breakDuration = log.duration_minutes || 
        differenceInMinutes(parseISO(log.end_time), parseISO(log.start_time))
      
      if (breakDuration >= HOS_RULES.REQUIRED_BREAK_HOURS * 60) {
        lastBreakEnd = parseISO(log.end_time)
        break
      }
    }
  }
  
  // Calculate cumulative on-duty time since last break (or 8 hours ago if no break)
  const referenceTime = lastBreakEnd && lastBreakEnd > eightHoursAgo ? lastBreakEnd : eightHoursAgo
  
  const onDutyLogsSinceBreak = recentLogs.filter((log) => {
    if (log.log_type !== 'driving' && log.log_type !== 'on_duty') return false
    if (!log.end_time) return false
    
    const logEnd = parseISO(log.end_time)
    return logEnd > referenceTime
  })
  
  // Sum on-duty minutes since last break
  let cumulativeOnDutyMinutes = onDutyLogsSinceBreak.reduce((sum, log) => {
    const logStart = parseISO(log.start_time)
    const logEnd = parseISO(log.end_time!)
    const effectiveStart = logStart > referenceTime ? logStart : referenceTime
    return sum + differenceInMinutes(logEnd, effectiveStart)
  }, 0)
  
  // Add current session if on-duty/driving
  if (currentStatus === 'driving' || currentStatus === 'on_duty') {
    const currentStart = parseISO(currentStatusStartTime)
    const effectiveCurrentStart = currentStart > referenceTime ? currentStart : referenceTime
    cumulativeOnDutyMinutes += differenceInMinutes(now, effectiveCurrentStart)
  }

  return cumulativeOnDutyMinutes >= 8 * 60
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
  // CRITICAL FIX: Threshold should be a minimum floor, not a maximum override
  // Check if speed exceeds the actual speed limit (with small tolerance)
  const TOLERANCE = 2 // 2 MPH tolerance to avoid false positives
  const exceedsLimit = speed > speedLimit + TOLERANCE
  const exceedsGlobalThreshold = speed > VIOLATION_THRESHOLDS.SPEEDING_MPH
  
  // Flag if exceeds limit OR exceeds global threshold (whichever is higher)
  if (exceedsLimit || exceedsGlobalThreshold) {
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

