import { storage } from "./storage"
import { pushDvirs, pushEvents, pushLocations, pushLogs } from "./eld-api"
import type { ELDDvir, ELDEvent, ELDLocation, ELDLog } from "../types/eld"
import { supabase } from "./supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

type QueueItem =
  | { type: "locations"; payload: ELDLocation[] }
  | { type: "logs"; payload: ELDLog[] }
  | { type: "events"; payload: ELDEvent[] }
  | { type: "dvirs"; payload: ELDDvir[] }

const STORAGE_KEY = "eld_sync_queue_v1"
const FAILED_SYNC_PREFIX = "sync_queue_"
const DEVICE_ID_KEY = "eld_device_id_v1"
const LAST_USER_ID_KEY = "eld_last_user_id_v1"
const scopedKey = (base: string, userId: string) => `${base}:${userId}`
const MIN_FLUSH_INTERVAL_MS = 1500
let isAutoFlushing = false
let lastAutoFlushAt = 0

export async function setQueueUserContext(userId: string | null): Promise<void> {
  if (userId && userId.trim()) {
    await storage.set(LAST_USER_ID_KEY, userId.trim())
  } else {
    await storage.remove(LAST_USER_ID_KEY)
  }
}

async function resolveQueueUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const sessionUserId = data?.session?.user?.id
    if (sessionUserId) return sessionUserId
  } catch {
    // ignore
  }
  return (await storage.get<string>(LAST_USER_ID_KEY)) ?? null
}

async function getQueueKey(): Promise<string> {
  const userId = await resolveQueueUserId()
  return userId ? scopedKey(STORAGE_KEY, userId) : STORAGE_KEY
}

async function getQueue(): Promise<QueueItem[]> {
  const key = await getQueueKey()
  const queue = (await storage.get<QueueItem[]>(key)) ?? []
  if (queue.length > 0) return queue

  // One-time migration path from legacy global queue key to user-scoped key.
  if (key !== STORAGE_KEY) {
    const legacyQueue = (await storage.get<QueueItem[]>(STORAGE_KEY)) ?? []
    if (legacyQueue.length > 0) {
      await storage.set(key, legacyQueue)
      await storage.remove(STORAGE_KEY)
      return legacyQueue
    }
  }
  return []
}

async function setQueue(items: QueueItem[]): Promise<void> {
  const key = await getQueueKey()
  await storage.set(key, items)
}

function isLikelyNetworkError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || "").toLowerCase()
  return (
    message.includes("network request failed") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("timed out")
  )
}

async function persistFailedNetworkItem(item: QueueItem): Promise<void> {
  const key = `${FAILED_SYNC_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await AsyncStorage.setItem(key, JSON.stringify(item))
}

export async function enqueue(item: QueueItem): Promise<void> {
  const queue = await getQueue()
  queue.push(item)
  await setQueue(queue)
  // Best-effort immediate sync so platform reflects changes quickly.
  void tryFlushNow()
}

export async function getQueueStats(): Promise<{
  totalItems: number
  locations: number
  logs: number
  events: number
  dvirs: number
}> {
  const queue = await getQueue()
  return queue.reduce(
    (acc, item) => {
      acc.totalItems += 1
      if (item.type === "locations") acc.locations += item.payload.length
      if (item.type === "logs") acc.logs += item.payload.length
      if (item.type === "events") acc.events += item.payload.length
      if (item.type === "dvirs") acc.dvirs += item.payload.length
      return acc
    },
    { totalItems: 0, locations: 0, logs: 0, events: 0, dvirs: 0 }
  )
}

export async function flushQueue(token: string, deviceId: string): Promise<void> {
  const queue = await getQueue()
  if (!queue.length) return

  async function sendItem(item: QueueItem): Promise<void> {
    if (item.type === "locations") await pushLocations(token, deviceId, item.payload)
    if (item.type === "logs") await pushLogs(token, deviceId, item.payload)
    if (item.type === "events") await pushEvents(token, deviceId, item.payload)
    if (item.type === "dvirs") await pushDvirs(token, deviceId, item.payload)
  }

  const buckets = {
    locations: [] as ELDLocation[],
    logs: [] as ELDLog[],
    events: [] as ELDEvent[],
    dvirs: [] as ELDDvir[],
  }
  for (const item of queue) {
    if (item.type === "locations") buckets.locations.push(...item.payload)
    if (item.type === "logs") buckets.logs.push(...item.payload)
    if (item.type === "events") buckets.events.push(...item.payload)
    if (item.type === "dvirs") buckets.dvirs.push(...item.payload)
  }

  const remaining: QueueItem[] = []
  async function flushTypeWithIsolation(
    type: QueueItem["type"],
    payload: ELDLocation[] | ELDLog[] | ELDEvent[] | ELDDvir[]
  ): Promise<void> {
    if (!Array.isArray(payload) || payload.length === 0) return

    try {
      await sendItem({ type, payload } as QueueItem)
    } catch (error: unknown) {
      if (isLikelyNetworkError(error)) {
        await persistFailedNetworkItem({ type, payload } as QueueItem)
        return
      }
      if (payload.length <= 1) {
        remaining.push({ type, payload } as QueueItem)
        return
      }
      // Fast isolation path: split batch only when needed.
      const mid = Math.ceil(payload.length / 2)
      await flushTypeWithIsolation(type, payload.slice(0, mid) as any)
      await flushTypeWithIsolation(type, payload.slice(mid) as any)
    }
  }

  await flushTypeWithIsolation("logs", buckets.logs)
  await flushTypeWithIsolation("events", buckets.events)
  await flushTypeWithIsolation("dvirs", buckets.dvirs)
  await flushTypeWithIsolation("locations", buckets.locations)

  await setQueue(remaining)
}

export async function drainQueue(token: string, deviceId: string): Promise<void> {
  const entries = await AsyncStorage.getAllKeys()
  const queuedKeys = entries.filter((key) => key.startsWith(FAILED_SYNC_PREFIX)).sort()
  if (!queuedKeys.length) return

  for (const key of queuedKeys) {
    try {
      const raw = await AsyncStorage.getItem(key)
      if (!raw) {
        await AsyncStorage.removeItem(key)
        continue
      }

      const item = JSON.parse(raw) as QueueItem
      if (!item || !item.type || !Array.isArray(item.payload)) {
        await AsyncStorage.removeItem(key)
        continue
      }

      if (item.type === "locations") await pushLocations(token, deviceId, item.payload)
      if (item.type === "logs") await pushLogs(token, deviceId, item.payload)
      if (item.type === "events") await pushEvents(token, deviceId, item.payload)
      if (item.type === "dvirs") await pushDvirs(token, deviceId, item.payload)

      await AsyncStorage.removeItem(key)
    } catch (error: unknown) {
      // Keep item in storage if still offline or transient failure.
      if (isLikelyNetworkError(error)) return
      // Non-network parse/shape errors should not block the queue forever.
      await AsyncStorage.removeItem(key).catch(() => {})
    }
  }
}

async function tryFlushNow(): Promise<void> {
  if (isAutoFlushing) return
  const now = Date.now()
  if (now - lastAutoFlushAt < MIN_FLUSH_INTERVAL_MS) return

  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const userId = data.session?.user?.id
    if (!token || !userId) return

    const deviceId = await storage.get<string>(scopedKey(DEVICE_ID_KEY, userId))
    if (!deviceId) return

    isAutoFlushing = true
    lastAutoFlushAt = now
    await flushQueue(token, deviceId)
  } catch {
    // Keep queue for later retries.
  } finally {
    isAutoFlushing = false
  }
}
