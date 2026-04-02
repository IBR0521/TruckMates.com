import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import { enqueue } from "../services/sync-queue"
import { storage } from "../services/storage"
import type { DriverEvent, DriverEventSeverity } from "../types/events"

type EventContextValue = {
  events: DriverEvent[]
  addEvent: (input: {
    eventType: DriverEvent["eventType"]
    severity: DriverEventSeverity
    title: string
    description?: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
  acknowledgeEvent: (id: string, note?: string) => Promise<void>
}

const STORAGE_KEY = "driver_events_v1"
const scopedKey = (base: string, userId: string) => `${base}:${userId}`
const EventContext = createContext<EventContextValue | null>(null)

export function EventProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [events, setEvents] = useState<DriverEvent[]>([])

  useEffect(() => {
    void (async () => {
      if (!userId) {
        setEvents([])
        return
      }
      const saved = await storage.get<DriverEvent[]>(scopedKey(STORAGE_KEY, userId))
      setEvents(saved || [])
    })()
  }, [userId])

  async function persist(next: DriverEvent[]) {
    setEvents(next)
    if (!userId) return
    await storage.set(scopedKey(STORAGE_KEY, userId), next)
  }

  async function addEvent(input: {
    eventType: DriverEvent["eventType"]
    severity: DriverEventSeverity
    title: string
    description?: string
    metadata?: Record<string, unknown>
  }) {
    const event: DriverEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType: input.eventType,
      severity: input.severity,
      title: input.title,
      description: input.description,
      eventTime: new Date().toISOString(),
      acknowledged: false,
      metadata: input.metadata,
    }

    let next: DriverEvent[] = []
    setEvents((prev) => {
      next = [event, ...prev].slice(0, 300)
      return next
    })
    if (userId) {
      await storage.set(scopedKey(STORAGE_KEY, userId), next)
    }

    await enqueue({
      type: "events",
      payload: [
        {
          event_type: event.eventType,
          severity: event.severity,
          title: event.title,
          description: event.description,
          event_time: event.eventTime,
          driver_id: userId || undefined,
          metadata: event.metadata,
        },
      ],
    })
  }

  async function acknowledgeEvent(id: string, note?: string) {
    const nowIso = new Date().toISOString()
    const trimmedNote = note?.trim()
    let acknowledgedEvent: DriverEvent | undefined
    let next: DriverEvent[] = []
    setEvents((prev) => {
      next = prev.map((item) => {
        if (item.id !== id) return item
        const updated: DriverEvent = {
          ...item,
          acknowledged: true,
          acknowledgedAt: nowIso,
          acknowledgmentNote: trimmedNote || item.acknowledgmentNote,
          resolvedAt: item.eventType === "device_malfunction" ? nowIso : item.resolvedAt,
          resolutionNote: item.eventType === "device_malfunction" ? trimmedNote || item.resolutionNote : item.resolutionNote,
        }
        acknowledgedEvent = updated
        return updated
      })
      return next
    })
    if (userId) {
      await storage.set(scopedKey(STORAGE_KEY, userId), next)
    }

    if (!acknowledgedEvent) return
    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: "info",
          title:
            acknowledgedEvent.eventType === "device_malfunction"
              ? "Device malfunction resolved by driver"
              : "Driver acknowledged event",
          description: acknowledgedEvent.title,
          event_time: nowIso,
          driver_id: userId || undefined,
          metadata: {
            acknowledged_event_id: acknowledgedEvent.id,
            acknowledged_event_type: acknowledgedEvent.eventType,
            acknowledgment_note: trimmedNote,
            resolved_at: acknowledgedEvent.resolvedAt,
          },
        },
      ],
    })
  }

  const value = useMemo<EventContextValue>(
    () => ({ events, addEvent, acknowledgeEvent }),
    [events, userId]
  )

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export function useEvents(): EventContextValue {
  const value = useContext(EventContext)
  if (!value) throw new Error("useEvents must be used within EventProvider")
  return value
}
