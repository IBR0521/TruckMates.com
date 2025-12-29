/**
 * Sync Service
 * Handles syncing location, logs, and events to the platform
 * Includes offline queue management
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { isNetworkAvailable } from './locationService'
import { syncLocations, syncLogs, syncEvents } from './api'
import {
  STORAGE_KEYS,
  OFFLINE_QUEUE_SIZE,
  BATCH_SIZE,
} from '@/constants/config'
import type { Location, HOSLog, ELDEvent } from '@/types'

/**
 * Queue item interface
 */
interface QueueItem {
  type: 'location' | 'log' | 'event'
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
 * Sync all queued items
 */
export async function syncAllQueues(deviceId: string): Promise<{
  locationsSynced: number
  logsSynced: number
  eventsSynced: number
  errors: string[]
}> {
  const results = {
    locationsSynced: 0,
    logsSynced: 0,
    eventsSynced: 0,
    errors: [] as string[],
  }

  const hasNetwork = await isNetworkAvailable()
  if (!hasNetwork) {
    console.log('No network available, skipping sync')
    return results
  }

  try {
    // Sync locations in batches
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
          const response = await syncLocations({
            device_id: deviceId,
            locations,
          })

          if (response.success) {
            results.locationsSynced += locations.length
            // Remove synced items from queue
            await clearQueueItems('locations', batch.length)
          } else {
            results.errors.push(`Location sync failed: ${response.error}`)
          }
        }
      }
    }

    // Sync logs
    const logQueue = await getQueue('logs')
    if (logQueue.length > 0) {
      const logs: HOSLog[] = []
      logQueue.forEach((item) => {
        if (item.type === 'log') {
          logs.push(...item.data.logs)
        }
      })

      if (logs.length > 0) {
        const response = await syncLogs({
          device_id: deviceId,
          logs,
        })

        if (response.success) {
          results.logsSynced += logs.length
          await clearQueue('logs')
        } else {
          results.errors.push(`Log sync failed: ${response.error}`)
        }
      }
    }

    // Sync events
    const eventQueue = await getQueue('events')
    if (eventQueue.length > 0) {
      const events: ELDEvent[] = []
      eventQueue.forEach((item) => {
        if (item.type === 'event') {
          events.push(...item.data.events)
        }
      })

      if (events.length > 0) {
        const response = await syncEvents({
          device_id: deviceId,
          events,
        })

        if (response.success) {
          results.eventsSynced += events.length
          await clearQueue('events')
        } else {
          results.errors.push(`Event sync failed: ${response.error}`)
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
async function getQueue(type: 'locations' | 'logs' | 'events'): Promise<QueueItem[]> {
  try {
    const key = STORAGE_KEYS[`PENDING_${type.toUpperCase() as 'PENDING_LOCATIONS' | 'PENDING_LOGS' | 'PENDING_EVENTS'}`]
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
  type: 'locations' | 'logs' | 'events',
  queue: QueueItem[]
): Promise<void> {
  try {
    const key = STORAGE_KEYS[`PENDING_${type.toUpperCase() as 'PENDING_LOCATIONS' | 'PENDING_LOGS' | 'PENDING_EVENTS'}`]
    await AsyncStorage.setItem(key, JSON.stringify(queue))
  } catch (error) {
    console.error(`Error saving ${type} queue:`, error)
  }
}

/**
 * Clear queue
 */
async function clearQueue(type: 'locations' | 'logs' | 'events'): Promise<void> {
  await saveQueue(type, [])
}

/**
 * Remove first N items from queue
 */
async function clearQueueItems(
  type: 'locations' | 'logs' | 'events',
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

