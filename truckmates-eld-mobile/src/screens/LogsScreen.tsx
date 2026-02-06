/**
 * Logs Screen - FMCSA Graph-Grid Format
 * 24-hour timeline visualization of HOS logs
 * Standard format for DOT inspections
 * Integrated with TruckMates platform
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useHOSStatus } from '../hooks/useHOSStatus'
import { COLORS } from '../constants/colors'
import type { HOSLog, LogType } from '../types'

const SCREEN_WIDTH = Dimensions.get('window').width
const HOUR_WIDTH = SCREEN_WIDTH / 24 // Each hour = 1/24 of screen width

export default function LogsScreen() {
  const { currentStatus, statusStartTime } = useHOSStatus()
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [logs, setLogs] = useState<HOSLog[]>([])
  const [lastStatusChange, setLastStatusChange] = useState<string>('')

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadLogsForDate(selectedDate)
    }, [selectedDate])
  )
  
  // Track status changes to force reload
  useEffect(() => {
    const statusKey = `${currentStatus}-${statusStartTime}`
    if (statusKey !== lastStatusChange) {
      setLastStatusChange(statusKey)
      // Small delay to ensure AsyncStorage is updated
      setTimeout(() => {
        loadLogsForDate(selectedDate)
      }, 100)
    }
  }, [currentStatus, statusStartTime, selectedDate])

  // Reload logs immediately when date changes
  useEffect(() => {
    loadLogsForDate(selectedDate)
  }, [selectedDate])

  // Also reload logs periodically to catch any missed updates
  // Reduced frequency to improve performance
  useEffect(() => {
    const interval = setInterval(() => {
      loadLogsForDate(selectedDate)
    }, 10000) // Check every 10 seconds instead of 3

    return () => clearInterval(interval)
  }, [selectedDate])

  async function loadLogsForDate(date: string) {
    try {
      const allLogs = await AsyncStorage.getItem('@eld/recent_logs')
      const dayLogs: HOSLog[] = []
      
      if (allLogs) {
        const parsedLogs: any[] = JSON.parse(allLogs)
        
        // Clean and validate logs
        const cleanedLogs = parsedLogs
          .map((log) => {
            // Handle corrupted log entries
            if (typeof log === 'string') {
              try {
                log = JSON.parse(log)
              } catch (e) {
                return null
              }
            }
            
            // Extract log_type from various formats
            let logType: LogType = 'off_duty'
            if (log.log_type) {
              logType = log.log_type
            } else if (log.Status) {
              // Map Status to log_type
              const statusMap: Record<string, LogType> = {
                'Sleeper Berth': 'sleeper_berth',
                'Sleeper': 'sleeper_berth',
                'Driving': 'driving',
                'On Duty': 'on_duty',
                'Off Duty': 'off_duty',
              }
              logType = statusMap[log.Status] || 'off_duty'
            } else if (log.status) {
              logType = log.status
            }
            
            // Ensure we have required fields
            if (!log.start_time) {
              return null
            }
            
            return {
              log_date: log.log_date || new Date(log.start_time).toISOString().split('T')[0],
              log_type: logType,
              start_time: log.start_time || log.StartTime,
              end_time: log.end_time || log.EndTime || null,
              duration_minutes: log.duration_minutes,
              location_start: log.location_start,
              location_end: log.location_end,
              odometer_start: log.odometer_start,
              odometer_end: log.odometer_end,
              miles_driven: log.miles_driven,
              notes: log.notes,
              certified: log.certified,
            } as HOSLog
          })
          .filter((log): log is HOSLog => log !== null)
        
        const filteredLogs = cleanedLogs.filter((log) => log.log_date === date)
        dayLogs.push(...filteredLogs)
      }

      // Add current ongoing status if it's for today
      // This should be the ONLY ongoing log (no end_time)
      const today = new Date().toISOString().split('T')[0]
      if (date === today && currentStatus && statusStartTime) {
        const currentLogDate = new Date(statusStartTime).toISOString().split('T')[0]
        if (currentLogDate === date) {
          // Remove any old ongoing logs (they should have been closed when status changed)
          // Only keep logs that have an end_time (closed) or match current status
          const cleanedLogs = dayLogs.filter((log) => {
            // Remove any ongoing logs that don't match current status/start_time
            if (log.end_time === null) {
              return log.start_time === statusStartTime && log.log_type === currentStatus
            }
            return true // Keep all closed logs
          })
          
          // Check if current status is already in the list as ongoing
          const existingOngoingLog = cleanedLogs.find(
            (log) => 
              log.start_time === statusStartTime && 
              log.log_type === currentStatus &&
              log.end_time === null
          )
          
          if (!existingOngoingLog) {
            // Add current status as ongoing
            const currentLog: HOSLog = {
              log_date: date,
              log_type: currentStatus,
              start_time: statusStartTime,
              end_time: null, // Ongoing
              duration_minutes: Math.floor((new Date().getTime() - new Date(statusStartTime).getTime()) / 60000),
            }
            cleanedLogs.push(currentLog)
          } else {
            // Update duration for existing ongoing log
            existingOngoingLog.duration_minutes = Math.floor(
              (new Date().getTime() - new Date(statusStartTime).getTime()) / 60000
            )
          }
          
          // Replace dayLogs with cleaned version
          dayLogs.length = 0
          dayLogs.push(...cleanedLogs)
        }
      }

      // Sort by start time
      dayLogs.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )

      setLogs(dayLogs)
    } catch (error) {
      console.error('Error loading logs:', error)
      setLogs([])
    }
  }

  function getLogTypeColor(logType: LogType | any): string {
    // Extract actual log type if it's an object
    let actualType: string = logType
    
    if (typeof logType === 'object' && logType !== null) {
      if (logType.log_type) {
        actualType = logType.log_type
      } else if (logType.Status) {
        // Map Status to log_type
        const statusMap: Record<string, LogType> = {
          'Sleeper Berth': 'sleeper_berth',
          'Sleeper': 'sleeper_berth',
          'Driving': 'driving',
          'On Duty': 'on_duty',
          'Off Duty': 'off_duty',
        }
        actualType = statusMap[logType.Status] || 'off_duty'
      } else if (logType.status) {
        actualType = logType.status
      } else {
        return COLORS.mutedForeground
      }
    }
    
    // Handle JSON string
    if (typeof actualType === 'string' && actualType.startsWith('{')) {
      try {
        const parsed = JSON.parse(actualType)
        if (parsed.Status) {
          const statusMap: Record<string, LogType> = {
            'Sleeper Berth': 'sleeper_berth',
            'Sleeper': 'sleeper_berth',
            'Driving': 'driving',
            'On Duty': 'on_duty',
            'Off Duty': 'off_duty',
          }
          actualType = statusMap[parsed.Status] || 'off_duty'
        }
      } catch (e) {
        return COLORS.mutedForeground
      }
    }
    
    switch (actualType) {
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

  function getLogTypeLabel(logType: LogType | any): string {
    // Handle if logType is an object or JSON string
    if (typeof logType === 'object' && logType !== null) {
      // Try to extract status from object
      if (logType.Status) {
        return logType.Status.toUpperCase()
      }
      if (logType.status) {
        return logType.status.toUpperCase()
      }
      if (logType.log_type) {
        logType = logType.log_type
      } else {
        return 'UNKNOWN'
      }
    }
    
    // Handle if it's a JSON string
    if (typeof logType === 'string' && logType.startsWith('{')) {
      try {
        const parsed = JSON.parse(logType)
        if (parsed.Status) {
          return parsed.Status.toUpperCase()
        }
        if (parsed.status) {
          return parsed.status.toUpperCase()
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }
    
    // Normal string handling
    if (typeof logType !== 'string') {
      return 'UNKNOWN'
    }
    
    const labels: Record<LogType, string> = {
      driving: 'DRIVING',
      on_duty: 'ON DUTY',
      off_duty: 'OFF DUTY',
      sleeper_berth: 'SLEEPER BERTH',
    }
    
    return labels[logType as LogType] || logType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  function getHourFromTime(timeString: string): number {
    try {
      const date = new Date(timeString)
      if (isNaN(date.getTime())) {
        return 0
      }
      return date.getHours() + date.getMinutes() / 60
    } catch (error) {
      return 0
    }
  }

  function formatTime(minutes: number | undefined): string {
    if (!minutes) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  // Generate 24-hour timeline blocks
  function generateTimelineBlocks() {
    const blocks: Array<{
      log: HOSLog
      startHour: number
      endHour: number
      width: number
      left: number
    }> = []

    logs.forEach((log) => {
      if (!log.start_time) return
      
      const startHour = getHourFromTime(log.start_time)
      const endHour = log.end_time
        ? getHourFromTime(log.end_time)
        : new Date().getHours() + new Date().getMinutes() / 60
      
      // Ensure valid hours
      if (isNaN(startHour) || isNaN(endHour)) return
      
      const duration = Math.max(0, endHour - startHour)
      const width = Math.max(duration * HOUR_WIDTH, 20) // Minimum width for visibility
      const left = Math.max(0, Math.min(startHour * HOUR_WIDTH, SCREEN_WIDTH - width))

      blocks.push({
        log,
        startHour,
        endHour,
        width,
        left,
      })
    })

    return blocks
  }

  const timelineBlocks = generateTimelineBlocks()

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>HOS Logs</Text>
        <Text style={styles.subtitle}>FMCSA Graph-Grid Format</Text>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => {
            const prevDate = new Date(selectedDate)
            prevDate.setDate(prevDate.getDate() - 1)
            setSelectedDate(prevDate.toISOString().split('T')[0])
          }}
        >
          <Text style={styles.dateButtonText}>← Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setSelectedDate(new Date().toISOString().split('T')[0])
            loadLogsForDate(new Date().toISOString().split('T')[0])
          }}
        >
          <Text style={styles.dateText}>{selectedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => {
            const nextDate = new Date(selectedDate)
            nextDate.setDate(nextDate.getDate() + 1)
            const today = new Date().toISOString().split('T')[0]
            if (nextDate.toISOString().split('T')[0] <= today) {
              setSelectedDate(nextDate.toISOString().split('T')[0])
            }
          }}
          disabled={selectedDate >= new Date().toISOString().split('T')[0]}
        >
          <Text style={[
            styles.dateButtonText,
            selectedDate >= new Date().toISOString().split('T')[0] && styles.dateButtonTextDisabled
          ]}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Graph-Grid Timeline */}
      <View style={styles.graphGridContainer}>
        <Text style={styles.graphGridTitle}>24-Hour Timeline</Text>
        
        {/* Hour markers */}
        <View style={styles.hourMarkers}>
          {Array.from({ length: 25 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.hourMarker,
                { left: index * HOUR_WIDTH },
              ]}
            >
              <Text style={styles.hourMarkerText}>
                {index % 2 === 0 ? index : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Timeline blocks */}
        <View style={styles.timelineContainer}>
          {timelineBlocks.length > 0 ? (
            timelineBlocks.map((block, index) => (
              <View
                key={index}
                style={[
                  styles.timelineBlock,
                  {
                    backgroundColor: getLogTypeColor(block.log.log_type),
                    width: Math.max(block.width, 30),
                    left: Math.max(0, Math.min(block.left, SCREEN_WIDTH - 50)),
                  },
                ]}
              >
                <Text style={styles.timelineBlockText} numberOfLines={1}>
                  {getLogTypeLabel(block.log.log_type)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.timelineEmpty}>
              <Text style={styles.timelineEmptyText}>No activity for this date</Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.driving }]} />
            <Text style={styles.legendText}>Driving</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.onDuty }]} />
            <Text style={styles.legendText}>On Duty</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.offDuty }]} />
            <Text style={styles.legendText}>Off Duty</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.sleeper }]} />
            <Text style={styles.legendText}>Sleeper</Text>
          </View>
        </View>
      </View>

      {/* Log Details List */}
      <View style={styles.logsListContainer}>
        <Text style={styles.logsListTitle}>Log Entries</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No log entries for this date</Text>
            <Text style={styles.emptySubtext}>
              Log entries will appear here as you change your status
            </Text>
          </View>
        ) : (
          logs.map((log, index) => {
            // Ensure log_type is properly extracted
            let logType = log.log_type
            if (!logType && typeof log === 'object') {
              // Try to extract from various possible formats
              if ((log as any).Status) {
                const statusMap: Record<string, LogType> = {
                  'Sleeper Berth': 'sleeper_berth',
                  'Sleeper': 'sleeper_berth',
                  'Driving': 'driving',
                  'On Duty': 'on_duty',
                  'Off Duty': 'off_duty',
                }
                logType = statusMap[(log as any).Status] || 'off_duty'
              }
            }
            
            return (
              <View key={index} style={styles.logCard}>
                <View style={styles.logCardHeader}>
                  <View
                    style={[
                      styles.logTypeBadge,
                      { backgroundColor: getLogTypeColor(logType || log.log_type || 'off_duty') },
                    ]}
                  >
                    <Text style={styles.logTypeBadgeText}>
                      {getLogTypeLabel(logType || log.log_type || 'off_duty')}
                    </Text>
                  </View>
                  <Text style={styles.logDate}>{log.log_date || new Date().toISOString().split('T')[0]}</Text>
                </View>
              <View style={styles.logDetails}>
                <View style={styles.logDetailRow}>
                  <Text style={styles.logDetailLabel}>Start:</Text>
                  <Text style={styles.logDetailValue}>
                    {new Date(log.start_time).toLocaleString()}
                  </Text>
                </View>
                {log.end_time ? (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>End:</Text>
                    <Text style={styles.logDetailValue}>
                      {new Date(log.end_time).toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>Status:</Text>
                    <Text style={[styles.logDetailValue, { color: COLORS.primary }]}>
                      ONGOING
                    </Text>
                  </View>
                )}
                {log.duration_minutes !== undefined && (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>Duration:</Text>
                    <Text style={styles.logDetailValue}>
                      {formatTime(log.duration_minutes)}
                    </Text>
                  </View>
                )}
                {log.miles_driven !== undefined && (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>Miles:</Text>
                    <Text style={styles.logDetailValue}>
                      {log.miles_driven.toFixed(1)} mi
                    </Text>
                  </View>
                )}
                {log.location_start && (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>Location:</Text>
                    <Text style={styles.logDetailValue}>
                      {log.location_start.lat.toFixed(4)}, {log.location_start.lng.toFixed(4)}
                    </Text>
                  </View>
                )}
                {log.notes && (
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>Notes:</Text>
                    <Text style={styles.logDetailValue}>{log.notes}</Text>
                  </View>
                )}
                {log.certified && (
                  <View style={styles.logDetailRow}>
                    <Text style={[styles.logDetailLabel, { color: COLORS.success }]}>✓ Certified</Text>
                    {log.certified_date && (
                      <Text style={styles.logDetailValue}>
                        {new Date(log.certified_date).toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
            )
          })
        )}
      </View>

          {/* Certification Notice */}
      <View style={styles.certificationNotice}>
        <Text style={styles.certificationText}>
          ✓ FMCSA Compliant Log Format
        </Text>
        <Text style={styles.certificationSubtext}>
          This log format meets DOT inspection requirements
        </Text>
      </View>
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
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateButton: {
    padding: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dateButtonTextDisabled: {
    color: COLORS.mutedForeground,
    opacity: 0.5,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  graphGridContainer: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  graphGridTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 16,
  },
  hourMarkers: {
    height: 20,
    marginBottom: 8,
    position: 'relative',
  },
  hourMarker: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
  },
  hourMarkerText: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    position: 'absolute',
    top: 22,
    left: -10,
  },
  timelineContainer: {
    height: 60,
    position: 'relative',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timelineBlock: {
    position: 'absolute',
    top: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  timelineBlockText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  timelineEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
  },
  timelineEmptyText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.foreground,
  },
  logsListContainer: {
    margin: 16,
  },
  logsListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: COLORS.card,
    padding: 48,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  logDate: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  logDetails: {
    gap: 8,
  },
  logDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logDetailLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  logDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  certificationNotice: {
    backgroundColor: COLORS.success + '20',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
    alignItems: 'center',
  },
  certificationText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 4,
  },
  certificationSubtext: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },
})
