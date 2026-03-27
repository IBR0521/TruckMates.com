import { storage } from "./storage"
import { pushDvirs, pushEvents, pushLocations, pushLogs } from "./eld-api"
import type { ELDDvir, ELDEvent, ELDLocation, ELDLog } from "../types/eld"

type QueueItem =
  | { type: "locations"; payload: ELDLocation[] }
  | { type: "logs"; payload: ELDLog[] }
  | { type: "events"; payload: ELDEvent[] }
  | { type: "dvirs"; payload: ELDDvir[] }

const STORAGE_KEY = "eld_sync_queue_v1"

async function getQueue(): Promise<QueueItem[]> {
  return (await storage.get<QueueItem[]>(STORAGE_KEY)) ?? []
}

async function setQueue(items: QueueItem[]): Promise<void> {
  await storage.set(STORAGE_KEY, items)
}

export async function enqueue(item: QueueItem): Promise<void> {
  const queue = await getQueue()
  queue.push(item)
  await setQueue(queue)
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

  const remaining: QueueItem[] = []
  for (const item of queue) {
    try {
      if (item.type === "locations") await pushLocations(token, deviceId, item.payload)
      if (item.type === "logs") await pushLogs(token, deviceId, item.payload)
      if (item.type === "events") await pushEvents(token, deviceId, item.payload)
      if (item.type === "dvirs") await pushDvirs(token, deviceId, item.payload)
    } catch {
      remaining.push(item)
    }
  }

  await setQueue(remaining)
}
