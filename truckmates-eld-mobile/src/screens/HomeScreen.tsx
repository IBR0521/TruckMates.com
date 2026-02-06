/**
 * Home Screen - Professional ELD Dashboard
 * Main screen with status circle, HOS timers, and quick actions
 * Fully integrated with TruckMates platform
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainTabParamList, RootStackParamList } from '../App'
import { useHOSStatus } from '../hooks/useHOSStatus'
import { useELDDevice } from '../hooks/useELDDevice'
import { getCurrentLocation } from '../services/locationService'
import { locationTrackingService } from '../services/locationTrackingService'
import { queueLog, queueEvent, syncAllQueues } from '../services/syncService'
import { COLORS } from '../constants/colors'
import { HOS_RULES } from '../constants/config'
import type { LogType, Location } from '../types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import StatusChangeModal from '../components/StatusChangeModal'

type HomeScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Home'
> & NativeStackNavigationProp<RootStackParamList>

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>()
  const {
    currentStatus,
    statusStartTime,
    remainingDriveTime,
    remainingOnDutyTime,
    isBreakRequired,
    violations,
    changeStatus,
  } = useHOSStatus()
  const { deviceId, isRegistered } = useELDDevice()
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [statusChangeModalVisible, setStatusChangeModalVisible] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<LogType | null>(null)

  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null
    let locationUnsubscribe: (() => void) | null = null

    async function init() {
      // Get initial location (only once, not on every render)
      const location = await getCurrentLocation()
      if (location) {
        setCurrentLocation(location)
      }

      // Subscribe to location updates from global tracking service
      // Only start if not already tracking to avoid duplicate tracking
      if (deviceId && !locationTrackingService.getTrackingStatus()) {
        locationTrackingService.updateDeviceId(deviceId)
        const started = await locationTrackingService.startTracking(deviceId)
        setIsTracking(started)
        if (started) {
          // Subscribe to updates
          locationUnsubscribe = locationTrackingService.subscribeToLocationUpdates((location) => {
            setCurrentLocation(location)
            setIsTracking(locationTrackingService.getTrackingStatus())
          })
        }
      } else if (deviceId) {
        // Already tracking, just subscribe to updates
        locationTrackingService.updateDeviceId(deviceId)
        locationUnsubscribe = locationTrackingService.subscribeToLocationUpdates((location) => {
          setCurrentLocation(location)
          setIsTracking(locationTrackingService.getTrackingStatus())
        })
        setIsTracking(locationTrackingService.getTrackingStatus())
      }

      await loadLastSyncTime()
      
      // Auto-sync every 2 minutes (reduced frequency)
      syncInterval = setInterval(() => {
        if (deviceId) {
          syncWithTruckMates()
        }
      }, 2 * 60 * 1000)
    }

    init()

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval)
      }
      if (locationUnsubscribe) {
        locationUnsubscribe()
      }
    }
  }, [deviceId])

  async function loadLastSyncTime() {
    try {
      const lastSync = await AsyncStorage.getItem('@eld/last_sync')
      setLastSyncTime(lastSync)
    } catch (error) {
      console.error('Error loading last sync time:', error)
    }
  }

  async function syncWithTruckMates() {
    if (!deviceId || isSyncing) return

    setIsSyncing(true)
    try {
      const results = await syncAllQueues(deviceId)
      setLastSyncTime(new Date().toISOString())
      
      if (results.errors.length > 0) {
        console.warn('Sync completed with errors:', results.errors)
      }
    } catch (error) {
      console.error('Error syncing with TruckMates:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  function handleStatusChangePress(newStatus: LogType) {
    if (newStatus === currentStatus) {
      return
    }
    setPendingStatus(newStatus)
    setStatusChangeModalVisible(true)
  }

  async function handleStatusChangeConfirm(
    newStatus: LogType,
    location: { lat: number; lng: number },
    odometer: number,
    notes?: string
  ) {
    try {
      // Create log entry for previous status
      if (currentStatus !== newStatus && deviceId) {
        const previousLog = {
          log_date: new Date().toISOString().split('T')[0],
          log_type: currentStatus,
          start_time: statusStartTime,
          end_time: new Date().toISOString(),
          location_end: location,
          odometer_end: odometer,
          notes: notes, // Save notes with the log
        }
        await queueLog(deviceId, previousLog)
      }

      // Change status
      await changeStatus(newStatus, location, odometer, notes)

      // Sync violations if any
      if (violations.length > 0 && deviceId) {
        for (const violation of violations) {
          await queueEvent(deviceId, violation)
        }
      }

      // Sync immediately
      await syncWithTruckMates()

      Alert.alert(
        'Status Changed',
        `Status changed to ${getStatusLabel(newStatus)}`,
        [{ text: 'OK' }]
      )
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change status')
      throw error
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
      sleeper_berth: 'SLEEPER',
      personal_conveyance: 'PERSONAL CONVEYANCE',
      yard_moves: 'YARD MOVES',
    }
    return labels[status] || 'OFF DUTY'
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
      case 'personal_conveyance':
        return '#9B59B6'
      case 'yard_moves':
        return '#3498DB'
      default:
        return COLORS.mutedForeground
    }
  }

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
      const start = new Date(statusStartTime)
      const now = new Date()
      const minutes = Math.floor((now.getTime() - start.getTime()) / 60000)
      return formatTime(minutes)
    } catch (error) {
      return '0m'
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TruckMates ELD</Text>
          <Text style={styles.headerSubtitle}>Electronic Logging Device</Text>
        </View>
        <View style={styles.headerRight}>
          {isSyncing && (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.syncIndicator} />
          )}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Circle - Industry Standard */}
      <View style={styles.statusCircleContainer}>
        <TouchableOpacity
          style={[styles.statusCircle, { backgroundColor: getStatusColor(currentStatus) }]}
          onPress={() => navigation.navigate('Status')}
          activeOpacity={0.8}
        >
          <Text style={styles.statusCircleText} numberOfLines={1}>
            {getStatusLabel(currentStatus)}
          </Text>
          <Text style={styles.statusCircleDuration}>
            {getStatusDuration()}
          </Text>
        </TouchableOpacity>
        <Text style={styles.statusCircleLabel}>Current Status</Text>
      </View>

      {/* HOS Timers - Critical Information */}
      <View style={styles.hosContainer}>
        <View style={styles.hosTimer}>
          <Text style={styles.hosLabel}>Remaining Drive Time</Text>
          <Text style={[
            styles.hosValue,
            remainingDriveTime < 60 && styles.hosWarning
          ]}>
            {formatTime(remainingDriveTime)}
          </Text>
          <Text style={styles.hosLimit}>Max: {HOS_RULES.MAX_DRIVE_TIME_HOURS}h</Text>
        </View>
        <View style={styles.hosTimer}>
          <Text style={styles.hosLabel}>Remaining On-Duty Time</Text>
          <Text style={[
            styles.hosValue,
            remainingOnDutyTime < 60 && styles.hosWarning
          ]}>
            {formatTime(remainingOnDutyTime)}
          </Text>
          <Text style={styles.hosLimit}>Max: {HOS_RULES.MAX_ON_DUTY_TIME_HOURS}h</Text>
        </View>
      </View>

      {/* Violation Alerts */}
      {violations.length > 0 && (
        <View style={styles.violationContainer}>
          <View style={styles.violationTitleRow}>
            <Text style={styles.alertIcon}>!</Text>
            <Text style={styles.violationTitle}>HOS Violations</Text>
          </View>
          {violations.map((violation, index) => (
            <View key={index} style={styles.violationItem}>
              <Text style={styles.violationText}>{violation.title}</Text>
              {violation.description && (
                <Text style={styles.violationDescription}>{violation.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Break Required Alert */}
      {isBreakRequired && (
        <View style={styles.breakAlert}>
          <View style={styles.breakRequiredRow}>
            <Text style={styles.alertIconSmall}>!</Text>
            <View style={styles.breakAlertContent}>
              <Text style={styles.breakAlertText}>
                30-minute break required after 8 hours on duty
              </Text>
              <Text style={styles.breakAlertSubtext}>
                Take a break to avoid HOS violation
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Status')}
          >
            <Text style={styles.actionButtonText}>View Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Logs')}
          >
            <Text style={styles.actionButtonText}>View Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.dotInspectionButton]}
            onPress={() => navigation.navigate('DOTInspection')}
          >
            <Text style={[styles.actionButtonText, styles.dotInspectionButtonText]}>
              🔒 DOT Inspection
            </Text>
            <Text style={styles.dotInspectionSubtext}>
              One-tap access for DOT officers
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Change Buttons */}
      <View style={styles.statusChangeContainer}>
        <Text style={styles.sectionTitle}>Change Status</Text>
        <View style={styles.statusButtonsGrid}>
          {(['driving', 'on_duty', 'off_duty', 'sleeper_berth'] as LogType[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusButton,
                currentStatus === status && {
                  backgroundColor: getStatusColor(status),
                  borderColor: getStatusColor(status),
                },
              ]}
              onPress={() => handleStatusChangePress(status)}
            >
              <Text style={[
                styles.statusButtonText,
                currentStatus === status && styles.statusButtonTextActive
              ]}>
                {getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.specialStatusLabel}>Special Statuses</Text>
        <View style={styles.statusButtonsGrid}>
          {(['personal_conveyance', 'yard_moves'] as LogType[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusButton,
                currentStatus === status && {
                  backgroundColor: getStatusColor(status),
                  borderColor: getStatusColor(status),
                },
              ]}
              onPress={() => handleStatusChangePress(status)}
            >
              <Text style={[
                styles.statusButtonText,
                currentStatus === status && styles.statusButtonTextActive
              ]}>
                {getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={[styles.statusIcon, { color: isRegistered ? COLORS.success : COLORS.destructive }]}>
            {isRegistered ? '✓' : '✗'}
          </Text>
          <Text style={styles.footerText}>
            {isRegistered ? 'Device Registered' : 'Device Not Registered'}
          </Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={[styles.statusIcon, { color: isTracking ? COLORS.success : COLORS.destructive }]}>
            {isTracking ? '✓' : '✗'}
          </Text>
          <Text style={styles.footerText}>
            {isTracking ? 'Location Tracking Active' : 'Location Tracking Inactive'}
          </Text>
        </View>
        {lastSyncTime && (
          <Text style={styles.footerText}>
            Last Sync: {new Date(lastSyncTime).toLocaleTimeString()}
          </Text>
        )}
        {currentLocation && (
          <Text style={styles.footerText}>
            Location: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
          </Text>
        )}
        {currentLocation?.speed !== undefined && (
          <Text style={styles.footerText}>
            Speed: {currentLocation.speed.toFixed(0)} MPH
          </Text>
        )}
      </View>

      {/* Status Change Modal */}
      <StatusChangeModal
        visible={statusChangeModalVisible}
        currentStatus={currentStatus}
        onClose={() => {
          setStatusChangeModalVisible(false)
          setPendingStatus(null)
        }}
        onConfirm={handleStatusChangeConfirm}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: COLORS.card,
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIndicator: {
    marginRight: 4,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingsButtonText: {
    fontSize: 14,
    color: COLORS.foreground,
    fontWeight: '500',
  },
  alertIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.destructive,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.destructive + '20',
    textAlign: 'center',
    lineHeight: 24,
  },
  alertIconSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.destructive,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.destructive + '20',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 18,
    textAlign: 'center',
  },
  statusCircleContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: COLORS.card,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusCircleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  statusCircleDuration: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    opacity: 0.9,
  },
  statusCircleLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    marginTop: 12,
  },
  hosContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  hosTimer: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  hosLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  hosValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  hosWarning: {
    color: COLORS.error,
  },
  hosLimit: {
    fontSize: 10,
    color: COLORS.mutedForeground,
  },
  violationContainer: {
    backgroundColor: COLORS.error + '20',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  violationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  violationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  violationItem: {
    marginBottom: 8,
  },
  violationText: {
    fontSize: 14,
    color: COLORS.foreground,
    fontWeight: '600',
  },
  violationDescription: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  breakAlert: {
    backgroundColor: COLORS.warning + '20',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  breakAlertText: {
    fontSize: 14,
    color: COLORS.warning,
    textAlign: 'center',
  },
  actionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dotInspectionButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginTop: 8,
  },
  dotInspectionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  dotInspectionSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '400',
  },
  statusChangeContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statusButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  specialStatusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.mutedForeground,
    marginTop: 16,
    marginBottom: 8,
  },
  footer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  breakRequiredRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  breakAlertContent: {
    flex: 1,
  },
  breakAlertSubtext: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
})
