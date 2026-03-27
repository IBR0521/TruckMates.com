import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import { useEvents } from "./EventContext"
import { enqueue } from "../services/sync-queue"
import { storage } from "../services/storage"

export type UnassignedSegment = {
  id: string
  startTime: string
  endTime: string
  reason: string
  claimed: boolean
  disposition?: "claimed" | "rejected"
}

type UnassignedDrivingContextValue = {
  segments: UnassignedSegment[]
  openSegment: (reason: string) => Promise<void>
  closeSegment: () => Promise<void>
  claimAll: () => Promise<void>
  claimSegment: (id: string) => Promise<void>
  rejectSegment: (id: string) => Promise<void>
}

const STORAGE_KEY = "unassigned_driving_segments_v1"
const UnassignedDrivingContext = createContext<UnassignedDrivingContextValue | null>(null)

export function UnassignedDrivingProvider({ children }: { children: React.ReactNode }) {
  const { userId, assignedTruckId } = useAuth()
  const { addEvent } = useEvents()
  const [segments, setSegments] = useState<UnassignedSegment[]>([])

  useEffect(() => {
    void (async () => {
      const saved = await storage.get<UnassignedSegment[]>(STORAGE_KEY)
      if (saved) setSegments(saved)
    })()
  }, [])

  async function persist(next: UnassignedSegment[]) {
    setSegments(next)
    await storage.set(STORAGE_KEY, next)
  }

  async function openSegment(reason: string) {
    const active = segments.find((item) => !item.claimed && item.endTime === "")
    if (active) return

    const next: UnassignedSegment[] = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startTime: new Date().toISOString(),
        endTime: "",
        reason,
        claimed: false,
      },
      ...segments,
    ]
    await persist(next)
    await addEvent({
      eventType: "other",
      severity: "warning",
      title: "Unassigned driving detected",
      description: reason,
      metadata: { assigned_truck_id: assignedTruckId || null },
    })
  }

  async function closeSegment() {
    const active = segments.find((item) => !item.claimed && item.endTime === "")
    if (!active) return

    const next = segments.map((item) => (item.id === active.id ? { ...item, endTime: new Date().toISOString() } : item))
    await persist(next)
  }

  async function claimSegment(id: string) {
    if (!assignedTruckId) {
      throw new Error("Set assigned truck ID in Settings before claiming segments.")
    }

    const target = segments.find((item) => item.id === id && !item.claimed)
    if (!target) return

    const now = new Date().toISOString()
    const next = segments.map((item) =>
      item.id === id
        ? {
            ...item,
            endTime: item.endTime || now,
            claimed: true,
            disposition: "claimed" as const,
          }
        : item
    )
    await persist(next)

    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: "info",
          title: "Unassigned segment claimed",
          description: `${target.startTime} - ${(target.endTime || now)}`,
          event_time: now,
          driver_id: userId || undefined,
          metadata: {
            assigned_truck_id: assignedTruckId,
            segment_id: target.id,
          },
        },
      ],
    })
  }

  async function rejectSegment(id: string) {
    const target = segments.find((item) => item.id === id && !item.claimed)
    if (!target) return

    const now = new Date().toISOString()
    const next = segments.map((item) =>
      item.id === id
        ? {
            ...item,
            endTime: item.endTime || now,
            claimed: true,
            disposition: "rejected" as const,
          }
        : item
    )
    await persist(next)

    await addEvent({
      eventType: "other",
      severity: "warning",
      title: "Unassigned segment rejected",
      description: `${target.startTime} - ${(target.endTime || now)}`,
      metadata: { segment_id: target.id },
    })
  }

  async function claimAll() {
    const pending = segments.filter((item) => !item.claimed)
    if (!pending.length) return

    if (!assignedTruckId) {
      throw new Error("Set assigned truck ID in Settings before claiming segments.")
    }

    const now = new Date().toISOString()
    const claimed = segments.map((item) => ({
      ...item,
      endTime: item.endTime || now,
      claimed: true,
    }))
    await persist(claimed)

    await enqueue({
      type: "events",
      payload: pending.map((item) => ({
        event_type: "other",
        severity: "info",
        title: "Unassigned segment claimed",
        description: `${item.startTime} - ${(item.endTime || now)}`,
        event_time: now,
        driver_id: userId || undefined,
        metadata: {
          assigned_truck_id: assignedTruckId,
          segment_id: item.id,
        },
      })),
    })
  }

  const value = useMemo<UnassignedDrivingContextValue>(
    () => ({
      segments,
      openSegment,
      closeSegment,
      claimAll,
      claimSegment,
      rejectSegment,
    }),
    [segments, userId, assignedTruckId]
  )

  return <UnassignedDrivingContext.Provider value={value}>{children}</UnassignedDrivingContext.Provider>
}

export function useUnassignedDriving(): UnassignedDrivingContextValue {
  const value = useContext(UnassignedDrivingContext)
  if (!value) throw new Error("useUnassignedDriving must be used within UnassignedDrivingProvider")
  return value
}
