/**
 * Location Tracking Service
 * Handles GPS tracking with background location services
 */

import Geolocation from '@react-native-community/geolocation'
import NetInfo from '@react-native-community/netinfo'
import type { Location } from '@/types'
import { LOCATION_UPDATE_INTERVAL, LOCATION_ACCURACY } from '@/constants/config'

export interface LocationWatcher {
  watchId: number
  onLocationUpdate: (location: Location) => void
  onError?: (error: any) => void
}

/**
 * Request location permissions (Android & iOS)
 */
export async function requestLocationPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true), // Success
      () => resolve(false) // Error/Denied
    )
  })
}

/**
 * Check if location permissions are granted
 */
export async function checkLocationPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 5000 }
    )
  })
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<Location | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) => {
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
      (error) => {
        console.error('Error getting location:', error)
        resolve(null)
      },
      {
        enableHighAccuracy: LOCATION_ACCURACY === 'high',
        timeout: 10000,
        maximumAge: 5000,
      }
    )
  })
}

/**
 * Start watching location updates
 */
export function watchLocation(
  onLocationUpdate: (location: Location) => void,
  onError?: (error: any) => void
): number {
  const watchId = Geolocation.watchPosition(
    (position) => {
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
    (error) => {
      console.error('Location watch error:', error)
      onError?.(error)
    },
    {
      enableHighAccuracy: LOCATION_ACCURACY === 'high',
      distanceFilter: 10, // Update every 10 meters
      interval: LOCATION_UPDATE_INTERVAL,
      fastestInterval: LOCATION_UPDATE_INTERVAL / 2,
    }
  )

  return watchId
}

/**
 * Stop watching location
 */
export function stopWatchingLocation(watchId: number): void {
  Geolocation.clearWatch(watchId)
}

/**
 * Check network connectivity
 */
export async function isNetworkAvailable(): Promise<boolean> {
  const netInfo = await NetInfo.fetch()
  return netInfo.isConnected ?? false
}

