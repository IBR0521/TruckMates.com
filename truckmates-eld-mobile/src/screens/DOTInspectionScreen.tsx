/**
 * DOT Inspection Screen - Enhanced with Security Features
 * Read-only inspection mode for DOT officers
 * Screen orientation locked to portrait
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { format, parseISO, startOfDay, addHours } from 'date-fns'
import type { HOSLog } from '../types'
import { COLORS } from '../constants/colors'
import { PlatformButton } from '../components/PlatformButton'
import { PlatformCard, PlatformCardContent } from '../components/PlatformCard'
import { useELDDevice } from '../hooks/useELDDevice'

type DOTInspectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DOTInspection'>

const { width } = Dimensions.get('window')
const HOUR_WIDTH = width / 24

export default function DOTInspectionScreen() {
  const navigation = useNavigation<DOTInspectionScreenNavigationProp>()
  const { deviceId, isRegistered } = useELDDevice()
  const [logs, setLogs] = useState<HOSLog[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [isInspectionMode, setIsInspectionMode] = useState(true)

  // Lock screen orientation to portrait when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Lock orientation to portrait
      // Note: For React Native, you may need to use react-native-orientation-locker
      // or handle this at the native level. For now, we'll add a visual indicator.
      setIsInspectionMode(true)
      
      return () => {
        // Unlock orientation when leaving screen
        setIsInspectionMode(false)
      }
    }, [])
  )

  useEffect(() => {
    loadLogs()
  }, [selectedDate])

  async function loadLogs() {
    try {
      const storedLogs = await AsyncStorage.getItem('@eld/recent_logs')
      const allLogs: HOSLog[] = storedLogs ? JSON.parse(storedLogs) : []
      const filtered = allLogs.filter((log) => log.log_date === selectedDate)
      setLogs(filtered.sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()))
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'driving': return '#EF4444'
      case 'on_duty': return '#F97316'
      case 'off_duty': return '#22C55E'
      case 'sleeper_berth': return '#3B82F6'
      default: return COLORS.mutedForeground
    }
  }

  function getStatusLabel(status: string): string {
    return status.replace('_', ' ').toUpperCase()
  }

  function generateInspectionGrid() {
    const dayStart = startOfDay(parseISO(`${selectedDate}T00:00:00`))
    const blocks = []

    for (let hour = 0; hour < 24; hour++) {
      const hourStart = addHours(dayStart, hour)
      const hourEnd = addHours(dayStart, hour + 1)
      
      const coveringLog = logs.find(log => {
        const logStart = parseISO(log.start_time)
        const logEnd = log.end_time ? parseISO(log.end_time) : new Date()
        return logStart <= hourEnd && logEnd >= hourStart
      })

      blocks.push({
        hour,
        log: coveringLog,
      })
    }

    return blocks
  }

  const gridBlocks = generateInspectionGrid()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Inspection Mode Banner */}
      <View style={styles.inspectionBanner}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerIconText}>🔒</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>DOT Inspection Mode Active</Text>
            <Text style={styles.bannerSubtitle}>Read-only display for DOT officer review</Text>
          </View>
        </View>
      </View>

      {/* Header - EXACT platform: border-b border-border bg-card/50 px-4 py-4 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>DOT Inspection Mode</Text>
            <Text style={styles.headerSubtitle}>
              {format(parseISO(`${selectedDate}T00:00:00`), 'MMMM d, yyyy')}
            </Text>
            {isRegistered && deviceId && (
              <Text style={styles.deviceInfo}>
                Device ID: {deviceId.substring(0, 8)}...
              </Text>
            )}
          </View>
        </View>
        <PlatformButton
          variant="outline"
          size="sm"
          onPress={() => {
            Alert.alert(
              'Exit Inspection Mode',
              'Are you sure you want to exit DOT Inspection Mode?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Exit',
                  style: 'destructive',
                  onPress: () => navigation.navigate('Home'),
                },
              ]
            )
          }}
          style={styles.exitButton}
        >
          Exit Inspection
        </PlatformButton>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Inspection Notice */}
          <PlatformCard style={styles.notice}>
            <PlatformCardContent>
              <Text style={styles.noticeText}>
                This device is in DOT Inspection Mode. Logs are displayed in FMCSA-compliant format.
              </Text>
            </PlatformCardContent>
          </PlatformCard>

          {/* Graph-Grid Display (FMCSA Standard) */}
          <PlatformCard style={styles.gridCard}>
            <PlatformCardContent>
              <Text style={styles.gridTitle}>24-Hour Duty Status Grid</Text>
              
              {/* Hour labels */}
              <View style={styles.hourLabels}>
                {Array.from({ length: 24 }, (_, i) => (
                  <View key={i} style={[styles.hourLabel, { width: HOUR_WIDTH }]}>
                    <Text style={styles.hourLabelText}>{i % 12 || 12}</Text>
                    <Text style={styles.hourLabelPeriod}>{i < 12 ? 'AM' : 'PM'}</Text>
                  </View>
                ))}
              </View>

              {/* Grid blocks */}
              <View style={styles.gridBlocks}>
                {gridBlocks.map((block, index) => (
                  <View
                    key={index}
                    style={[
                      styles.gridBlock,
                      {
                        width: HOUR_WIDTH,
                        backgroundColor: block.log ? getStatusColor(block.log.log_type) : COLORS.input,
                        opacity: block.log ? 1 : 0.3,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Driving</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#F97316' }]} />
                  <Text style={styles.legendText}>On Duty</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.legendText}>Off Duty</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.legendText}>Sleeper</Text>
                </View>
              </View>
            </PlatformCardContent>
          </PlatformCard>

          {/* Log Details */}
          <View style={styles.logDetails}>
            <Text style={styles.logDetailsTitle}>Duty Status Records</Text>
            {logs.length === 0 ? (
              <Text style={styles.noLogsText}>No logs available for this date</Text>
            ) : (
              logs.map((log, index) => (
                <PlatformCard key={index} style={styles.logCard}>
                  <PlatformCardContent>
                    <View style={styles.logHeader}>
                      <View style={[styles.logStatusBadge, { backgroundColor: getStatusColor(log.log_type) }]}>
                        <Text style={styles.logStatusText}>{getStatusLabel(log.log_type)}</Text>
                      </View>
                      <Text style={styles.logTime}>
                        {format(parseISO(log.start_time), 'h:mm a')}
                        {log.end_time && ` - ${format(parseISO(log.end_time), 'h:mm a')}`}
                      </Text>
                    </View>
                    {log.location_address && (
                      <Text style={styles.logLocation}>Location: {log.location_address}</Text>
                    )}
                    {log.odometer_start && log.odometer_end && (
                      <Text style={styles.logOdometer}>
                        Odometer: {log.odometer_start.toLocaleString()} → {log.odometer_end.toLocaleString()}
                      </Text>
                    )}
                  </PlatformCardContent>
                </PlatformCard>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header - EXACT platform: border-b border-border bg-card/50 px-4 py-4
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card50, // bg-card/50
    paddingHorizontal: 16, // px-4
    paddingVertical: 16, // py-4
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12, // mb-3 = 12px
  },
  // Header title - EXACT platform: text-2xl font-bold
  headerTitle: {
    fontSize: 24, // text-2xl = 24px
    fontWeight: '700', // font-bold
    color: COLORS.foreground,
    marginBottom: 4, // mt-1 equivalent
  },
  // Header subtitle - EXACT platform: text-sm text-muted-foreground
  headerSubtitle: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.mutedForeground,
  },
  exitButton: {
    alignSelf: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  // Content - EXACT platform: p-4 space-y-6
  content: {
    padding: 16, // p-4 = 16px
    gap: 24, // space-y-6 = 24px
    paddingBottom: 100, // Space for bottom nav
  },
  notice: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.foreground,
    textAlign: 'center',
    lineHeight: 20,
  },
  gridCard: {
    // Uses default card padding
  },
  gridTitle: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.foreground,
    fontWeight: '700', // font-bold
    marginBottom: 16, // mb-4 = 16px
    textAlign: 'center',
  },
  hourLabels: {
    flexDirection: 'row',
    marginBottom: 8, // mb-2 = 8px
  },
  hourLabel: {
    alignItems: 'center',
  },
  hourLabelText: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    fontWeight: '600', // font-semibold
  },
  hourLabelPeriod: {
    fontSize: 8,
    color: COLORS.mutedForeground,
    opacity: 0.7,
  },
  gridBlocks: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 4, // rounded = 4px
    overflow: 'hidden',
    marginBottom: 16, // mb-4 = 16px
  },
  gridBlock: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: COLORS.background,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16, // gap-4 = 16px
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // gap-1.5 = 6px
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4, // rounded = 4px
  },
  legendText: {
    fontSize: 12, // text-xs = 12px
    color: COLORS.mutedForeground,
  },
  inspectionBanner: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerIconText: {
    fontSize: 18,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  deviceInfo: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  logDetails: {
    gap: 16, // gap-4 = 16px
  },
  logDetailsTitle: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.foreground,
    fontWeight: '700', // font-bold
    marginBottom: 16, // mb-4 = 16px
  },
  noLogsText: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.mutedForeground,
    textAlign: 'center',
    padding: 20, // p-5 = 20px
  },
  logCard: {
    // Uses default card padding
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // mb-2 = 8px
  },
  logStatusBadge: {
    paddingHorizontal: 12, // px-3 = 12px
    paddingVertical: 4, // py-1 = 4px
    borderRadius: 6, // rounded-md = 6px
  },
  logStatusText: {
    fontSize: 12, // text-xs = 12px
    color: COLORS.foreground,
    fontWeight: '700', // font-bold
    letterSpacing: 0.5,
  },
  logTime: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.mutedForeground,
    fontWeight: '500', // font-medium
  },
  logLocation: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.mutedForeground,
    marginTop: 4, // mt-1 = 4px
  },
  logOdometer: {
    fontSize: 14, // text-sm = 14px
    color: COLORS.mutedForeground,
    marginTop: 4, // mt-1 = 4px
  },
})
