import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import type { DutyStatus } from "../types/eld"
import type { HosClocks, HosEditAudit, HosExceptionSettings, HosLogEntry, HosShortHaulSession } from "../types/hos"
import { storage } from "../services/storage"
import { certifyDay, computeHosClocksWithSettings, transitionStatus } from "../services/hos-engine"
import { getCurrentEldLocation, requestLocationPermissions } from "../services/location-tracker"
import { enqueue, flushQueue } from "../services/sync-queue"
import { supabase } from "../services/supabase"

type HosContextValue = {
  entries: HosLogEntry[]
  audits: HosEditAudit[]
  auditChainValid: boolean
  exceptionSettings: HosExceptionSettings
  shortHaulSession: HosShortHaulSession | null
  clocks: HosClocks
  currentStatus: DutyStatus
  updateStatus: (status: DutyStatus) => Promise<void>
  certifyToday: () => Promise<void>
  editEntry: (input: { entryId: string; startTime: string; endTime?: string; reason: string }) => Promise<void>
  annotateEntry: (input: { entryId: string; note: string }) => Promise<void>
  transferToCoDriver: (input: { entryId: string; coDriverId: string; reason: string }) => Promise<void>
  setAdverseDrivingCondition: (input: { enabled: boolean; reason: string }) => Promise<void>
  startShortHaulSession: (input: { terminalName: string; radiusMiles: number; notes?: string }) => Promise<void>
  completeShortHaulSession: (input: { returnedToTerminal?: boolean; notes?: string }) => Promise<void>
}

const STORAGE_KEY = "hos_entries_v1"
const AUDIT_STORAGE_KEY = "hos_edit_audits_v1"
const EXCEPTION_STORAGE_KEY = "hos_exception_settings_v1"
const SHORT_HAUL_STORAGE_KEY = "hos_short_haul_session_v1"
const DEVICE_ID_KEY = "eld_device_id_v1"
const scopedKey = (base: string, userId: string) => `${base}:${userId}`

const HosContext = createContext<HosContextValue | null>(null)

function applyTimeToIso(baseIso: string, hhmm: string): string {
  const match = hhmm.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    throw new Error("Time must be in HH:mm format.")
  }

  const date = new Date(baseIso)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Unable to parse existing log timestamp.")
  }

  const [, h, m] = match
  date.setHours(Number(h), Number(m), 0, 0)
  return date.toISOString()
}

