/**
 * Global Location Tracking Service
 * Continuously tracks driver location even when app is in background
 * Integrates with TruckMates platform
 */

import { AppState, AppStateStatus } from 'react-native'
import { getCurrentLocation, watchLocation, stopWatchingLocation, requestLocationPermissions, checkLocationPermissions } from './locationService'
import { queueLocation, syncAllQueues } from './syncService'
import { LOCATION_UPDATE_INTERVAL } from '../constants/config'
import type { Location } from '../types'

class LocationTrackingService {
  private watchId: number | null = null
  private deviceId: string | null = null
  private isTracking: boolean = false
  private appStateSubscription: any = null
  private syncInterval: NodeJS.Timeout | null = null
  private onLocationUpdateCallback?: (location: Location) => void
  private subscribers: Set<(location: Location) => void> = new Set()
  private restartCount: number = 0 // Track restart attempts to prevent infinite loops
  private readonly MAX_RESTARTS = 5 // Maximum restart attempts before giving up

  /**
   * Start continuous location tracking
   */
  async startTracking(deviceId: string, onLocationUpdate?: (location: Location) => void): Promise<boolean> {
    if (this.isTracking) {
      console.log('Location tracking already started')
      return true
    }

    this.deviceId = deviceId
    this.onLocationUpdateCallback = onLocationUpdate

    // Request permissions first
    const hasPermission = await requestLocationPermissions()
    if (!hasPermission) {
      const hasExistingPermission = await checkLocationPermissions()
      if (!hasExistingPermission) {
        console.error('Location permissions not granted')
        return false
      }
    }

    try {
      // Get initial location
      const initialLocation = await getCurrentLocation()
      if (initialLocation) {
        await this.handleLocationUpdate(initialLocation)
      }

      // Start watching location
      this.watchId = watchLocation(
        (location) => {
          // Reset restart count on successful location update
          this.restartCount = 0
          this.handleLocationUpdate(location)
        },
        (error) => {
          console.error('Location tracking error:', error)
          // Try to restart tracking on error (with limit)
          this.restartTracking()
        }
      )

      // Listen for app state changes to ensure tracking continues
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this))

      // Start auto-sync
      this.startAutoSync()

      this.isTracking = true
      this.restartCount = 0 // Reset restart count on successful start
      console.log('Location tracking started')
      return true
    } catch (error) {
      console.error('Error starting location tracking:', error)
      return false
    }
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      try {
        stopWatchingLocation(this.watchId)
      } catch (error) {
        console.error('Error stopping location watch:', error)
      }
      this.watchId = null
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove()
      this.appStateSubscription = null
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    this.isTracking = false
    console.log('Location tracking stopped')
  }

  /**
   * Restart tracking if it stops
   * CRITICAL FIX: Add restart limit and exponential backoff to prevent infinite loops
   */
  private async restartTracking(): Promise<void> {
    if (!this.deviceId || !this.isTracking) return

    this.restartCount++
    
    // Prevent infinite restart loop
    if (this.restartCount >= this.MAX_RESTARTS) {
      console.error(`Location tracking failed after ${this.MAX_RESTARTS} restart attempts. Stopping tracking.`)
      this.stopTracking()
      // Notify user via Alert (import Alert from react-native)
      const { Alert } = require('react-native')
      Alert.alert(
        'Location Tracking Stopped',
        'Location tracking encountered repeated errors and has been stopped. Please restart the app or check your location permissions.',
        [{ text: 'OK' }]
      )
      return
    }

    console.log(`Restarting location tracking... (attempt ${this.restartCount}/${this.MAX_RESTARTS})`)
    this.stopTracking()
    
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const backoffDelay = 5000 * Math.pow(2, this.restartCount - 1)
    
    // Wait with exponential backoff before restarting
    setTimeout(async () => {
      await this.startTracking(this.deviceId!, this.onLocationUpdateCallback)
    }, backoffDelay)
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(location: Location): Promise<void> {
    try {
      // Call callback if provided
      if (this.onLocationUpdateCallback) {
        this.onLocationUpdateCallback(location)
      }

      // Notify all subscribers
      this.subscribers.forEach((callback) => {
        try {
          callback(location)
        } catch (error) {
          console.error('Error in location subscriber callback:', error)
        }
      })

      // Queue location for sync
      if (this.deviceId) {
        await queueLocation(this.deviceId, location)
      }
    } catch (error) {
      console.error('Error handling location update:', error)
    }
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active' && !this.isTracking && this.deviceId) {
      // Restart tracking when app comes to foreground
      console.log('App became active, restarting location tracking')
      this.startTracking(this.deviceId, this.onLocationUpdateCallback)
    }
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    // Sync every 2 minutes
    this.syncInterval = setInterval(async () => {
      if (this.deviceId) {
        try {
          await syncAllQueues(this.deviceId)
        } catch (error) {
          console.error('Auto-sync error:', error)
        }
      }
    }, 2 * 60 * 1000) // 2 minutes
  }

  /**
   * Get current tracking status
   */
  getTrackingStatus(): boolean {
    return this.isTracking
  }

  /**
   * Update device ID
   */
  updateDeviceId(deviceId: string): void {
    this.deviceId = deviceId
  }

  /**
   * Subscribe to location updates
   * Returns an unsubscribe function
   */
  subscribeToLocationUpdates(callback: (location: Location) => void): () => void {
    this.subscribers.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Unsubscribe from location updates
   */
  unsubscribeFromLocationUpdates(): void {
    this.subscribers.clear()
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService()

