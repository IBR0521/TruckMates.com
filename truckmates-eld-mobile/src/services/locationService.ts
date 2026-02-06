/**
 * Location Tracking Service
 * Handles GPS tracking with background location services
 */

import NetInfo from '@react-native-community/netinfo'
import { Platform } from 'react-native'
import type { Location } from '@/types'
import { LOCATION_UPDATE_INTERVAL, LOCATION_ACCURACY } from '@/constants/config'

// Dynamically import geolocation service to handle native module issues
let GeolocationService: any = null
try {
  GeolocationService = require('react-native-geolocation-service').default
} catch (error) {
  console.warn('react-native-geolocation-service not available, using fallback')
}

export interface LocationWatcher {
  watchId: number
  onLocationUpdate: (location: Location) => void
  onError?: (error: any) => void
}

/**
 * Request location permissions (Android & iOS)
 */
export async function requestLocationPermissions(): Promise<boolean> {
  if (!GeolocationService) {
    console.warn('GeolocationService not available')
    return false
  }
  
  try {
    if (Platform.OS === 'android') {
      const granted = await GeolocationService.requestAuthorization('whenInUse')
      return granted === 'granted'
    } else {
      // iOS - request authorization
      const granted = await GeolocationService.requestAuthorization('whenInUse')
      return granted === 'granted'
    }
  } catch (error) {
    console.error('Error requesting location permission:', error)
    return false
  }
}

/**
 * Check if location permissions are granted
 */
export async function checkLocationPermissions(): Promise<boolean> {
  if (!GeolocationService) {
    return false
  }
  
  try {
    const hasPermission = await GeolocationService.requestAuthorization('whenInUse')
    return hasPermission === 'granted'
  } catch (error) {
    console.error('Error checking location permissions:', error)
    return false
  }
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<Location | null> {
  if (!GeolocationService) {
    console.warn('GeolocationService not available, cannot get location')
    return null
  }
  
  return new Promise((resolve) => {
    try {
      GeolocationService.getCurrentPosition(
        (position: any) => {
          const location: Location = {
            timestamp: new Date().toISOString(),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed ? position.coords.speed * 2.237 : undefined, // Convert m/s to MPH
            heading: position.coords.heading || undefined,
            accuracy: position.coords.accuracy,
          }
          resolve(location)
        },
        (error: any) => {
          console.error('Error getting location:', error)
          resolve(null)
        },
        {
          enableHighAccuracy: LOCATION_ACCURACY === 'high',
          timeout: 10000,
          maximumAge: 5000,
        }
      )
    } catch (error) {
      console.error('Error in getCurrentLocation:', error)
      resolve(null)
    }
  })
}

/**
 * Start watching location updates
 * Uses react-native-geolocation-service for better background support
 */
export function watchLocation(
  onLocationUpdate: (location: Location) => void,
  onError?: (error: any) => void
): number {
  if (!GeolocationService) {
    console.warn('GeolocationService not available, cannot watch location')
    onError?.(new Error('GeolocationService not available'))
    return -1
  }
  
  const options = {
    accuracy: {
      android: 'high' as const,
      ios: 'best' as const,
    },
    enableHighAccuracy: true,
    distanceFilter: 10, // Update every 10 meters
    interval: LOCATION_UPDATE_INTERVAL,
    fastestInterval: LOCATION_UPDATE_INTERVAL / 2,
    // iOS specific options for background tracking
    showsBackgroundLocationIndicator: true,
    // Android specific options
    forceRequestLocation: true,
    forceLocationManager: false,
    locationProvider: 'auto' as const,
  }

  try {
    // Use react-native-geolocation-service for both iOS and Android
    const watchId = GeolocationService.watchPosition(
      (position: any) => {
        const location: Location = {
          timestamp: new Date().toISOString(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed ? position.coords.speed * 2.237 : undefined, // Convert m/s to MPH
          heading: position.coords.heading || undefined,
          accuracy: position.coords.accuracy,
        }
        onLocationUpdate(location)
      },
      (error: any) => {
        console.error('Location watch error:', error)
        onError?.(error)
      },
      options
    )
    return watchId
  } catch (error) {
    console.error('Error in watchLocation:', error)
    onError?.(error as Error)
    return -1
  }
}

/**
 * Stop watching location
 */
export function stopWatchingLocation(watchId: number): void {
  if (!GeolocationService || watchId === -1) {
    return
  }
  
  try {
    GeolocationService.clearWatch(watchId)
  } catch (error) {
    console.error('Error stopping location watch:', error)
  }
}

/**
 * Check network connectivity
 */
export async function isNetworkAvailable(): Promise<boolean> {
  const netInfo = await NetInfo.fetch()
  return netInfo.isConnected ?? false
}