function hashText(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function buildAuditHash(input: Omit<HosEditAudit, "hash">): string {
  return hashText(
    JSON.stringify({
      id: input.id,
      entryId: input.entryId,
      editedAt: input.editedAt,
      editorId: input.editorId,
      actionType: input.actionType,
      reason: input.reason,
      before: input.before,
      after: input.after,
      annotation: input.annotation,
      coDriverId: input.coDriverId,
      prevHash: input.prevHash,
    })
  )
}

function milesBetweenPoints(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 3958.7613
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function HosProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [entries, setEntries] = useState<HosLogEntry[]>([])
  const [audits, setAudits] = useState<HosEditAudit[]>([])
  const [clockNowIso, setClockNowIso] = useState(() => new Date().toISOString())
  const [exceptionSettings, setExceptionSettings] = useState<HosExceptionSettings>({
    adverseDrivingEnabled: false,
    adverseDrivingReason: "",
  })
  const [shortHaulSession, setShortHaulSession] = useState<HosShortHaulSession | null>(null)

  useEffect(() => {
    void (async () => {
      if (!userId) {
        setEntries([])
        setAudits([])
        setExceptionSettings({ adverseDrivingEnabled: false, adverseDrivingReason: "" })
        setShortHaulSession(null)
        return
      }
      const saved = await storage.get<HosLogEntry[]>(scopedKey(STORAGE_KEY, userId))
      const savedAudits = await storage.get<HosEditAudit[]>(scopedKey(AUDIT_STORAGE_KEY, userId))
      const savedExceptions = await storage.get<HosExceptionSettings>(scopedKey(EXCEPTION_STORAGE_KEY, userId))
      const savedShortHaul = await storage.get<HosShortHaulSession>(scopedKey(SHORT_HAUL_STORAGE_KEY, userId))
      if (saved) setEntries(saved)
      if (savedAudits) {
        const normalized = savedAudits.map((audit) => {
          if (audit.hash) return audit
          const partial: Omit<HosEditAudit, "hash"> = {
            ...audit,
            actionType: audit.actionType || "edit",
            prevHash: audit.prevHash,
          }
          return { ...partial, hash: buildAuditHash(partial) }
        })
        setAudits(normalized)
      }
      if (savedExceptions) {
        setExceptionSettings(savedExceptions)
      }
      if (savedShortHaul) {
        setShortHaulSession(savedShortHaul)
      }
    })()
  }, [userId])

  useEffect(() => {
    const tick = setInterval(() => {
      setClockNowIso(new Date().toISOString())
    }, 1000)
    return () => {
      clearInterval(tick)
    }
  }, [])

  async function persist(nextEntries: HosLogEntry[], nextAudits: HosEditAudit[] = audits) {
    setEntries(nextEntries)
    setAudits(nextAudits)
    if (!userId) return
    await storage.set(scopedKey(STORAGE_KEY, userId), nextEntries)
    await storage.set(scopedKey(AUDIT_STORAGE_KEY, userId), nextAudits)
  }

  async function setAdverseDrivingCondition(input: { enabled: boolean; reason: string }) {
    if (input.enabled && !input.reason.trim()) {
      throw new Error("Adverse driving reason is required when enabling.")
    }
    const next: HosExceptionSettings = {
      adverseDrivingEnabled: input.enabled,
      adverseDrivingReason: input.reason.trim(),
      adverseDrivingActivatedAt: input.enabled ? new Date().toISOString() : undefined,
    }
    setExceptionSettings(next)
    if (userId) {
      await storage.set(scopedKey(EXCEPTION_STORAGE_KEY, userId), next)
    }
    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: "info",
          title: input.enabled ? "Adverse driving condition enabled" : "Adverse driving condition disabled",
          description: input.enabled ? input.reason.trim() : "Cleared by driver",
          event_time: new Date().toISOString(),
          driver_id: userId || undefined,
        },
      ],
    })
  }

  async function startShortHaulSession(input: { terminalName: string; radiusMiles: number; notes?: string }) {
    const terminal = input.terminalName.trim()
    if (!terminal) throw new Error("Terminal name is required.")
    if (!Number.isFinite(input.radiusMiles) || input.radiusMiles <= 0) {
      throw new Error("Radius must be a positive number.")
    }
    const hasPermissions = await requestLocationPermissions()
    if (!hasPermissions) {
      throw new Error("Location permissions are required to start GPS-backed short-haul session.")
    }
    const terminalLocation = await getCurrentEldLocation(userId || undefined)
    const next: HosShortHaulSession = {
      terminalName: terminal,
      radiusMiles: Math.round(input.radiusMiles * 10) / 10,
      notes: input.notes?.trim() || undefined,
      startedAt: new Date().toISOString(),
      terminalLatitude: terminalLocation.latitude,
      terminalLongitude: terminalLocation.longitude,
    }
    setShortHaulSession(next)
    if (userId) {
      await storage.set(scopedKey(SHORT_HAUL_STORAGE_KEY, userId), next)
    }
    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: "info",
          title: "Short-haul session started",
          description: `Terminal ${terminal}, radius ${next.radiusMiles}mi, GPS anchor captured`,
          event_time: next.startedAt,
          location: { lat: terminalLocation.latitude, lng: terminalLocation.longitude },
          driver_id: userId || undefined,
        },
      ],
    })
  }

  async function completeShortHaulSession(input: { returnedToTerminal?: boolean; notes?: string }) {
    if (!shortHaulSession) {
      throw new Error("No active short-haul session.")
    }
    if (shortHaulSession.endedAt) {
      throw new Error("Short-haul session already completed.")
    }
    const hasPermissions = await requestLocationPermissions()
    if (!hasPermissions) {
      throw new Error("Location permissions are required to complete GPS-backed short-haul session.")
    }
    const endLocation = await getCurrentEldLocation(userId || undefined)
    if (
      typeof shortHaulSession.terminalLatitude !== "number" ||
      typeof shortHaulSession.terminalLongitude !== "number"
    ) {
      throw new Error("Missing terminal GPS anchor. Start a new short-haul session.")
    }
    const distanceMilesRaw = milesBetweenPoints(
      shortHaulSession.terminalLatitude,
      shortHaulSession.terminalLongitude,
      endLocation.latitude,
      endLocation.longitude
    )
    const distanceMiles = Math.round(distanceMilesRaw * 100) / 100
    const gpsReturn = distanceMiles <= shortHaulSession.radiusMiles
    const resolvedReturn = typeof input.returnedToTerminal === "boolean" ? input.returnedToTerminal : gpsReturn
    const completionSource = typeof input.returnedToTerminal === "boolean" ? "manual" : "gps"
    const endedAt = new Date().toISOString()
    const next: HosShortHaulSession = {
      ...shortHaulSession,
      endedAt,
      returnedToTerminal: resolvedReturn,
      completionSource,
      completionDistanceMiles: distanceMiles,
      endLatitude: endLocation.latitude,
      endLongitude: endLocation.longitude,
      notes: input.notes?.trim() || shortHaulSession.notes,
    }
    setShortHaulSession(next)
    if (userId) {
      await storage.set(scopedKey(SHORT_HAUL_STORAGE_KEY, userId), next)
    }
    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: resolvedReturn ? "info" : "warning",
          title: resolvedReturn ? "Short-haul return confirmed" : "Short-haul return not confirmed",
          description: `${completionSource.toUpperCase()} completion • ${distanceMiles.toFixed(2)}mi from terminal`,
          event_time: endedAt,
          location: { lat: endLocation.latitude, lng: endLocation.longitude },
          metadata: {
            terminal_latitude: shortHaulSession.terminalLatitude,
            terminal_longitude: shortHaulSession.terminalLongitude,
            radius_miles: shortHaulSession.radiusMiles,
            completion_source: completionSource,
            completion_distance_miles: distanceMiles,
          },
          driver_id: userId || undefined,
        },
      ],
    })
  }

  async function updateStatus(status: DutyStatus) {
    const nowIso = new Date().toISOString()
    const active = [...entries].reverse().find((entry) => !entry.endTime)
    const nextEntries = transitionStatus(entries, status, nowIso)
    await persist(nextEntries)
    const payload: Array<{
      log_date: string
      log_type: DutyStatus
      start_time: string
      end_time?: string
      duration_minutes?: number
      driver_id?: string
    }> = []

    if (active?.startTime) {
      const startMs = new Date(active.startTime).getTime()
      const endMs = new Date(nowIso).getTime()
      const durationMinutes =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? Math.floor((endMs - startMs) / 60000)
          : undefined
      payload.push({
        log_date: active.logDate,
        log_type: active.status,
        start_time: active.startTime,
        end_time: nowIso,
        duration_minutes: durationMinutes,
        driver_id: userId || undefined,
      })
    }
    payload.push({
      log_date: nowIso.slice(0, 10),
      log_type: status,
      start_time: nowIso,
      driver_id: userId || undefined,
    })

    await enqueue({
      type: "logs",
      payload,
    })

    // Push status transitions immediately so platform HOS reflects changes without delay.
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const sessionUserId = data.session?.user?.id || userId
      if (token && sessionUserId) {
        const deviceId = await storage.get<string>(scopedKey(DEVICE_ID_KEY, sessionUserId))
        if (deviceId) {
          await flushQueue(token, deviceId)
        }
      }
    } catch {
      // Background queue retry loop still handles eventual sync.
    }
  }

  async function certifyToday() {
    const today = new Date().toISOString().slice(0, 10)
    const nextEntries = certifyDay(entries, today)
    await persist(nextEntries)
  }

  async function editEntry(input: { entryId: string; startTime: string; endTime?: string; reason: string }) {
    const target = entries.find((entry) => entry.id === input.entryId)
    if (!target) throw new Error("Log entry not found.")
    if (!input.reason.trim()) throw new Error("Edit reason is required.")

    const nextStart = applyTimeToIso(target.startTime, input.startTime)
    const nextEnd = input.endTime?.trim()
      ? applyTimeToIso(target.endTime || target.startTime, input.endTime.trim())
      : target.endTime

    if (nextEnd && new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
      throw new Error("End time must be later than start time.")
    }

    const now = new Date().toISOString()
    const nextEntries = entries.map((entry) =>
      entry.id === input.entryId
        ? {
            ...entry,
            startTime: nextStart,
            endTime: nextEnd,
            edited: true,
            editReason: input.reason.trim(),
            originalStartTime: entry.originalStartTime || entry.startTime,
            originalEndTime: entry.originalEndTime || entry.endTime,
            lastEditedAt: now,
          }
        : entry
    )

    const partialAudit: Omit<HosEditAudit, "hash"> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entryId: input.entryId,
      editedAt: now,
      editorId: userId || undefined,
      actionType: "edit",
      reason: input.reason.trim(),
      before: { startTime: target.startTime, endTime: target.endTime },
      after: { startTime: nextStart, endTime: nextEnd },
      prevHash: audits[0]?.hash,
    }
    const audit: HosEditAudit = { ...partialAudit, hash: buildAuditHash(partialAudit) }
    const nextAudits = [audit, ...audits].slice(0, 500)

    await persist(nextEntries, nextAudits)
    await enqueue({
      type: "logs",
      payload: [
        {
          log_date: target.logDate,
          log_type: target.status,
          start_time: nextStart,
          end_time: nextEnd,
          driver_id: userId || undefined,
          violations: [`Edited log: ${input.reason.trim()}`],
        },
      ],
    })
  }

  async function annotateEntry(input: { entryId: string; note: string }) {
    const target = entries.find((entry) => entry.id === input.entryId)
    if (!target) throw new Error("Log entry not found.")
    if (!input.note.trim()) throw new Error("Annotation cannot be empty.")

    const now = new Date().toISOString()
    const nextEntries = entries.map((entry) =>
      entry.id === target.id
        ? {
            ...entry,
            annotation: input.note.trim(),
            lastEditedAt: now,
          }
        : entry
    )

    const partialAudit: Omit<HosEditAudit, "hash"> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entryId: target.id,
      editedAt: now,
      editorId: userId || undefined,
      actionType: "annotation",
      reason: "Driver annotation added",
      before: { startTime: target.startTime, endTime: target.endTime },
      after: { startTime: target.startTime, endTime: target.endTime },
      annotation: input.note.trim(),
      prevHash: audits[0]?.hash,
    }
    const audit: HosEditAudit = { ...partialAudit, hash: buildAuditHash(partialAudit) }
    const nextAudits = [audit, ...audits].slice(0, 500)

    await persist(nextEntries, nextAudits)
  }

  async function transferToCoDriver(input: { entryId: string; coDriverId: string; reason: string }) {
    const target = entries.find((entry) => entry.id === input.entryId)
    if (!target) throw new Error("Log entry not found.")
    if (!input.coDriverId.trim()) throw new Error("Co-driver ID is required.")
    if (!input.reason.trim()) throw new Error("Transfer reason is required.")

    const now = new Date().toISOString()
    const nextEntries = entries.map((entry) =>
      entry.id === target.id
        ? {
            ...entry,
            coDriverTransferTo: input.coDriverId.trim(),
            coDriverTransferredAt: now,
            lastEditedAt: now,
          }
        : entry
    )

    const partialAudit: Omit<HosEditAudit, "hash"> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entryId: target.id,
      editedAt: now,
      editorId: userId || undefined,
      actionType: "co_driver_transfer",
      reason: input.reason.trim(),
      before: { startTime: target.startTime, endTime: target.endTime },
      after: { startTime: target.startTime, endTime: target.endTime },
      coDriverId: input.coDriverId.trim(),
      prevHash: audits[0]?.hash,
    }
    const audit: HosEditAudit = { ...partialAudit, hash: buildAuditHash(partialAudit) }
    const nextAudits = [audit, ...audits].slice(0, 500)

    await persist(nextEntries, nextAudits)
    await enqueue({
      type: "events",
      payload: [
        {
          event_type: "other",
          severity: "info",
          title: "Co-driver transfer marker added",
          description: `Entry ${target.id} transferred to ${input.coDriverId.trim()}`,
          event_time: now,
          driver_id: userId || undefined,
        },
      ],
    })
  }

  const clocks = useMemo(
    () => computeHosClocksWithSettings(entries, exceptionSettings, clockNowIso),
    [entries, exceptionSettings, clockNowIso]
  )
  const currentStatus = useMemo<DutyStatus>(() => {
    const active = [...entries].reverse().find((e) => !e.endTime)
    return active?.status ?? "off_duty"
  }, [entries])

  const auditChainValid = useMemo(() => {
    for (let i = 0; i < audits.length; i += 1) {
      const item = audits[i]
      const expectedPrev = audits[i + 1]?.hash
      if (item.prevHash !== expectedPrev) return false
      const partial: Omit<HosEditAudit, "hash"> = {
        id: item.id,
        entryId: item.entryId,
        editedAt: item.editedAt,
        editorId: item.editorId,
        actionType: item.actionType,
        reason: item.reason,
        before: item.before,
        after: item.after,
        annotation: item.annotation,
        coDriverId: item.coDriverId,
        prevHash: item.prevHash,
      }
      if (buildAuditHash(partial) !== item.hash) return false
    }
    return true
  }, [audits])

  const value = useMemo<HosContextValue>(
    () => ({
      entries,
      audits,
      auditChainValid,
      exceptionSettings,
      shortHaulSession,
      clocks,
      currentStatus,
      updateStatus,
      certifyToday,
      editEntry,
      annotateEntry,
      transferToCoDriver,
      setAdverseDrivingCondition,
      startShortHaulSession,
      completeShortHaulSession,
    }),
    [entries, audits, auditChainValid, exceptionSettings, shortHaulSession, clocks, currentStatus, userId]
  )

  return <HosContext.Provider value={value}>{children}</HosContext.Provider>
}

export function useHos(): HosContextValue {
  const value = useContext(HosContext)
  if (!value) throw new Error("useHos must be used within HosProvider")
  return value
}
