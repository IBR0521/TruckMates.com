/**
 * Status Screen - Detailed HOS Status
 * Shows comprehensive Hours of Service information
 * Integrated with TruckMates platform
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useHOSStatus } from '../hooks/useHOSStatus'
import { useELDDevice } from '../hooks/useELDDevice'
import { COLORS } from '../constants/colors'
import { HOS_RULES } from '../constants/config'
import type { LogType } from '../types'

export default function StatusScreen() {
  const {
    currentStatus,
    statusStartTime,
    remainingDriveTime,
    remainingOnDutyTime,
    weeklyOnDutyHours,
    remainingWeeklyHours,
    isBreakRequired,
    violations,
    refreshStatus,
  } = useHOSStatus()
  const { deviceId, isRegistered } = useELDDevice()
  const [updateTrigger, setUpdateTrigger] = useState(0)
  
  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshStatus()
    }, [refreshStatus])
  )
  
  // Force immediate update when status changes
  useEffect(() => {
    setUpdateTrigger(prev => prev + 1)
    // Also refresh status from storage to ensure we have latest data
    const timer = setTimeout(() => {
      refreshStatus()
    }, 200)
    return () => clearTimeout(timer)
  }, [currentStatus, statusStartTime])
  
  // Auto-update status display every 10 seconds for real-time duration updates
  // Reduced frequency to improve performance
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update duration and remaining times
      setUpdateTrigger(prev => prev + 1)
    }, 1000) // Update UI every second for smooth countdown
    
    // Refresh status less frequently to avoid heavy calculations
    const refreshInterval = setInterval(() => {
      refreshStatus()
    }, 10000) // Refresh calculations every 10 seconds

    return () => {
      clearInterval(interval)
      clearInterval(refreshInterval)
    }
  }, [refreshStatus])

  function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  function getStatusDuration(): string {
    try {
      if (!statusStartTime) {
        return '0m'
      }
      const start = new Date(statusStartTime)
      const now = new Date()
      const minutes = Math.floor((now.getTime() - start.getTime()) / 60000)
      return formatTime(Math.max(0, minutes))
    } catch (error) {
      return '0m'
    }
  }

  function getStatusColor(status: LogType): string {
    switch (status) {
      case 'driving':
        return COLORS.driving
      case 'on_duty':
        return COLORS.onDuty
      case 'off_duty':
        return COLORS.offDuty
      case 'sleeper_berth':
        return COLORS.sleeper
      default:
        return COLORS.mutedForeground
    }
  }

  function getStatusLabel(status: LogType): string {
    if (!status || typeof status !== 'string') {
      return 'OFF DUTY'
    }
    const labels: Record<LogType, string> = {
      driving: 'DRIVING',
      on_duty: 'ON DUTY',
      off_duty: 'OFF DUTY',
      sleeper_berth: 'SLEEPER BERTH',
    }
    return labels[status] || 'OFF DUTY'
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>HOS Status</Text>
        <Text style={styles.subtitle}>Hours of Service Details</Text>
      </View>

      {/* Current Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
          <Text style={styles.statusBadgeText}>{getStatusLabel(currentStatus)}</Text>
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusInfoLabel}>Duration:</Text>
          <Text style={styles.statusInfoValue}>{getStatusDuration()}</Text>
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusInfoLabel}>Started:</Text>
          <Text style={styles.statusInfoValue}>
            {statusStartTime ? new Date(statusStartTime).toLocaleString() : 'N/A'}
          </Text>
        </View>
      </View>

      {/* HOS Timers */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Remaining Hours</Text>
        <View style={styles.timerRow}>
          <View style={styles.timerItem}>
            <Text style={styles.timerLabel}>Drive Time</Text>
            <Text style={[
              styles.timerValue,
              remainingDriveTime < 60 && styles.timerWarning
            ]}>
              {formatTime(remainingDriveTime)}
            </Text>
            <Text style={styles.timerLimit}>
              of {HOS_RULES.MAX_DRIVE_TIME_HOURS} hours
            </Text>
          </View>
          <View style={styles.timerItem}>
            <Text style={styles.timerLabel}>On-Duty Time</Text>
            <Text style={[
              styles.timerValue,
              remainingOnDutyTime < 60 && styles.timerWarning
            ]}>
              {formatTime(remainingOnDutyTime)}
            </Text>
            <Text style={styles.timerLimit}>
              of {HOS_RULES.MAX_ON_DUTY_TIME_HOURS} hours
            </Text>
          </View>
        </View>
        {/* Weekly Hours (70-hour rule) */}
        <View style={styles.weeklyHoursContainer}>
          <View style={styles.weeklyHoursItem}>
            <Text style={styles.weeklyHoursLabel}>Weekly On-Duty Hours</Text>
            <Text style={[
              styles.weeklyHoursValue,
              remainingWeeklyHours < 10 && styles.timerWarning
            ]}>
              {weeklyOnDutyHours}h / {HOS_RULES.MAX_ON_DUTY_WEEKLY_HOURS}h
            </Text>
            <Text style={styles.weeklyHoursRemaining}>
              {remainingWeeklyHours}h remaining (8-day rule)
            </Text>
          </View>
        </View>
      </View>

      {/* HOS Rules */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>HOS Rules</Text>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleLabel}>Maximum Drive Time:</Text>
          <Text style={styles.ruleValue}>{HOS_RULES.MAX_DRIVE_TIME_HOURS} hours</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleLabel}>Maximum On-Duty Time:</Text>
          <Text style={styles.ruleValue}>{HOS_RULES.MAX_ON_DUTY_TIME_HOURS} hours</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleLabel}>Required Break:</Text>
          <Text style={styles.ruleValue}>
            {HOS_RULES.REQUIRED_BREAK_HOURS * 60} minutes after 8 hours
          </Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleLabel}>Required Rest:</Text>
          <Text style={styles.ruleValue}>{HOS_RULES.REQUIRED_REST_HOURS} hours</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleLabel}>Weekly Limit (8-day):</Text>
          <Text style={styles.ruleValue}>{HOS_RULES.MAX_ON_DUTY_WEEKLY_HOURS} hours</Text>
        </View>
      </View>

      {/* Break Required Alert */}
      {isBreakRequired && (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>⚠️ Break Required</Text>
          <Text style={styles.alertText}>
            You must take a {HOS_RULES.REQUIRED_BREAK_HOURS * 60}-minute break after 8 hours on duty.
          </Text>
        </View>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <View style={styles.violationsCard}>
          <Text style={styles.violationsTitle}>HOS Violations</Text>
          {violations.map((violation, index) => (
            <View key={index} style={styles.violationItem}>
              <Text style={styles.violationSeverity}>
                {violation.severity === 'critical' ? '🔴' : '🟡'} {violation.severity?.toUpperCase()}
              </Text>
              <Text style={styles.violationTitle}>{violation.title}</Text>
              {violation.description && (
                <Text style={styles.violationDescription}>{violation.description}</Text>
              )}
              <Text style={styles.violationTime}>
                {new Date(violation.event_time).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Compliance Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Compliance Status</Text>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceIcon}>✓</Text>
          <Text style={styles.complianceText}>FMCSA Compliant</Text>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceIcon}>✓</Text>
          <Text style={styles.complianceText}>ELD Certified</Text>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceIcon}>✓</Text>
          <Text style={styles.complianceText}>Real-time Tracking</Text>
        </View>
        {isRegistered && (
          <View style={styles.complianceItem}>
            <Text style={styles.complianceIcon}>✓</Text>
            <Text style={styles.complianceText}>TruckMates Platform Connected</Text>
          </View>
        )}
      </View>

      {/* Device Info */}
      {deviceId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID:</Text>
            <Text style={styles.infoValue}>{deviceId.substring(0, 12)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={styles.infoValue}>
              {isRegistered ? 'Registered' : 'Not Registered'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.card,
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 16,
  },
  statusBadge: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusInfoLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  statusInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  timerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timerItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  timerLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  timerWarning: {
    color: COLORS.error,
  },
  timerLimit: {
    fontSize: 10,
    color: COLORS.mutedForeground,
  },
  weeklyHoursContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  weeklyHoursItem: {
    alignItems: 'center',
  },
  weeklyHoursLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  weeklyHoursValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  weeklyHoursRemaining: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  ruleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ruleLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    flex: 1,
  },
  ruleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  alertCard: {
    backgroundColor: COLORS.warning + '20',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.warning,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
    color: COLORS.foreground,
  },
  violationsCard: {
    backgroundColor: COLORS.error + '20',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  violationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 12,
  },
  violationItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.error + '40',
  },
  violationSeverity: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 4,
  },
  violationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  violationDescription: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginBottom: 4,
  },
  violationTime: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  complianceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  complianceIcon: {
    fontSize: 18,
    color: COLORS.success,
    marginRight: 12,
  },
  complianceText: {
    fontSize: 14,
    color: COLORS.foreground,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
  },
})
