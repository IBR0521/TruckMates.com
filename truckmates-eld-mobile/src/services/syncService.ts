/**
 * Sync Service
 * Handles syncing location, logs, and events to the platform
 * Includes offline queue management
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { isNetworkAvailable } from './locationService'
import { syncLocations, syncLogs, syncEvents, syncDVIRs } from './api'
import {
  STORAGE_KEYS,
  OFFLINE_QUEUE_SIZE,
  BATCH_SIZE,
} from '@/constants/config'
import type { Location, HOSLog, ELDEvent, DVIR } from '@/types'

/**
 * Queue item interface
 */
interface QueueItem {
  type: 'location' | 'log' | 'event' | 'dvir'
  data: any
  timestamp: string
}

/**
 * Add location to sync queue
 */
export async function queueLocation(
  deviceId: string,
  location: Location
): Promise<void> {
  try {
    const queue = await getQueue('locations')
    queue.push({
      type: 'location',
      data: { device_id: deviceId, locations: [location] },
      timestamp: new Date().toISOString(),
    })

    // Limit queue size
    if (queue.length > OFFLINE_QUEUE_SIZE) {
      queue.shift() // Remove oldest item
    }

    await saveQueue('locations', queue)
  } catch (error) {
    console.error('Error queuing location:', error)
  }
}

/**
 * Add log to sync queue
 */
export async function queueLog(
  deviceId: string,
  log: HOSLog
): Promise<void> {
  try {
    const queue = await getQueue('logs')
    queue.push({
      type: 'log',
      data: { device_id: deviceId, logs: [log] },
      timestamp: new Date().toISOString(),
    })

    if (queue.length > OFFLINE_QUEUE_SIZE) {
      queue.shift()
    }

    await saveQueue('logs', queue)
  } catch (error) {
    console.error('Error queuing log:', error)
  }
}

/**
 * Add event to sync queue
 */
export async function queueEvent(
  deviceId: string,
  event: ELDEvent
): Promise<void> {
  try {
    const queue = await getQueue('events')
    queue.push({
      type: 'event',
      data: { device_id: deviceId, events: [event] },
      timestamp: new Date().toISOString(),
    })

    if (queue.length > OFFLINE_QUEUE_SIZE) {
      queue.shift()
    }

    await saveQueue('events', queue)
  } catch (error) {
    console.error('Error queuing event:', error)
  }
}

/**
 * Add DVIR to sync queue
 */
export async function queueDVIR(
  deviceId: string,
  dvir: DVIR
): Promise<void> {
  try {
    const queue = await getQueue('dvirs')
    queue.push({
      type: 'dvir',
      data: { device_id: deviceId, dvirs: [dvir] },
      timestamp: new Date().toISOString(),
    })

    if (queue.length > OFFLINE_QUEUE_SIZE) {
      queue.shift()
    }

    await saveQueue('dvirs', queue)
  } catch (error) {
    console.error('Error queuing DVIR:', error)
  }
}

/**
 * Sync with retry logic and exponential backoff
 */
