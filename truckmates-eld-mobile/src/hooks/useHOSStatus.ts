/**
 * HOS Status Hook
 * Real-time Hours of Service tracking and calculations
 */

import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { 
  calculateRemainingDriveTime, 
  calculateRemainingOnDutyTime,
  calculateWeeklyOnDutyHours,
  calculateRemainingWeeklyHours,
  isBreakRequired as checkBreakRequired,
  detectHOSViolations 
} from '../services/hosService'
import type { LogType, HOSLog, DriverStatus, ELDEvent } from '../types'
import { HOS_RULES } from '../constants/config'

export interface UseHOSStatusReturn {
  currentStatus: LogType
  statusStartTime: string
  remainingDriveTime: number // minutes
  remainingOnDutyTime: number // minutes
  weeklyOnDutyHours: number // hours
  remainingWeeklyHours: number // hours
  isBreakRequired: boolean
  violations: ELDEvent[]
  isLoading: boolean
  changeStatus: (newStatus: LogType, location?: { lat: number; lng: number }, odometer?: number, notes?: string) => Promise<void>
  refreshStatus: () => Promise<void>
}

export function useHOSStatus(): UseHOSStatusReturn {
  const [currentStatus, setCurrentStatus] = useState<LogType>('off_duty')
  const [statusStartTime, setStatusStartTime] = useState<string>(new Date().toISOString())
  const [remainingDriveTime, setRemainingDriveTime] = useState<number>(HOS_RULES.MAX_DRIVE_TIME_HOURS * 60)
  const [remainingOnDutyTime, setRemainingOnDutyTime] = useState<number>(HOS_RULES.MAX_ON_DUTY_TIME_HOURS * 60)
  const [weeklyOnDutyHours, setWeeklyOnDutyHours] = useState<number>(0)
  const [remainingWeeklyHours, setRemainingWeeklyHours] = useState<number>(HOS_RULES.MAX_ON_DUTY_WEEKLY_HOURS)
  const [isBreakRequired, setIsBreakRequired] = useState<boolean>(false)
  const [violations, setViolations] = useState<ELDEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [recentLogs, setRecentLogs] = useState<HOSLog[]>([])

  // Load saved status on mount
  useEffect(() => {
    loadStatus()
  }, [])

  // Update calculations every minute and when dependencies change
  useEffect(() => {
    if (!isLoading) {
      calculateHOSTimes()
    }
    
    const interval = setInterval(() => {
      if (!isLoading) {
        calculateHOSTimes()
      }
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [currentStatus, statusStartTime, recentLogs, isLoading])

  async function loadStatus() {
    try {
      const savedStatus = await AsyncStorage.getItem('@eld/current_status')
      const savedStartTime = await AsyncStorage.getItem('@eld/status_start_time')
      const savedLogs = await AsyncStorage.getItem('@eld/recent_logs')

      if (savedStatus) {
        setCurrentStatus(savedStatus as LogType)
      }
      if (savedStartTime) {
        setStatusStartTime(savedStartTime)
      }
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs)
        setRecentLogs(parsedLogs)
      } else {
        setRecentLogs([])
      }

      setIsLoading(false)
      // Calculate after state is set
      setTimeout(() => {
        calculateHOSTimes()
      }, 100)
    } catch (error) {
      console.error('Error loading HOS status:', error)
      setIsLoading(false)
    }
  }

  function calculateHOSTimes() {
    // Ensure we have valid recentLogs array
    const logs = Array.isArray(recentLogs) ? recentLogs : []
    
    const driveTime = calculateRemainingDriveTime(
      currentStatus,
      statusStartTime,
      logs
    )
    const onDutyTime = calculateRemainingOnDutyTime(
      currentStatus,
      statusStartTime,
      logs
    )
    const weeklyHours = calculateWeeklyOnDutyHours(currentStatus, statusStartTime, logs)
    const remainingWeekly = calculateRemainingWeeklyHours(currentStatus, statusStartTime, logs)
    const breakReq = checkBreakRequired(currentStatus, statusStartTime, logs)
    const detectedViolations = detectHOSViolations(
      currentStatus,
      statusStartTime,
      logs
    )

    setRemainingDriveTime(driveTime)
    setRemainingOnDutyTime(onDutyTime)
    setWeeklyOnDutyHours(weeklyHours)
    setRemainingWeeklyHours(remainingWeekly)
    setIsBreakRequired(breakReq)
    setViolations(detectedViolations)
  }

  async function changeStatus(
    newStatus: LogType,
    location?: { lat: number; lng: number },
    odometer?: number,
    notes?: string
  ) {
    try {
      const now = new Date().toISOString()

      // Save previous log entry if status changed
      let updatedLogs = [...recentLogs] // Create a copy to avoid mutation
      if (currentStatus !== newStatus) {
        // Calculate duration for the previous log
        const startTime = new Date(statusStartTime)
        const endTime = new Date(now)
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)
        
        const previousLog: HOSLog = {
          log_date: new Date().toISOString().split('T')[0],
          log_type: currentStatus,
          start_time: statusStartTime,
          end_time: now,
          duration_minutes: durationMinutes, // CRITICAL: Must include duration for calculations
          location_end: location,
          odometer_end: odometer,
          notes: notes, // Save notes with the log entry
        }

        // Add to recent logs
        updatedLogs = [...recentLogs, previousLog]
        // Keep only last 7 days of logs
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const filteredLogs = updatedLogs.filter(
          (log) => new Date(log.start_time) >= sevenDaysAgo
        )

        updatedLogs = filteredLogs
        setRecentLogs(updatedLogs)
        await AsyncStorage.setItem('@eld/recent_logs', JSON.stringify(updatedLogs))
      }

      // Update current status
      setCurrentStatus(newStatus)
      setStatusStartTime(now)

      await AsyncStorage.setItem('@eld/current_status', newStatus)
      await AsyncStorage.setItem('@eld/status_start_time', now)

      // Recalculate times with updated logs immediately
      // Use the updatedLogs variable instead of waiting for state update
      const driveTime = calculateRemainingDriveTime(newStatus, now, updatedLogs)
      const onDutyTime = calculateRemainingOnDutyTime(newStatus, now, updatedLogs)
      const weeklyHours = calculateWeeklyOnDutyHours(newStatus, now, updatedLogs)
      const remainingWeekly = calculateRemainingWeeklyHours(newStatus, now, updatedLogs)
      const breakReq = checkBreakRequired(newStatus, now, updatedLogs)
      const detectedViolations = detectHOSViolations(newStatus, now, updatedLogs)

      setRemainingDriveTime(driveTime)
      setRemainingOnDutyTime(onDutyTime)
      setWeeklyOnDutyHours(weeklyHours)
      setRemainingWeeklyHours(remainingWeekly)
      setIsBreakRequired(breakReq)
      setViolations(detectedViolations)
    } catch (error) {
      console.error('Error changing status:', error)
      throw error
    }
  }

  async function refreshStatus() {
    await loadStatus()
  }

  return {
    currentStatus,
    statusStartTime,
    remainingDriveTime,
    remainingOnDutyTime,
    weeklyOnDutyHours,
    remainingWeeklyHours,
    isBreakRequired,
    violations,
    isLoading,
    changeStatus,
    refreshStatus,
  }
}
