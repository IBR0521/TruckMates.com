import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import * as Location from "expo-location"
import { useAuth } from "./AuthContext"
import { useEvents } from "./EventContext"
import { useHos } from "./HosContext"
import { useUnassignedDriving } from "./UnassignedDrivingContext"
import { enqueue } from "../services/sync-queue"

type AutoEldContextValue = {
  enabled: boolean
  lastSpeedMph: number | null
  startMonitoring: () => Promise<void>
  stopMonitoring: () => void
}

const AutoEldContext = createContext<AutoEldContextValue | null>(null)

const DRIVING_SPEED_MPH = 5
const STOPPED_SPEED_MPH = 1
const STOPPED_TO_ON_DUTY_MS = 5 * 60 * 1000
const STALE_POSITION_MS = 3 * 60 * 1000
const DIAGNOSTIC_POLL_MS = 60 * 1000
const DIAGNOSTIC_CLEAR_WINDOW_MS = 5 * 60 * 1000

export function AutoEldProvider({ children }: { children: React.ReactNode }) {
  const { userId, assignedTruckId } = useAuth()
  const { currentStatus, updateStatus, clocks } = useHos()
  const { addEvent } = useEvents()
  const { openSegment, closeSegment } = useUnassignedDriving()
  const [enabled, setEnabled] = useState(false)
  const [lastSpeedMph, setLastSpeedMph] = useState<number | null>(null)

  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const stationarySinceRef = useRef<number | null>(null)
  const warnedThirtyRef = useRef(false)
  const warnedExceededRef = useRef(false)
  const warnedShiftLowRef = useRef(false)
  const warnedShiftExceededRef = useRef(false)
  const warnedCycleLowRef = useRef(false)
  const warnedCycleExceededRef = useRef(false)
  const staleLocationWarnedRef = useRef(false)
  const permissionMalfunctionRef = useRef(false)
  const streamFailureRef = useRef(false)
  const hadMalfunctionRef = useRef(false)
  const healthySinceRef = useRef<number | null>(null)
  const clearReadyEmittedRef = useRef(false)
  const lastPositionAtRef = useRef<number | null>(null)
  const diagnosticsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentStatusRef = useRef(currentStatus)
  const clocksRef = useRef(clocks)
  const assignedTruckRef = useRef(assignedTruckId)

  useEffect(() => {
    currentStatusRef.current = currentStatus
  }, [currentStatus])

  useEffect(() => {
    clocksRef.current = clocks
  }, [clocks])

  useEffect(() => {
    assignedTruckRef.current = assignedTruckId
  }, [assignedTruckId])

  async function emitEvent(
    title: string,
    severity: "info" | "warning" | "critical",
    metadata?: Record<string, unknown>,
    eventType: "hos_violation" | "device_malfunction" | "other" = severity === "critical" ? "hos_violation" : "other"
  ) {
    await addEvent({
      eventType,
      severity,
      title,
      metadata: {
        ...metadata,
        driver_id: userId || undefined,
      },
    })
  }

  function stopDiagnosticsPolling() {
    if (diagnosticsTimerRef.current) {
      clearInterval(diagnosticsTimerRef.current)
      diagnosticsTimerRef.current = null
    }
  }

  function markMalfunctionActive() {
    hadMalfunctionRef.current = true
    healthySinceRef.current = null
    clearReadyEmittedRef.current = false
  }

  async function evaluateDiagnosticClearWindow() {
    const hasActiveFault = permissionMalfunctionRef.current || staleLocationWarnedRef.current || streamFailureRef.current
    if (hasActiveFault || !hadMalfunctionRef.current) {
      healthySinceRef.current = null
      return
    }
    const now = Date.now()
    if (!healthySinceRef.current) {
      healthySinceRef.current = now
      return
    }
    const healthyFor = now - healthySinceRef.current
    if (healthyFor >= DIAGNOSTIC_CLEAR_WINDOW_MS && !clearReadyEmittedRef.current) {
      clearReadyEmittedRef.current = true
      await emitEvent(
        "Diagnostic clear window met",
        "info",
        {
          clear_window_minutes: DIAGNOSTIC_CLEAR_WINDOW_MS / 60000,
          healthy_for_seconds: Math.floor(healthyFor / 1000),
        },
        "device_malfunction"
      )
      hadMalfunctionRef.current = false
      healthySinceRef.current = null
    }
  }

  function startDiagnosticsPolling() {
    stopDiagnosticsPolling()
    diagnosticsTimerRef.current = setInterval(() => {
      void (async () => {
        try {
          const fg = await Location.getForegroundPermissionsAsync()
          const bg = await Location.getBackgroundPermissionsAsync()
          const permissionsLost = fg.status !== "granted" || bg.status !== "granted"
          if (permissionsLost && !permissionMalfunctionRef.current) {
            permissionMalfunctionRef.current = true
            markMalfunctionActive()
            await emitEvent(
              "Location permission lost",
              "critical",
              {
                foreground_status: fg.status,
                background_status: bg.status,
              },
              "device_malfunction"
            )
          } else if (!permissionsLost && permissionMalfunctionRef.current) {
            permissionMalfunctionRef.current = false
            await emitEvent(
              "Location permission restored",
              "info",
              {
                foreground_status: fg.status,
                background_status: bg.status,
              },
              "device_malfunction"
            )
          }

          const last = lastPositionAtRef.current
          if (!last) return
          const staleForMs = Date.now() - last
          if (staleForMs >= STALE_POSITION_MS && !staleLocationWarnedRef.current) {
            staleLocationWarnedRef.current = true
            markMalfunctionActive()
            await emitEvent(
              "Location feed stale",
              "warning",
              {
                stale_for_seconds: Math.floor(staleForMs / 1000),
              },
              "device_malfunction"
            )
          }
          await evaluateDiagnosticClearWindow()
        } catch {
          // Swallow diagnostics polling failures and retry on next interval.
        }
      })()
    }, DIAGNOSTIC_POLL_MS)
  }

  async function handleViolationEvents() {
    const latestClocks = clocksRef.current

    if (latestClocks.driveMinutesLeft <= 0 && !warnedExceededRef.current) {
      warnedExceededRef.current = true
      await emitEvent("Drive time exceeded", "critical", {
        drive_minutes_left: latestClocks.driveMinutesLeft,
      })
    } else if (latestClocks.driveMinutesLeft > 0) {
      warnedExceededRef.current = false
    }

    if (latestClocks.driveMinutesLeft <= 30 && latestClocks.driveMinutesLeft > 0 && !warnedThirtyRef.current) {
      warnedThirtyRef.current = true
      await emitEvent("Drive time low", "warning", {
        drive_minutes_left: latestClocks.driveMinutesLeft,
      })
    } else if (latestClocks.driveMinutesLeft > 30) {
      warnedThirtyRef.current = false
    }

    if (latestClocks.shiftMinutesLeft <= 0 && !warnedShiftExceededRef.current) {
      warnedShiftExceededRef.current = true
      await emitEvent("Shift window exceeded", "critical", {
        shift_minutes_left: latestClocks.shiftMinutesLeft,
      })
    } else if (latestClocks.shiftMinutesLeft > 0) {
      warnedShiftExceededRef.current = false
    }

    if (latestClocks.shiftMinutesLeft <= 60 && latestClocks.shiftMinutesLeft > 0 && !warnedShiftLowRef.current) {
      warnedShiftLowRef.current = true
      await emitEvent("Shift window low", "warning", {
        shift_minutes_left: latestClocks.shiftMinutesLeft,
      })
    } else if (latestClocks.shiftMinutesLeft > 60) {
      warnedShiftLowRef.current = false
    }

    if (latestClocks.cycleMinutesLeft <= 0 && !warnedCycleExceededRef.current) {
      warnedCycleExceededRef.current = true
      await emitEvent("Cycle limit exceeded", "critical", {
        cycle_minutes_left: latestClocks.cycleMinutesLeft,
      })
    } else if (latestClocks.cycleMinutesLeft > 0) {
      warnedCycleExceededRef.current = false
    }

    if (latestClocks.cycleMinutesLeft <= 180 && latestClocks.cycleMinutesLeft > 0 && !warnedCycleLowRef.current) {
      warnedCycleLowRef.current = true
      await emitEvent("Cycle limit low", "warning", {
        cycle_minutes_left: latestClocks.cycleMinutesLeft,
      })
    } else if (latestClocks.cycleMinutesLeft > 180) {
      warnedCycleLowRef.current = false
    }
  }

  async function startMonitoring() {
    if (watchRef.current) return

    const fg = await Location.requestForegroundPermissionsAsync()
    if (fg.status !== "granted") throw new Error("Location permission denied")

    const bg = await Location.requestBackgroundPermissionsAsync()
    if (bg.status !== "granted") throw new Error("Background location permission denied")

    lastPositionAtRef.current = Date.now()
    staleLocationWarnedRef.current = false
    permissionMalfunctionRef.current = false
    streamFailureRef.current = false
    hadMalfunctionRef.current = false
    healthySinceRef.current = null
    clearReadyEmittedRef.current = false

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000,
        distanceInterval: 100,
      },
      (position) => {
        void (async () => {
          try {
            lastPositionAtRef.current = Date.now()
            if (staleLocationWarnedRef.current) {
              staleLocationWarnedRef.current = false
              await emitEvent("Location feed restored", "info", undefined, "device_malfunction")
            }
            if (streamFailureRef.current) {
              streamFailureRef.current = false
              await emitEvent("Location stream recovered", "info", undefined, "device_malfunction")
            }

            const speedMps = typeof position.coords.speed === "number" ? Math.max(position.coords.speed, 0) : 0
            const speedMph = speedMps * 2.23694
            setLastSpeedMph(speedMph)

            await enqueue({
              type: "locations",
              payload: [
                {
                  timestamp: new Date().toISOString(),
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  speed: speedMph,
                  heading: typeof position.coords.heading === "number" ? position.coords.heading : undefined,
                  driver_id: userId || undefined,
                },
              ],
            })

            const now = Date.now()
            const latestStatus = currentStatusRef.current
            const hasAssignedTruck = Boolean(assignedTruckRef.current)
            if (speedMph >= DRIVING_SPEED_MPH) {
              stationarySinceRef.current = null
              if (latestStatus !== "driving") {
                await updateStatus("driving")
                await emitEvent("Auto status changed to Driving", "info", { speed_mph: speedMph })
              }
              if (!hasAssignedTruck) {
                await openSegment("Vehicle movement detected without assigned truck.")
              }
            } else if (latestStatus === "driving" && speedMph <= STOPPED_SPEED_MPH) {
              if (!stationarySinceRef.current) {
                stationarySinceRef.current = now
              } else if (now - stationarySinceRef.current >= STOPPED_TO_ON_DUTY_MS) {
                await updateStatus("on_duty")
                stationarySinceRef.current = null
                await closeSegment()
                await emitEvent("Auto status changed to On Duty", "info", { speed_mph: speedMph })
              }
            } else {
              stationarySinceRef.current = null
            }

            await handleViolationEvents()
            await evaluateDiagnosticClearWindow()
          } catch (error) {
            if (!streamFailureRef.current) {
              streamFailureRef.current = true
              markMalfunctionActive()
              await emitEvent(
                "Location stream interruption",
                "critical",
                {
                  error: error instanceof Error ? error.message : "unknown_error",
                },
                "device_malfunction"
              )
            }
            stationarySinceRef.current = null
            setLastSpeedMph(null)
          }
        })()
      }
    )

    startDiagnosticsPolling()
    setEnabled(true)
    await emitEvent("Automatic ELD monitoring enabled", "info")
  }

  function stopMonitoring() {
    watchRef.current?.remove()
    watchRef.current = null
    stopDiagnosticsPolling()
    stationarySinceRef.current = null
    lastPositionAtRef.current = null
    staleLocationWarnedRef.current = false
    permissionMalfunctionRef.current = false
    streamFailureRef.current = false
    hadMalfunctionRef.current = false
    healthySinceRef.current = null
    clearReadyEmittedRef.current = false
    setEnabled(false)
    void emitEvent("Automatic ELD monitoring disabled", "info")
  }

  useEffect(() => {
    return () => {
      watchRef.current?.remove()
      watchRef.current = null
      stopDiagnosticsPolling()
    }
  }, [])

  const value = useMemo<AutoEldContextValue>(
    () => ({ enabled, lastSpeedMph, startMonitoring, stopMonitoring }),
    [enabled, lastSpeedMph]
  )

  return <AutoEldContext.Provider value={value}>{children}</AutoEldContext.Provider>
}

export function useAutoEld(): AutoEldContextValue {
  const value = useContext(AutoEldContext)
  if (!value) throw new Error("useAutoEld must be used within AutoEldProvider")
  return value
}
