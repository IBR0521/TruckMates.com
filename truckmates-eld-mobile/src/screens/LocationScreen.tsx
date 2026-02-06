/**
 * Location Screen - GPS Location Display
 * Clean, compact dashboard-style layout for GPS information
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { MainTabParamList } from '../App'
import { getCurrentLocation } from '../services/locationService'
import { locationTrackingService } from '../services/locationTrackingService'
import { useELDDevice } from '../hooks/useELDDevice'
import { COLORS } from '../constants/colors'
import type { Location } from '../types'

type LocationScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Location'
>

export default function LocationScreen() {
  const navigation = useNavigation<LocationScreenNavigationProp>()
  const { isRegistered, deviceId } = useELDDevice()
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTracking, setIsTracking] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadLocation()
      setIsTracking(locationTrackingService.getTrackingStatus())
    }, [])
  )
  
  useEffect(() => {
    // Subscribe to location updates from tracking service instead of polling
    setIsTracking(locationTrackingService.getTrackingStatus())
    
    // Get initial location if available
    if (locationTrackingService.getTrackingStatus()) {
      getCurrentLocation().then((location) => {
        if (location) {
          setCurrentLocation(location)
          setLastUpdate(new Date())
        }
      }).catch(() => {
        // Ignore errors
      })
    }
    
    // Subscribe to real-time location updates
    const unsubscribe = locationTrackingService.subscribeToLocationUpdates((location) => {
      setCurrentLocation(location)
      setLastUpdate(new Date())
      setIsTracking(locationTrackingService.getTrackingStatus())
    })

    // Only update tracking status periodically (not location - that comes from service)
    const statusInterval = setInterval(() => {
      setIsTracking(locationTrackingService.getTrackingStatus())
    }, 5000)

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      clearInterval(statusInterval)
    }
  }, [])

  async function loadLocation() {
    setIsLoading(true)
    try {
      const location = await getCurrentLocation()
      if (location) {
        setCurrentLocation(location)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error loading location:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatSpeed(speed?: number): string {
    if (speed === undefined || speed === null || speed < 0) return '0 MPH'
    return `${Math.abs(speed).toFixed(0)} MPH`
  }

  function formatHeading(heading?: number): string {
    if (heading === undefined || heading === null) return 'N/A'
    // Normalize heading to 0-360
    let normalizedHeading = heading
    while (normalizedHeading < 0) normalizedHeading += 360
    while (normalizedHeading >= 360) normalizedHeading -= 360
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(normalizedHeading / 45) % 8
    return `${directions[index]} ${normalizedHeading.toFixed(0)}°`
  }

  function formatAccuracy(accuracy?: number): string {
    if (accuracy === undefined || accuracy === null) return 'N/A'
    return `${accuracy.toFixed(0)}m`
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GPS Location</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadLocation}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tracking Status Badge */}
      <View style={[styles.trackingBadge, { backgroundColor: isTracking ? COLORS.success + '20' : COLORS.destructive + '20' }]}>
        <View style={[styles.trackingDot, { backgroundColor: isTracking ? COLORS.success : COLORS.destructive }]} />
        <View style={styles.trackingTextContainer}>
          <Text style={[styles.trackingText, { color: isTracking ? COLORS.success : COLORS.destructive }]}>
            {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
          </Text>
          {!isRegistered && (
            <Text style={styles.trackingSubtext}>
              Register ELD device to start tracking
            </Text>
          )}
        </View>
      </View>

      {isLoading && !currentLocation ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      ) : currentLocation ? (
        <>
          {/* Main Coordinates Display */}
          <View style={styles.coordinatesCard}>
            <Text style={styles.coordinatesLabel}>Coordinates</Text>
            <Text style={styles.coordinatesValue} selectable>
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
            <View style={styles.coordinatesRow}>
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateItemLabel}>Lat</Text>
                <Text style={styles.coordinateItemValue}>{currentLocation.latitude.toFixed(6)}°</Text>
              </View>
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateItemLabel}>Lng</Text>
                <Text style={styles.coordinateItemValue}>{currentLocation.longitude.toFixed(6)}°</Text>
              </View>
            </View>
          </View>

          {/* Speed & Heading Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>{formatSpeed(currentLocation.speed)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Heading</Text>
              <Text style={styles.metricValue}>{formatHeading(currentLocation.heading)}</Text>
            </View>
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Accuracy</Text>
              <Text style={styles.detailValue}>{formatAccuracy(currentLocation.accuracy)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Last Update</Text>
              <Text style={styles.detailValue}>
                {lastUpdate ? lastUpdate.toLocaleTimeString() : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Timestamp */}
          <View style={styles.timestampCard}>
            <Text style={styles.timestampLabel}>Location Timestamp</Text>
            <Text style={styles.timestampValue}>
              {new Date(currentLocation.timestamp).toLocaleString()}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to get location</Text>
          <Text style={styles.errorSubtext}>
            Please ensure location permissions are enabled
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLocation}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  trackingTextContainer: {
    flex: 1,
  },
  trackingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trackingSubtext: {
    fontSize: 11,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.mutedForeground,
  },
  coordinatesCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coordinatesLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
    fontWeight: '500',
  },
  coordinatesValue: {
    fontSize: 18,
    color: COLORS.foreground,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  coordinateItem: {
    flex: 1,
  },
  coordinateItemLabel: {
    fontSize: 11,
    color: COLORS.mutedForeground,
    marginBottom: 4,
  },
  coordinateItemValue: {
    fontSize: 14,
    color: COLORS.foreground,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.foreground,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  timestampCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timestampLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 8,
  },
  timestampValue: {
    fontSize: 14,
    color: COLORS.foreground,
    fontFamily: 'monospace',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.destructive,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