async function syncWithRetry<T>(
  syncFn: () => Promise<{ success: boolean; error?: string; data?: T }>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<{ success: boolean; error?: string; data?: T }> {
  let lastError: string | undefined
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await syncFn()
      if (result.success) {
        return result
      }
      lastError = result.error
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    } catch (error: any) {
      lastError = error.message || 'Unknown error'
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  return { success: false, error: lastError || 'Max retries exceeded' }
}

/**
 * Validate data integrity before sync
 */
function validateDataIntegrity(data: any[], type: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  for (const item of data) {
    // Check required fields based on type
    if (type === 'location') {
      if (!item.latitude || !item.longitude || !item.timestamp) {
        errors.push(`Invalid location: missing required fields`)
      }
    } else if (type === 'log') {
      if (!item.log_type || !item.start_time) {
        errors.push(`Invalid log: missing required fields`)
      }
    } else if (type === 'event') {
      if (!item.event_type || !item.event_time) {
        errors.push(`Invalid event: missing required fields`)
      }
    }
    
    // Validate timestamps
    if (item.timestamp || item.start_time || item.event_time) {
      const timestamp = item.timestamp || item.start_time || item.event_time
      if (isNaN(new Date(timestamp).getTime())) {
        errors.push(`Invalid timestamp: ${timestamp}`)
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Sync all queued items with enhanced retry and validation
 */
export async function syncAllQueues(deviceId: string): Promise<{
  locationsSynced: number
  logsSynced: number
  eventsSynced: number
  dvirsSynced: number
  errors: string[]
}> {
  const results = {
    locationsSynced: 0,
    logsSynced: 0,
    eventsSynced: 0,
    dvirsSynced: 0,
    errors: [] as string[],
  }

  const hasNetwork = await isNetworkAvailable()
  if (!hasNetwork) {
    console.log('No network available, skipping sync')
    return results
  }

  try {
    // Sync locations in batches with retry
    const locationQueue = await getQueue('locations')
    if (locationQueue.length > 0) {
      const batches = chunkArray(locationQueue, BATCH_SIZE)
      for (const batch of batches) {
        const locations: Location[] = []
        batch.forEach((item) => {
          if (item.type === 'location') {
            locations.push(...item.data.locations)
          }
        })

        if (locations.length > 0) {
          // Validate data integrity
          const validation = validateDataIntegrity(locations, 'location')
          if (!validation.valid) {
            results.errors.push(...validation.errors)
            continue
          }

          // Sync with retry
          const response = await syncWithRetry(async () => {
            return await syncLocations({
              device_id: deviceId,
              locations,
            })
          })

          if (response.success) {
            results.locationsSynced += locations.length
            await clearQueueItems('locations', batch.length)
          } else {
            results.errors.push(`Location sync failed: ${response.error}`)
          }
        }
      }
    }

    // Sync logs with retry and validation
    const logQueue = await getQueue('logs')
    if (logQueue.length > 0) {
      const logs: HOSLog[] = []
      logQueue.forEach((item) => {
        if (item.type === 'log') {
          logs.push(...item.data.logs)
        }
      })

      if (logs.length > 0) {
        // Validate data integrity
        const validation = validateDataIntegrity(logs, 'log')
        if (!validation.valid) {
          results.errors.push(...validation.errors)
        } else {
          // Sync with retry
          const response = await syncWithRetry(async () => {
            return await syncLogs({
              device_id: deviceId,
              logs,
            })
          })

          if (response.success) {
            results.logsSynced += logs.length
            await clearQueue('logs')
          } else {
            results.errors.push(`Log sync failed: ${response.error}`)
          }
        }
      }
    }

    // Sync events with retry and validation
    const eventQueue = await getQueue('events')
    if (eventQueue.length > 0) {
      const events: ELDEvent[] = []
      eventQueue.forEach((item) => {
        if (item.type === 'event') {
          events.push(...item.data.events)
        }
      })

      if (events.length > 0) {
        // Validate data integrity
        const validation = validateDataIntegrity(events, 'event')
        if (!validation.valid) {
          results.errors.push(...validation.errors)
        } else {
          // Sync with retry
          const response = await syncWithRetry(async () => {
            return await syncEvents({
              device_id: deviceId,
              events,
            })
          })

          if (response.success) {
            results.eventsSynced += events.length
            await clearQueue('events')
          } else {
            results.errors.push(`Event sync failed: ${response.error}`)
          }
        }
      }
    }

    // Sync DVIRs with retry
    const dvirQueue = await getQueue('dvirs')
    if (dvirQueue.length > 0) {
      const dvirs: DVIR[] = []
      dvirQueue.forEach((item) => {
        if (item.type === 'dvir') {
          dvirs.push(...item.data.dvirs)
        }
      })

      if (dvirs.length > 0) {
        // Sync with retry
        const response = await syncWithRetry(async () => {
          return await syncDVIRs({
            device_id: deviceId,
            dvirs,
          })
        })

        if (response.success) {
          results.dvirsSynced += dvirs.length
          await clearQueue('dvirs')
        } else {
          results.errors.push(`DVIR sync failed: ${response.error}`)
        }
      }
    }

    // Update last sync time
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_SYNC,
      new Date().toISOString()
    )
  } catch (error: any) {
    console.error('Error syncing queues:', error)
    results.errors.push(error.message)
  }

  return results
}

/**
 * Get queue from storage
 */
async function getQueue(type: 'locations' | 'logs' | 'events' | 'dvirs'): Promise<QueueItem[]> {
  try {
    const key = STORAGE_KEYS[`PENDING_${type.toUpperCase() as 'PENDING_LOCATIONS' | 'PENDING_LOGS' | 'PENDING_EVENTS' | 'PENDING_DVIRS'}`]
    const data = await AsyncStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error(`Error getting ${type} queue:`, error)
    return []
  }
}

/**
 * Save queue to storage
 */
async function saveQueue(
  type: 'locations' | 'logs' | 'events' | 'dvirs',
  queue: QueueItem[]
): Promise<void> {
  try {
    const key = STORAGE_KEYS[`PENDING_${type.toUpperCase() as 'PENDING_LOCATIONS' | 'PENDING_LOGS' | 'PENDING_EVENTS' | 'PENDING_DVIRS'}`]
    await AsyncStorage.setItem(key, JSON.stringify(queue))
  } catch (error) {
    console.error(`Error saving ${type} queue:`, error)
  }
}

/**
 * Clear queue
 */
async function clearQueue(type: 'locations' | 'logs' | 'events' | 'dvirs'): Promise<void> {
  await saveQueue(type, [])
}

/**
 * Remove first N items from queue
 */
async function clearQueueItems(
  type: 'locations' | 'logs' | 'events' | 'dvirs',
  count: number
): Promise<void> {
  const queue = await getQueue(type)
  queue.splice(0, count)
  await saveQueue(type, queue)
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

