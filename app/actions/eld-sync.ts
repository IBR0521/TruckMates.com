"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { getELDDevices, getELDDevice } from "./eld"
import { recordBillableApiUsage } from "./api-usage"
import type { EldDeviceSyncRow, EldDriverMappingRow, ProviderApiJson } from "@/lib/types/eld-sync"
import type { PostgrestError } from "@supabase/supabase-js"

function getTimestampMs(input: unknown): number | null {
  if (input == null) return null
  if (typeof input === "string" || typeof input === "number" || input instanceof Date) {
    const ms = new Date(input).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/** First non-nullish field among keys (vendor payloads vary by camelCase/snake_case). */
function pv(obj: ProviderApiJson | null | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null) return v
  }
  return undefined
}

function pvString(obj: ProviderApiJson | null | undefined, ...keys: string[]): string | undefined {
  const v = pv(obj, ...keys)
  if (v === undefined || v === null) return undefined
  if (typeof v === "string") return v
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return undefined
}

function pvNum(obj: ProviderApiJson | null | undefined, ...keys: string[]): number | undefined {
  const v = pv(obj, ...keys)
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pvMetricNum(obj: ProviderApiJson | null | undefined, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const direct = pvNum(obj, key)
    if (direct !== undefined) return direct
    const nested = nestedRecord(obj, key)
    if (!nested) continue
    const nestedNum = pvNum(nested, "value", "rawValue", "reading")
    if (nestedNum !== undefined) return nestedNum
  }
  return undefined
}

function pvMetricString(obj: ProviderApiJson | null | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const direct = pvString(obj, key)
    if (direct !== undefined) return direct
    const nested = nestedRecord(obj, key)
    if (!nested) continue
    const nestedStr = pvString(nested, "value", "rawValue", "state")
    if (nestedStr !== undefined) return nestedStr
  }
  return undefined
}

function nestedRecord(obj: ProviderApiJson | null | undefined, key: string): ProviderApiJson | null {
  if (!obj) return null
  const v = obj[key]
  if (v !== null && typeof v === "object" && !Array.isArray(v)) return v as ProviderApiJson
  return null
}

function asProviderArray(raw: unknown): ProviderApiJson[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ProviderApiJson => typeof x === "object" && x !== null && !Array.isArray(x))
}

function geotabNestedDriverId(obj: ProviderApiJson): string | null {
  const d = nestedRecord(obj, "driver")
  const id = d ? pv(d, "id") : undefined
  if (id !== undefined && id !== null) return String(id)
  const flat = pv(obj, "driverId")
  if (flat !== undefined && flat !== null) return String(flat)
  return null
}

function isDefinedProviderId(id: unknown): id is string | number {
  return id !== null && id !== undefined
}

// KeepTruckin API integration
async function syncKeepTruckinData(device: EldDeviceSyncRow, sinceMs?: number | null) {
  const supabase = createAdminClient()
  
  if (!device.api_key || !device.api_secret) {
    return { error: "API credentials not configured", data: null }
  }

  try {
    // Use Motive API (formerly KeepTruckin) - updated domain
    // Fallback to old domain for backward compatibility
    const apiBaseUrl = "https://api.gomotive.com/v1"
    const fallbackUrl = "https://api.keeptruckin.com/v1"
    
    // Sync HOS Logs
    // V3-009 FIX: Encode provider_device_id to prevent URL manipulation
    const encodedDeviceId = encodeURIComponent(device.provider_device_id)
    let logsResponse = await fetch(`${apiBaseUrl}/logs?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!logsResponse.ok && logsResponse.status === 404) {
      logsResponse = await fetch(`${fallbackUrl}/logs?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    if (!logsResponse.ok) {
      throw new Error(`Motive/KeepTruckin API error: ${logsResponse.statusText}`)
    }

    const logsData = (await logsResponse.json()) as { logs?: unknown }
    const logsAll = asProviderArray(logsData.logs)
    const logs = sinceMs
      ? logsAll.filter((log) => {
          const ts = pv(log, "start_time", "start_datetime", "end_time", "end_datetime", "date", "log_date")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : logsAll

    // Sync Locations
    let locationsResponse = await fetch(`${apiBaseUrl}/locations?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!locationsResponse.ok && locationsResponse.status === 404) {
      locationsResponse = await fetch(`${fallbackUrl}/locations?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    const locationsData = (await locationsResponse.json()) as { locations?: unknown }
    const locationsAll = asProviderArray(locationsData.locations)
    const locations = sinceMs
      ? locationsAll.filter((loc) => {
          const ts = pv(loc, "timestamp", "datetime")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : locationsAll

    // Sync Events/Violations
    let eventsResponse = await fetch(`${apiBaseUrl}/violations?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!eventsResponse.ok && eventsResponse.status === 404) {
      eventsResponse = await fetch(`${fallbackUrl}/violations?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    const eventsData = (await eventsResponse.json()) as { violations?: unknown }
    const eventsAll = asProviderArray(eventsData.violations)
    const events = sinceMs
      ? eventsAll.filter((event) => {
          const ts = pv(event, "event_time", "datetime", "occurred_at", "timestamp")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : eventsAll

    // Sync Safety Events
    let safetyEventsResponse = await fetch(`${apiBaseUrl}/safety_events?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    // Fallback to old domain if new one fails
    if (!safetyEventsResponse.ok && safetyEventsResponse.status === 404) {
      safetyEventsResponse = await fetch(`${fallbackUrl}/safety_events?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    if (!safetyEventsResponse.ok) {
      throw new Error(`Motive/KeepTruckin safety events API error: ${safetyEventsResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "motive", "safety_events")

    const safetyEventsData = (await safetyEventsResponse.json()) as {
      safety_events?: unknown
      events?: unknown
      data?: unknown
    }
    const safetyEventsAll = asProviderArray(
      safetyEventsData.safety_events ?? safetyEventsData.events ?? safetyEventsData.data
    )
    const safetyEvents = sinceMs
      ? safetyEventsAll.filter((event) => {
          const ts = pv(event, "event_time", "datetime", "occurred_at", "timestamp", "time")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : safetyEventsAll

    // Sync provider DVIRs
    let dvirsResponse = await fetch(`${apiBaseUrl}/vehicle_inspections?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    // Fallback to old domain if new one fails
    if (!dvirsResponse.ok && dvirsResponse.status === 404) {
      dvirsResponse = await fetch(`${fallbackUrl}/vehicle_inspections?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    if (!dvirsResponse.ok) {
      throw new Error(`Motive/KeepTruckin DVIR API error: ${dvirsResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "motive", "dvirs")

    const dvirsData = (await dvirsResponse.json()) as {
      vehicle_inspections?: unknown
      inspections?: unknown
      data?: unknown
    }
    const dvirsAll = asProviderArray(dvirsData.vehicle_inspections ?? dvirsData.inspections ?? dvirsData.data)
    const dvirs = sinceMs
      ? dvirsAll.filter((inspection) => {
          const ts = pv(inspection, "inspection_time", "performed_at", "updated_at", "created_at", "timestamp")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : dvirsAll

    // Sync HOS clocks
    let clocksResponse = await fetch(`${apiBaseUrl}/hos_clocks?device_id=${encodedDeviceId}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    // Fallback to old domain if new one fails
    if (!clocksResponse.ok && clocksResponse.status === 404) {
      clocksResponse = await fetch(`${fallbackUrl}/hos_clocks?device_id=${encodedDeviceId}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    if (!clocksResponse.ok) {
      throw new Error(`Motive/KeepTruckin HOS clocks API error: ${clocksResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "motive", "hos_clocks")

    const clocksData = (await clocksResponse.json()) as {
      hos_clocks?: unknown
      clocks?: unknown
      data?: unknown
    }
    const clocksAll = asProviderArray(clocksData.hos_clocks ?? clocksData.clocks ?? clocksData.data)
    const clocks = sinceMs
      ? clocksAll.filter((clock) => {
          const ts = pv(clock, "updated_at", "updatedAt", "time", "timestamp")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : clocksAll

    // Store logs in database
    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueProviderDriverIds = [...new Set(
      logs.map((log) => pv(log, "driver_id", "driverId")).filter(isDefinedProviderId)
    )]
    
    // Fetch all mappings in a single query
    const { data: mappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "keeptruckin")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueProviderDriverIds.map(String))
    
    // Create lookup map
    const driverIdMap = new Map<string, string>()
    mappings?.forEach((m: EldDriverMappingRow) => {
      driverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueClockProviderDriverIds = [...new Set(
      clocks.map((clock) => pv(clock, "driver_id", "driverId")).filter(isDefinedProviderId)
    )]

    const { data: clockMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "keeptruckin")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueClockProviderDriverIds.map(String))

    const clockDriverIdMap = new Map<string, string>()
    clockMappings?.forEach((m: EldDriverMappingRow) => {
      clockDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueSafetyEventDriverIds = [...new Set(
      safetyEvents.map((event) => pv(event, "driver_id", "driverId")).filter(isDefinedProviderId)
    )]

    const { data: safetyEventMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "keeptruckin")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueSafetyEventDriverIds.map(String))

    const safetyEventDriverIdMap = new Map<string, string>()
    safetyEventMappings?.forEach((m: EldDriverMappingRow) => {
      safetyEventDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueDvirDriverIds = [...new Set(
      dvirs.map((inspection) => pv(inspection, "driver_id", "driverId")).filter(isDefinedProviderId)
    )]

    const { data: dvirMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "keeptruckin")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueDvirDriverIds.map(String))

    const dvirDriverIdMap = new Map<string, string>()
    dvirMappings?.forEach((m: EldDriverMappingRow) => {
      dvirDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Map provider driver IDs to internal driver IDs
    const logsToInsert = logs.map((log) => {
      const providerDriverId = pv(log, "driver_id", "driverId")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? driverIdMap.get(String(providerDriverId)) || null
          : null

      const startLoc = nestedRecord(log, "start_location")
      const endLoc = nestedRecord(log, "end_location")
      const odometerStart = pvNum(log, "odometer_start", "start_odometer")
      const odometerEnd = pvNum(log, "odometer_end", "end_odometer")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        log_date: pv(log, "date", "log_date"),
        log_type: mapKeepTruckinStatus(pvString(log, "status") ?? ""),
        start_time: pv(log, "start_time", "start_datetime"),
        end_time: pv(log, "end_time", "end_datetime"),
        duration_minutes:
          pvNum(log, "duration_minutes") ??
          calculateDuration(pvString(log, "start_time") ?? "", pvString(log, "end_time") ?? ""),
        location_start: startLoc
          ? {
              lat: pvNum(startLoc, "latitude"),
              lng: pvNum(startLoc, "longitude"),
              address: pvString(startLoc, "address"),
            }
          : null,
        location_end: endLoc
          ? {
              lat: pvNum(endLoc, "latitude"),
              lng: pvNum(endLoc, "longitude"),
              address: pvString(endLoc, "address"),
            }
          : null,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        miles_driven:
          pvNum(log, "miles_driven") ??
          (odometerEnd != null && odometerStart != null ? odometerEnd - odometerStart : null),
        engine_hours: pvNum(log, "engine_hours"),
        violations: pv(log, "violations") ?? null,
        raw_data: log,
      }
    })

    let logsError: PostgrestError | null = null
    if (logsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_logs")
        .upsert(logsToInsert, { 
          onConflict: "eld_device_id,log_date,start_time,log_type",
          ignoreDuplicates: false 
        })
      logsError = error

      if (logsError) {
        Sentry.captureException(logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // Store locations in database
    // Reuse driver mapping for locations
    const locationsToInsert = locations.map((loc) => {
      const providerDriverId = pv(loc, "driver_id", "driverId")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? driverIdMap.get(String(providerDriverId)) || null
          : null

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        timestamp: pv(loc, "timestamp", "datetime"),
        latitude: pvNum(loc, "latitude", "lat"),
        longitude: pvNum(loc, "longitude", "lng"),
        address: pvString(loc, "address", "formatted_address"),
        speed: pvNum(loc, "speed") ?? null,
        heading: pvNum(loc, "heading", "bearing") ?? null,
        odometer: pvNum(loc, "odometer") ?? null,
        engine_status: pvString(loc, "engine_status") ?? (pv(loc, "engine_on") === true ? "on" : "off"),
      }
    })

    let locationsError: PostgrestError | null = null
    if (locationsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)
      locationsError = error

      if (locationsError) {
        Sentry.captureException(locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
      }
    }

    // Store events in database
    const eventsToInsert = events.map((event) => {
      const eLoc = nestedRecord(event, "location")
      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: pv(event, "driver_id") ?? null,
        truck_id: device.truck_id || null,
        event_type: mapKeepTruckinEventType(pvString(event, "type") ?? ""),
        severity: pvString(event, "severity") ?? "warning",
        title: pvString(event, "title", "violation_type"),
        description: pvString(event, "description", "message"),
        event_time: pv(event, "event_time", "datetime"),
        location: eLoc
          ? {
              lat: pvNum(eLoc, "latitude"),
              lng: pvNum(eLoc, "longitude"),
              address: pvString(eLoc, "address"),
            }
          : null,
        resolved: false,
        metadata: event,
      }
    })
    const safetyEventsToInsert = safetyEvents.map((event) => {
      const providerDriverId = pv(event, "driver_id", "driverId")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? safetyEventDriverIdMap.get(String(providerDriverId)) || null
          : null
      const eLoc = nestedRecord(event, "location")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        event_type: mapKeepTruckinSafetyEventType(pvString(event, "event_type", "type") ?? ""),
        severity: pvString(event, "severity") ?? "warning",
        title: pvString(event, "title", "event_type", "type") ?? "Safety event",
        description: pvString(event, "description", "message"),
        event_time: pv(event, "event_time", "datetime", "occurred_at", "timestamp", "time") ?? new Date().toISOString(),
        location: eLoc
          ? {
              lat: pvNum(eLoc, "latitude", "lat"),
              lng: pvNum(eLoc, "longitude", "lng"),
              address: pvString(eLoc, "address"),
            }
          : null,
        resolved: false,
        metadata: {
          ...event,
          source: "safety_events",
        },
      }
    })
    const allEventsToInsert = [...eventsToInsert, ...safetyEventsToInsert]

    let eventsError: PostgrestError | null = null
    if (allEventsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_events")
        .insert(allEventsToInsert)
      eventsError = error

      if (eventsError) {
        Sentry.captureException(eventsError)
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
      }
    }

    const clocksToUpsert = clocks.flatMap((clock) => {
      const providerDriverId = pv(clock, "driver_id", "driverId")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? clockDriverIdMap.get(String(providerDriverId)) || null
          : null

      if (!internalDriverId) return []

      return [{
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        remaining_drive_ms:
          pvNum(clock, "remaining_drive_ms", "remainingDriveMs", "drive_remaining_ms") ?? null,
        remaining_shift_ms:
          pvNum(clock, "remaining_shift_ms", "remainingShiftMs", "shift_remaining_ms") ?? null,
        remaining_cycle_ms:
          pvNum(clock, "remaining_cycle_ms", "remainingCycleMs", "cycle_remaining_ms") ?? null,
        cycle_type: pvString(clock, "cycle_type", "cycleType", "cycle") ?? null,
        updated_at:
          pv(clock, "updated_at", "updatedAt", "time", "timestamp") ?? new Date().toISOString(),
        raw_data: clock,
      }]
    })

    if (clocksToUpsert.length > 0) {
      const { error: clocksError } = await supabase
        .from("eld_hos_clocks")
        .upsert(clocksToUpsert, {
          onConflict: "eld_device_id,driver_id",
          ignoreDuplicates: false,
        })

      if (clocksError) {
        Sentry.captureException(clocksError)
        return { error: `Failed to sync HOS clocks: ${clocksError.message}`, data: null }
      }
    }

    const dvirsToUpsert = device.truck_id
      ? dvirs.flatMap((inspection) => {
          const providerInspectionId = pvString(
            inspection,
            "id",
            "inspection_id",
            "inspectionId",
            "uuid"
          )
          if (!providerInspectionId) return []

          const providerDriverId = pv(inspection, "driver_id", "driverId")
          const internalDriverId =
            providerDriverId !== undefined && providerDriverId !== null
              ? dvirDriverIdMap.get(String(providerDriverId)) || null
              : null
          if (!internalDriverId) return []

          const inspectionTimestamp =
            pvString(inspection, "inspection_time", "performed_at", "updated_at", "created_at", "timestamp") ??
            new Date().toISOString()
          const parsedDate = new Date(inspectionTimestamp)
          const inspectionDate = Number.isFinite(parsedDate.getTime())
            ? parsedDate.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
          const inspectionTime = Number.isFinite(parsedDate.getTime())
            ? parsedDate.toISOString().split("T")[1]?.slice(0, 8)
            : null

          const defectsRaw = asProviderArray(pv(inspection, "defects", "issues", "vehicle_defects"))
          const defects = defectsRaw.map((defect) => ({
            component: pvString(defect, "component", "system", "name") ?? "vehicle",
            description: pvString(defect, "description", "detail", "message") ?? "Reported defect",
            severity: pvString(defect, "severity", "level") ?? "medium",
            corrected: pv(defect, "corrected", "resolved") === true,
          }))
          const defectsFound = defects.length > 0 || pv(inspection, "defects_found", "has_defects") === true
          const safeToOperate = pv(inspection, "safe_to_operate", "safeToOperate") !== false
          const status = deriveDvirStatus(defectsFound, defects)

          return [{
            company_id: device.company_id,
            driver_id: internalDriverId,
            truck_id: device.truck_id,
            inspection_type: mapProviderInspectionType(pvString(inspection, "inspection_type", "type")),
            inspection_date: inspectionDate,
            inspection_time: inspectionTime,
            location: pvString(inspection, "location", "address"),
            mileage: pvNum(inspection, "mileage"),
            odometer_reading: pvNum(inspection, "odometer", "odometer_reading"),
            status,
            defects_found: defectsFound,
            safe_to_operate: safeToOperate,
            defects: defects.length > 0 ? defects : null,
            notes: pvString(inspection, "notes", "comment", "description"),
            corrective_action: pvString(inspection, "corrective_action", "action_taken"),
            source: "motive",
            provider_inspection_id: providerInspectionId,
          }]
        })
      : []

    if (dvirsToUpsert.length > 0) {
      const { error: dvirsError } = await supabase
        .from("dvir")
        .upsert(dvirsToUpsert, {
          onConflict: "company_id,source,provider_inspection_id",
          ignoreDuplicates: false,
        })

      if (dvirsError) {
        Sentry.captureException(dvirsError)
        return { error: `Failed to sync provider DVIRs: ${dvirsError.message}`, data: null }
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    return {
      data: {
        logs: logsToInsert.length,
        locations: locationsToInsert.length,
        events: allEventsToInsert.length,
        clocks: clocksToUpsert.length,
        dvirs: dvirsToUpsert.length
      },
      errors: undefined,
      error: null
    }

  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to sync KeepTruckin data"
    return { error: message, data: null }
  }
}

// Samsara API integration
async function syncSamsaraData(device: EldDeviceSyncRow, sinceMs?: number | null) {
  const supabase = createAdminClient()
  
  if (!device.api_key) {
    return { error: "API key not configured", data: null }
  }

  try {
    // Samsara uses different endpoint structure
    const baseUrl = "https://api.samsara.com"
    // V3-009 FIX: Encode provider_device_id to prevent URL manipulation
    const vehicleId = encodeURIComponent(device.provider_device_id)

    // Sync HOS Logs - Correct Samsara v2 API endpoint
    // Get driver IDs first if available
    const driverIds = device.driver_id ? [device.driver_id] : []
    const logsUrl = driverIds.length > 0
      ? `${baseUrl}/v2/fleet/hos/daily-logs?driverIds=${driverIds.join(',')}`
      : `${baseUrl}/v2/fleet/hos/daily-logs?vehicleIds=${vehicleId}`
    
    const logsResponse = await fetch(logsUrl, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!logsResponse.ok) {
      throw new Error(`Samsara API error: ${logsResponse.statusText}`)
    }

    const logsData = (await logsResponse.json()) as { data?: unknown }
    const logsAll = asProviderArray(logsData.data)
    const logs = sinceMs
      ? logsAll.filter((log) => {
          const ts = pv(
            log,
            "startTime",
            "start_time",
            "logStartTime",
            "endTime",
            "end_time",
            "logEndTime",
            "date",
            "log_date"
          )
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : logsAll

    // Sync Locations - Correct Samsara v2 API endpoint
    const locationsResponse = await fetch(`${baseUrl}/v2/fleet/vehicles/locations/feed?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    const locationsData = (await locationsResponse.json()) as { data?: unknown }
    const locationsAll = asProviderArray(locationsData.data)
    const locations = sinceMs
      ? locationsAll.filter((loc) => {
          const ts = pv(loc, "time", "timestamp", "datetime")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : locationsAll

    // Sync Events - Use correct Samsara HOS violations endpoint (not safety score)
    const eventsResponse = await fetch(`${baseUrl}/v2/fleet/hos/violations?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!eventsResponse.ok) {
      throw new Error(`Samsara events API error: ${eventsResponse.statusText}`)
    }

    const eventsData = (await eventsResponse.json()) as { data?: unknown }
    const eventsAll = asProviderArray(eventsData.data)
    const events = sinceMs
      ? eventsAll.filter((event) => {
          const ts = pv(event, "time", "timestamp", "eventTime")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : eventsAll

    // Sync safety events (harsh braking, hard acceleration, speeding)
    const safetyEventsResponse = await fetch(`${baseUrl}/v2/fleet/safety/events?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!safetyEventsResponse.ok) {
      throw new Error(`Samsara safety events API error: ${safetyEventsResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "samsara", "safety_events")

    const safetyEventsData = (await safetyEventsResponse.json()) as { data?: unknown }
    const safetyEventsAll = asProviderArray(safetyEventsData.data)
    const safetyEvents = sinceMs
      ? safetyEventsAll.filter((event) => {
          const ts = pv(event, "time", "timestamp", "eventTime", "occurredAt")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : safetyEventsAll

    // Sync provider DVIRs
    const dvirsUrl = driverIds.length > 0
      ? `${baseUrl}/v2/fleet/dvirs?driverIds=${driverIds.join(',')}`
      : `${baseUrl}/v2/fleet/dvirs?vehicleIds=${vehicleId}`
    const dvirsResponse = await fetch(dvirsUrl, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!dvirsResponse.ok) {
      throw new Error(`Samsara DVIR API error: ${dvirsResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "samsara", "dvirs")

    const dvirsData = (await dvirsResponse.json()) as { data?: unknown }
    const dvirsAll = asProviderArray(dvirsData.data)
    const dvirs = sinceMs
      ? dvirsAll.filter((inspection) => {
          const ts = pv(inspection, "updatedAt", "time", "timestamp", "inspectionTime")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : dvirsAll

    // Sync HOS clocks - live remaining hours per driver
    const clocksUrl = driverIds.length > 0
      ? `${baseUrl}/v2/fleet/hos/clocks?driverIds=${driverIds.join(',')}`
      : `${baseUrl}/v2/fleet/hos/clocks?vehicleIds=${vehicleId}`

    const clocksResponse = await fetch(clocksUrl, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!clocksResponse.ok) {
      throw new Error(`Samsara HOS clocks API error: ${clocksResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "samsara", "hos_clocks")

    const clocksData = (await clocksResponse.json()) as { data?: unknown }
    const clocksAll = asProviderArray(clocksData.data)
    const clocks = sinceMs
      ? clocksAll.filter((clock) => {
          const ts = pv(clock, "updatedAt", "updated_at", "time", "timestamp")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : clocksAll

    // Sync engine diagnostics and fault codes
    const vehicleStatsResponse = await fetch(`${baseUrl}/v2/fleet/vehicles/stats?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!vehicleStatsResponse.ok) {
      throw new Error(`Samsara vehicle stats API error: ${vehicleStatsResponse.statusText}`)
    }

    await recordBillableApiUsage(device.company_id, "samsara", "vehicle_stats")

    const vehicleStatsData = (await vehicleStatsResponse.json()) as { data?: unknown }
    const vehicleStatsAll = asProviderArray(vehicleStatsData.data)
    const vehicleStats = sinceMs
      ? vehicleStatsAll.filter((stat) => {
          const ts = pv(stat, "time", "timestamp", "updatedAt", "reportedAt")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : vehicleStatsAll

    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueProviderDriverIds = [...new Set(
      logs.map((log) => pv(log, "driver_id", "driverId")).filter(isDefinedProviderId)
    )]
    
    // Fetch all mappings in a single query
    const { data: mappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueProviderDriverIds.map(String))
    
    // Create lookup map
    const driverIdMap = new Map<string, string>()
    mappings?.forEach((m: EldDriverMappingRow) => {
      driverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store logs
    const logsToInsert = logs.map((log) => {
      const providerDriverId = pv(log, "driver_id", "driverId")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? driverIdMap.get(String(providerDriverId)) || null
          : null

      const startL = nestedRecord(log, "startLocation")
      const endL = nestedRecord(log, "endLocation")
      const odometerStart = pvNum(log, "startOdometer", "odometerStart")
      const odometerEnd = pvNum(log, "endOdometer", "odometerEnd")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        log_date: pvString(log, "date", "logDate") ?? new Date().toISOString().split("T")[0],
        log_type: mapSamsaraStatus(pvString(log, "status", "dutyStatus") ?? ""),
        start_time: pv(log, "startTime", "start_time", "logStartTime"),
        end_time: pv(log, "endTime", "end_time", "logEndTime"),
        duration_minutes:
          pvNum(log, "durationMinutes") ??
          calculateDuration(
            pvString(log, "startTime", "start_time", "logStartTime") ?? "",
            pvString(log, "endTime", "end_time", "logEndTime") ?? ""
          ),
        location_start: startL
          ? {
              lat: pvNum(startL, "latitude", "lat"),
              lng: pvNum(startL, "longitude", "lng"),
              address: pvString(startL, "address", "formattedAddress"),
            }
          : null,
        location_end: endL
          ? {
              lat: pvNum(endL, "latitude", "lat"),
              lng: pvNum(endL, "longitude", "lng"),
              address: pvString(endL, "address", "formattedAddress"),
            }
          : null,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        miles_driven:
          pvNum(log, "milesDriven") ??
          (odometerEnd != null && odometerStart != null ? odometerEnd - odometerStart : null),
        engine_hours: pvNum(log, "engineHours") ?? null,
        violations: pv(log, "violations") ?? null,
        raw_data: log,
      }
    })

    if (logsToInsert.length > 0) {
      const { error: logsError } = await supabase
        .from("eld_logs")
        .upsert(logsToInsert, { 
          onConflict: "eld_device_id,log_date,start_time,log_type",
          ignoreDuplicates: false 
        })

      if (logsError) {
        Sentry.captureException(logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // OPTIMIZATION: Batch fetch driver mappings for locations
    const uniqueLocationDriverIds = [...new Set(
      locations.map((loc) => pv(loc, "driverId", "driver_id")).filter(isDefinedProviderId)
    )]
    
    const { data: locationMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueLocationDriverIds.map(String))
    
    const locationDriverIdMap = new Map<string, string>()
    locationMappings?.forEach((m: EldDriverMappingRow) => {
      locationDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store locations
    const locationsToInsert = locations.map((loc) => {
      const providerDriverId = pv(loc, "driverId", "driver_id")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? locationDriverIdMap.get(String(providerDriverId)) || null
          : null

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        timestamp: pv(loc, "time", "timestamp", "datetime") ?? new Date().toISOString(),
        latitude: pvNum(loc, "latitude", "lat"),
        longitude: pvNum(loc, "longitude", "lng", "lon"),
        address: pvString(loc, "address", "formattedAddress", "name"),
        speed: pvNum(loc, "speed", "speedMph") ?? null,
        heading: pvNum(loc, "heading", "bearing") ?? null,
        odometer: pvNum(loc, "odometer", "odometerMiles") ?? null,
        engine_status:
          pvString(loc, "engineState") ??
          (pv(loc, "engineOn") === true ? "on" : pv(loc, "engineOn") === false ? "off" : "unknown"),
      }
    })

    if (locationsToInsert.length > 0) {
      const { error: locationsError } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)

      if (locationsError) {
        Sentry.captureException(locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
      }
    }

    // OPTIMIZATION: Batch fetch driver mappings for events
    const uniqueEventDriverIds = [...new Set(
      events.map((event) => pv(event, "driverId", "driver_id")).filter(isDefinedProviderId)
    )]
    
    const { data: eventMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueEventDriverIds.map(String))
    
    const eventDriverIdMap = new Map<string, string>()
    eventMappings?.forEach((m: EldDriverMappingRow) => {
      eventDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueSafetyEventDriverIds = [...new Set(
      safetyEvents.map((event) => pv(event, "driverId", "driver_id")).filter(isDefinedProviderId)
    )]

    const { data: safetyEventMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueSafetyEventDriverIds.map(String))

    const safetyEventDriverIdMap = new Map<string, string>()
    safetyEventMappings?.forEach((m: EldDriverMappingRow) => {
      safetyEventDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueDvirDriverIds = [...new Set(
      dvirs.map((inspection) => pv(inspection, "driverId", "driver_id")).filter(isDefinedProviderId)
    )]

    const { data: dvirMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueDvirDriverIds.map(String))

    const dvirDriverIdMap = new Map<string, string>()
    dvirMappings?.forEach((m: EldDriverMappingRow) => {
      dvirDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })

    const uniqueClockDriverIds = [...new Set(
      clocks.map((clock) => pv(clock, "driverId", "driver_id")).filter(isDefinedProviderId)
    )]

    const { data: clockMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueClockDriverIds.map(String))

    const clockDriverIdMap = new Map<string, string>()
    clockMappings?.forEach((m: EldDriverMappingRow) => {
      clockDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store events
    const eventsToInsert = events.map((event) => {
      const providerDriverId = pv(event, "driverId", "driver_id")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? eventDriverIdMap.get(String(providerDriverId)) || null
          : null

      const eLoc = nestedRecord(event, "location")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        event_type: mapSamsaraEventType(pvString(event, "type", "eventType") ?? ""),
        severity: pvString(event, "severity", "priority") ?? "warning",
        title: pvString(event, "title", "name", "eventType") ?? "Event",
        description: pvString(event, "description", "message", "details"),
        event_time: pv(event, "time", "timestamp", "eventTime") ?? new Date().toISOString(),
        location: eLoc
          ? {
              lat: pvNum(eLoc, "latitude", "lat"),
              lng: pvNum(eLoc, "longitude", "lng"),
              address: pvString(eLoc, "address", "formattedAddress"),
            }
          : null,
        resolved: false,
        metadata: event,
      }
    })
    const safetyEventsToInsert = safetyEvents.map((event) => {
      const providerDriverId = pv(event, "driverId", "driver_id")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? safetyEventDriverIdMap.get(String(providerDriverId)) || null
          : null

      const eLoc = nestedRecord(event, "location")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        event_type: mapSamsaraSafetyEventType(pvString(event, "eventType", "event_type", "type") ?? ""),
        severity: pvString(event, "severity", "priority") ?? "warning",
        title: pvString(event, "title", "name", "eventType", "event_type") ?? "Safety event",
        description: pvString(event, "description", "message", "details"),
        event_time: pv(event, "time", "timestamp", "eventTime", "occurredAt") ?? new Date().toISOString(),
        location: eLoc
          ? {
              lat: pvNum(eLoc, "latitude", "lat"),
              lng: pvNum(eLoc, "longitude", "lng"),
              address: pvString(eLoc, "address", "formattedAddress"),
            }
          : null,
        resolved: false,
        metadata: {
          ...event,
          source: "safety_events",
        },
      }
    })
    const allEventsToInsert = [...eventsToInsert, ...safetyEventsToInsert]

    if (allEventsToInsert.length > 0) {
      const { error: eventsError } = await supabase
        .from("eld_events")
        .insert(allEventsToInsert)

      if (eventsError) {
        Sentry.captureException(eventsError)
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
      }
    }

    const clocksToUpsert = clocks.flatMap((clock) => {
      const providerDriverId = pv(clock, "driverId", "driver_id")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? clockDriverIdMap.get(String(providerDriverId)) || null
          : null

      if (!internalDriverId) return []

      return [{
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        remaining_drive_ms:
          pvNum(
            clock,
            "remainingDriveTimeMs",
            "remainingDriveMs",
            "remaining_drive_ms",
            "driveRemainingMs"
          ) ?? null,
        remaining_shift_ms:
          pvNum(
            clock,
            "remainingShiftTimeMs",
            "remainingShiftMs",
            "remaining_shift_ms",
            "shiftRemainingMs"
          ) ?? null,
        remaining_cycle_ms:
          pvNum(
            clock,
            "remainingCycleTimeMs",
            "remainingCycleMs",
            "remaining_cycle_ms",
            "cycleRemainingMs"
          ) ?? null,
        cycle_type: pvString(clock, "cycleType", "cycle_type", "cycle") ?? null,
        updated_at:
          pv(clock, "updatedAt", "updated_at", "time", "timestamp") ?? new Date().toISOString(),
        raw_data: clock,
      }]
    })

    if (clocksToUpsert.length > 0) {
      const { error: clocksError } = await supabase
        .from("eld_hos_clocks")
        .upsert(clocksToUpsert, {
          onConflict: "eld_device_id,driver_id",
          ignoreDuplicates: false,
        })

      if (clocksError) {
        Sentry.captureException(clocksError)
        return { error: `Failed to sync HOS clocks: ${clocksError.message}`, data: null }
      }
    }

    const samsaraDiagnosticsToInsert = vehicleStats.flatMap((stat) => {
      const occurredAt = pv(stat, "time", "timestamp", "updatedAt", "reportedAt") ?? new Date().toISOString()
      const diagnosticsRows: Array<Record<string, unknown>> = []

      const engineState = pvMetricString(stat, "engineState", "engine_state")
      if (engineState) {
        diagnosticsRows.push({
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: device.driver_id || null,
          truck_id: device.truck_id || null,
          diagnostic_type: "engine_stat",
          metric_name: "engine_state",
          metric_value_num: null,
          metric_value_text: engineState,
          metric_unit: null,
          fault_code: null,
          fault_code_category: null,
          severity: "info",
          description: "Vehicle engine state",
          status: engineState,
          occurred_at: occurredAt,
          raw_data: stat,
        })
      }

      const metricDefs = [
        { metric_name: "engine_seconds", unit: "seconds", keys: ["obdEngineSeconds", "engineSeconds"] },
        { metric_name: "odometer_m", unit: "meters", keys: ["obdOdometerMeters", "odometerMeters", "odometer"] },
        { metric_name: "gps_odometer_m", unit: "meters", keys: ["gpsOdometerMeters"] },
        { metric_name: "battery_voltage", unit: "volts", keys: ["batteryVoltage", "voltage"] },
      ]

      for (const metricDef of metricDefs) {
        const value = pvMetricNum(stat, ...metricDef.keys)
        if (value === undefined) continue
        diagnosticsRows.push({
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: device.driver_id || null,
          truck_id: device.truck_id || null,
          diagnostic_type: "engine_stat",
          metric_name: metricDef.metric_name,
          metric_value_num: value,
          metric_value_text: null,
          metric_unit: metricDef.unit,
          fault_code: null,
          fault_code_category: null,
          severity: "info",
          description: `Samsara vehicle stat: ${metricDef.metric_name}`,
          status: null,
          occurred_at: occurredAt,
          raw_data: stat,
        })
      }

      const faultCodesRaw = pv(stat, "faultCodes", "activeFaultCodes", "dtcCodes")
      if (Array.isArray(faultCodesRaw)) {
        for (const faultCodeItem of faultCodesRaw) {
          const faultCodeObj =
            faultCodeItem && typeof faultCodeItem === "object" && !Array.isArray(faultCodeItem)
              ? (faultCodeItem as ProviderApiJson)
              : null
          const faultCode = faultCodeObj
            ? pvString(faultCodeObj, "code", "id", "faultCode")
            : typeof faultCodeItem === "string"
              ? faultCodeItem
              : undefined

          if (!faultCode) continue

          const faultDescription = faultCodeObj
            ? pvString(faultCodeObj, "description", "name", "message")
            : null
          const faultCategory = determineFaultCodeCategory(faultCode)
          const faultSeverity = faultCodeObj
            ? pvString(faultCodeObj, "severity", "level")
            : "warning"

          diagnosticsRows.push({
            company_id: device.company_id,
            eld_device_id: device.id,
            driver_id: device.driver_id || null,
            truck_id: device.truck_id || null,
            diagnostic_type: "fault_code",
            metric_name: null,
            metric_value_num: null,
            metric_value_text: null,
            metric_unit: null,
            fault_code: faultCode,
            fault_code_category: faultCategory,
            severity: faultSeverity ?? "warning",
            description: faultDescription,
            status: "active",
            occurred_at: occurredAt,
            raw_data: stat,
          })
        }
      }

      return diagnosticsRows
    })

    if (samsaraDiagnosticsToInsert.length > 0) {
      const { error: diagnosticsError } = await supabase
        .from("eld_diagnostics")
        .insert(samsaraDiagnosticsToInsert)

      if (diagnosticsError) {
        Sentry.captureException(diagnosticsError)
        return { error: `Failed to sync diagnostics: ${diagnosticsError.message}`, data: null }
      }
    }

    const dvirsToUpsert = device.truck_id
      ? dvirs.flatMap((inspection) => {
          const providerInspectionId = pvString(inspection, "id", "inspectionId", "dvirId")
          if (!providerInspectionId) return []

          const providerDriverId = pv(inspection, "driverId", "driver_id")
          const internalDriverId =
            providerDriverId !== undefined && providerDriverId !== null
              ? dvirDriverIdMap.get(String(providerDriverId)) || null
              : null
          if (!internalDriverId) return []

          const inspectionTimestamp =
            pvString(inspection, "inspectionTime", "time", "timestamp", "updatedAt") ??
            new Date().toISOString()
          const parsedDate = new Date(inspectionTimestamp)
          const inspectionDate = Number.isFinite(parsedDate.getTime())
            ? parsedDate.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
          const inspectionTime = Number.isFinite(parsedDate.getTime())
            ? parsedDate.toISOString().split("T")[1]?.slice(0, 8)
            : null

          const defectsRaw = asProviderArray(pv(inspection, "defects", "issues"))
          const defects = defectsRaw.map((defect) => ({
            component: pvString(defect, "component", "name", "category") ?? "vehicle",
            description: pvString(defect, "description", "comment", "message") ?? "Reported defect",
            severity: pvString(defect, "severity", "priority") ?? "medium",
            corrected: pv(defect, "corrected", "resolved") === true,
          }))
          const defectsFound = defects.length > 0 || pv(inspection, "defectsFound", "hasDefects") === true
          const safeToOperate = pv(inspection, "safeToOperate", "safe_to_operate") !== false
          const status = deriveDvirStatus(defectsFound, defects)

          return [{
            company_id: device.company_id,
            driver_id: internalDriverId,
            truck_id: device.truck_id,
            inspection_type: mapProviderInspectionType(pvString(inspection, "inspectionType", "inspection_type")),
            inspection_date: inspectionDate,
            inspection_time: inspectionTime,
            location: pvString(inspection, "location", "address", "formattedAddress"),
            mileage: pvNum(inspection, "mileage"),
            odometer_reading: pvNum(inspection, "odometer", "odometerReading"),
            status,
            defects_found: defectsFound,
            safe_to_operate: safeToOperate,
            defects: defects.length > 0 ? defects : null,
            notes: pvString(inspection, "notes", "comment"),
            corrective_action: pvString(inspection, "correctiveAction", "corrective_action"),
            source: "samsara",
            provider_inspection_id: providerInspectionId,
          }]
        })
      : []

    if (dvirsToUpsert.length > 0) {
      const { error: dvirsError } = await supabase
        .from("dvir")
        .upsert(dvirsToUpsert, {
          onConflict: "company_id,source,provider_inspection_id",
          ignoreDuplicates: false,
        })

      if (dvirsError) {
        Sentry.captureException(dvirsError)
        return { error: `Failed to sync provider DVIRs: ${dvirsError.message}`, data: null }
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    return {
      data: {
        logs: logs.length,
        locations: locations.length,
        events: allEventsToInsert.length,
        clocks: clocksToUpsert.length,
        diagnostics: samsaraDiagnosticsToInsert.length,
        dvirs: dvirsToUpsert.length
      },
      error: null
    }

  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to sync Samsara data"
    return { error: message, data: null }
  }
}

// Geotab API integration
async function syncGeotabData(device: EldDeviceSyncRow, sinceMs?: number | null) {
  const supabase = createAdminClient()
  
  if (!device.api_key || !device.api_secret) {
    return { error: "API credentials not configured", data: null }
  }

  try {
    // SECURITY: Validate Geotab base URL to prevent SSRF
    // Only allow official Geotab domains
    const allowedGeotabDomains = [
      "https://my.geotab.com",
      "https://my1.geotab.com",
      "https://my2.geotab.com",
      "https://my3.geotab.com",
      "https://my4.geotab.com",
      "https://my5.geotab.com",
    ]
    
    // Geotab server URL should be stored in a separate field, not provider_device_id
    // Use api_endpoint from eld_devices when provided, with allowlist SSRF protection
    let baseUrl = "https://my.geotab.com/apiv1" // Default Geotab server
    
    if (device.api_endpoint) {
      try {
        const url = new URL(device.api_endpoint)
        const normalized = `${url.protocol}//${url.host}`
        // Ensure endpoint is one of the allowed Geotab domains
        if (allowedGeotabDomains.includes(normalized)) {
          baseUrl = `${normalized}/apiv1`
        } else {
          Sentry.captureMessage(
            `[Geotab] api_endpoint is not an allowed Geotab domain, using default: ${normalized}`,
            "warning",
          )
        }
      } catch {
        Sentry.captureMessage(
          `[Geotab] Invalid api_endpoint value, using default: ${String(device.api_endpoint)}`,
          "warning",
        )
      }
    }
    
    // Geotab requires session-based authentication
    const sessionResponse = await fetch(`${baseUrl}/Authenticate`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userName: device.api_key,
        password: device.api_secret
      })
    })

    const sessionData = await sessionResponse.json()
    const sessionId = sessionData.result?.credentials?.sessionId

    if (!sessionId) {
      throw new Error("Geotab authentication failed")
    }

    // Get logs using Geotab API
    const logsResponse = await fetch(`${baseUrl}/Get`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "LogRecord",
          credentials: {
            sessionId: sessionId
          }
        }
      })
    })

    const logsData = (await logsResponse.json()) as { result?: unknown }
    const logsAll = asProviderArray(logsData.result)
    const logs = sinceMs
      ? logsAll.filter((log) => {
          const ts = pv(log, "startDateTime", "dateTime", "date", "logDate", "startDate")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : logsAll

    // Get locations
    const locationsResponse = await fetch(`${baseUrl}/Get`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "StatusData",
          credentials: {
            sessionId: sessionId
          }
        }
      })
    })

    const locationsData = (await locationsResponse.json()) as { result?: unknown }
    const locationsAll = asProviderArray(locationsData.result)
    const locations = sinceMs
      ? locationsAll.filter((loc) => {
          const ts = pv(loc, "dateTime", "date")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : locationsAll

    // Get events
    const eventsResponse = await fetch(`${baseUrl}/Get`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "FaultData",
          credentials: {
            sessionId: sessionId
          }
        }
      })
    })

    const eventsData = (await eventsResponse.json()) as { result?: unknown }
    const eventsAll = asProviderArray(eventsData.result)
    const events = sinceMs
      ? eventsAll.filter((event) => {
          const ts = pv(event, "dateTime", "date", "occurredAt")
          const ms = getTimestampMs(ts)
          return ms !== null && ms >= sinceMs
        })
      : eventsAll

    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueGeotabDriverIds = [...new Set(
      logs.map((log) => geotabNestedDriverId(log)).filter((id): id is string => id != null && id !== "")
    )]
    
    const { data: geotabMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "geotab")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueGeotabDriverIds.map(String))
    
    const geotabDriverIdMap = new Map<string, string>()
    geotabMappings?.forEach((m: EldDriverMappingRow) => {
      geotabDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store Geotab data
    const logsToInsert = logs.map((log) => {
      const providerDriverId = geotabNestedDriverId(log)
      const internalDriverId = providerDriverId ? geotabDriverIdMap.get(String(providerDriverId)) || null : null

      const startLoc = nestedRecord(log, "startLocation")
      const endLoc = nestedRecord(log, "endLocation")
      const dateRaw = pv(log, "date")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        log_date: dateRaw
          ? new Date(String(dateRaw)).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        log_type: mapGeotabStatus(pvString(log, "dutyStatus") ?? ""),
        start_time: pv(log, "startDateTime", "date"),
        end_time: pv(log, "endDateTime", "date"),
        duration_minutes: (() => {
          const dur = pvNum(log, "duration")
          return dur != null ? Math.round(dur / 60) : null
        })(),
        location_start: startLoc
          ? {
              lat: pvNum(startLoc, "latitude"),
              lng: pvNum(startLoc, "longitude"),
              address: pvString(startLoc, "address"),
            }
          : null,
        location_end: endLoc
          ? {
              lat: pvNum(endLoc, "latitude"),
              lng: pvNum(endLoc, "longitude"),
              address: pvString(endLoc, "address"),
            }
          : null,
        odometer_start: pvNum(log, "startOdometer"),
        odometer_end: pvNum(log, "endOdometer"),
        miles_driven: (() => {
          const dist = pvNum(log, "distance")
          return dist != null ? dist * 0.000621371 : null
        })(),
        engine_hours: pvNum(log, "engineHours") ?? null,
        violations: pv(log, "violations") ?? null,
        raw_data: log,
      }
    })

    let logsError: PostgrestError | null = null
    if (logsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_logs")
        .upsert(logsToInsert, { 
          onConflict: "eld_device_id,log_date,start_time,log_type",
          ignoreDuplicates: false 
        })
      logsError = error

      if (logsError) {
        Sentry.captureException(logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // Reuse driver mapping for locations if needed
    const uniqueGeotabLocationDriverIds = [...new Set(
      locations.map((loc) => geotabNestedDriverId(loc)).filter((id): id is string => id != null && id !== "")
    )]
    
    const { data: geotabLocationMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "geotab")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueGeotabLocationDriverIds.map(String))
    
    const geotabLocationDriverIdMap = new Map<string, string>()
    geotabLocationMappings?.forEach((m: EldDriverMappingRow) => {
      geotabLocationDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    const locationsToInsert = locations.map((loc) => {
      const providerDriverId = geotabNestedDriverId(loc)
      const internalDriverId = providerDriverId
        ? geotabLocationDriverIdMap.get(String(providerDriverId)) || null
        : null

      const spd = pvNum(loc, "speed")
      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        timestamp: pv(loc, "dateTime", "date") ?? new Date().toISOString(),
        latitude: pvNum(loc, "latitude"),
        longitude: pvNum(loc, "longitude"),
        address: pvString(loc, "address") ?? null,
        speed: spd != null ? Math.round(spd * 2.23694) : null,
        heading: pvNum(loc, "heading") ?? null,
        odometer: pvNum(loc, "odometer") ?? null,
        engine_status: pvString(loc, "engineStatus") ?? "unknown",
      }
    })

    let locationsError: PostgrestError | null = null
    if (locationsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)
      locationsError = error

      if (locationsError) {
        Sentry.captureException(locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
      }
    }

    const eventsToInsert = events.map((event) => {
      const fc = nestedRecord(event, "faultCode")
      const driverObj = nestedRecord(event, "driver")
      const faultCode = pv(fc, "code") ?? pv(fc, "id") ?? pv(event, "code") ?? null
      const faultCodeCategory = determineFaultCodeCategory(
        pvString(fc, "name") ?? pvString(fc, "code") ?? pvString(event, "title") ?? ""
      )
      const faultCodeDescription = pvString(fc, "description") ?? pvString(event, "description") ?? null
      const eLoc = nestedRecord(event, "location")
      const driverIdRaw = driverObj ? pv(driverObj, "id") : pv(event, "driver_id")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: driverIdRaw != null ? String(driverIdRaw) : null,
        truck_id: device.truck_id || null,
        event_type: mapGeotabEventType(fc ? (pvString(fc, "name") ?? "") : ""),
        severity: pvString(event, "severity") ?? "warning",
        title: (fc ? pvString(fc, "name") : undefined) ?? "Event",
        description: faultCodeDescription,
        event_time: pv(event, "dateTime", "date") ?? new Date().toISOString(),
        location: eLoc
          ? {
              lat: pvNum(eLoc, "latitude"),
              lng: pvNum(eLoc, "longitude"),
              address: pvString(eLoc, "address"),
            }
          : null,
        resolved: false,
        fault_code: faultCode,
        fault_code_category: faultCodeCategory,
        fault_code_description: faultCodeDescription,
        metadata: event,
      }
    })

    let eventsError: PostgrestError | null = null
    if (eventsToInsert.length > 0) {
      const { error } = await supabase
        .from("eld_events")
        .insert(eventsToInsert)
      eventsError = error

      if (eventsError) {
        Sentry.captureException(eventsError)
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
      }
    }

    const geotabStatusDiagnosticsToInsert = locations.map((statusData) => {
      const diagnostic = nestedRecord(statusData, "diagnostic")
      const providerDriverId = geotabNestedDriverId(statusData)
      const internalDriverId = providerDriverId
        ? geotabLocationDriverIdMap.get(String(providerDriverId)) || null
        : null

      const rawStatusValue = pv(statusData, "data", "value")
      const metricValueNum =
        typeof rawStatusValue === "number" && Number.isFinite(rawStatusValue)
          ? rawStatusValue
          : pvNum(statusData, "value")
      const metricValueText =
        metricValueNum == null && rawStatusValue !== undefined && rawStatusValue !== null
          ? String(rawStatusValue)
          : pvString(statusData, "value")

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        diagnostic_type: "status_data",
        metric_name:
          pvString(diagnostic, "name", "id") ??
          pvString(statusData, "diagnosticName", "diagnosticId") ??
          "status_data",
        metric_value_num: metricValueNum ?? null,
        metric_value_text: metricValueText ?? null,
        metric_unit: pvString(statusData, "unit", "units"),
        fault_code: null,
        fault_code_category: null,
        severity: "info",
        description: pvString(statusData, "description", "name"),
        status: null,
        occurred_at: pv(statusData, "dateTime", "date", "time") ?? new Date().toISOString(),
        raw_data: statusData,
      }
    })

    const geotabFaultDiagnosticsToInsert = events.map((faultData) => {
      const fc = nestedRecord(faultData, "faultCode")
      const driverObj = nestedRecord(faultData, "driver")
      const providerDriverId = driverObj ? pv(driverObj, "id") : pv(faultData, "driverId", "driver_id")
      const internalDriverId =
        providerDriverId !== undefined && providerDriverId !== null
          ? geotabDriverIdMap.get(String(providerDriverId)) || null
          : null

      const faultCode = pv(fc, "code") ?? pv(fc, "id") ?? pv(faultData, "code") ?? null
      const faultCodeName = pvString(fc, "name") ?? pvString(fc, "code") ?? pvString(faultData, "title") ?? ""

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        diagnostic_type: "fault_code",
        metric_name: null,
        metric_value_num: null,
        metric_value_text: null,
        metric_unit: null,
        fault_code: faultCode != null ? String(faultCode) : null,
        fault_code_category: determineFaultCodeCategory(faultCodeName),
        severity: pvString(faultData, "severity") ?? "warning",
        description: pvString(fc, "description") ?? pvString(faultData, "description"),
        status: "active",
        occurred_at: pv(faultData, "dateTime", "date", "occurredAt") ?? new Date().toISOString(),
        raw_data: faultData,
      }
    })

    const geotabDiagnosticsToInsert = [
      ...geotabStatusDiagnosticsToInsert,
      ...geotabFaultDiagnosticsToInsert,
    ]

    if (geotabDiagnosticsToInsert.length > 0) {
      const { error: diagnosticsError } = await supabase
        .from("eld_diagnostics")
        .insert(geotabDiagnosticsToInsert)

      if (diagnosticsError) {
        Sentry.captureException(diagnosticsError)
        return { error: `Failed to sync diagnostics: ${diagnosticsError.message}`, data: null }
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    return {
      data: {
        logs: logsToInsert.length,
        locations: locationsToInsert.length,
        events: eventsToInsert.length,
        diagnostics: geotabDiagnosticsToInsert.length
      },
      errors: undefined,
      error: null
    }

  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to sync Geotab data"
    return { error: message, data: null }
  }
}

// Helper function to determine fault code category
// OBD-II fault code lookup table for proper categorization
const OBD_CODE_CATEGORIES: Record<string, string> = {
  // P0xxx codes (powertrain)
  'p01': 'engine',
  'p02': 'engine',
  'p03': 'engine',
  'p04': 'emissions',
  'p05': 'electrical',
  'p06': 'engine',
  'p07': 'transmission',
  'p08': 'engine',
  'p09': 'engine',
  // C0xxx codes (chassis)
  'c01': 'brakes',
  'c02': 'brakes',
  'c03': 'suspension',
  'c04': 'brakes',
  'c05': 'brakes',
  'c12': 'brakes',
  // B0xxx codes (body)
  'b00': 'electrical',
  'b01': 'electrical',
  // U0xxx codes (network)
  'u00': 'electrical',
  'u01': 'electrical',
}

function determineFaultCodeCategory(faultCodeName: string | null): string | null {
  if (!faultCodeName) return null
  
  const name = faultCodeName.toLowerCase().trim()
  
  // Extract OBD-II code prefix (e.g., "P0123" -> "p01")
  const codeMatch = name.match(/^([a-z])(\d{2})/)
  if (codeMatch) {
    const prefix = `${codeMatch[1]}${codeMatch[2]}`
    if (OBD_CODE_CATEGORIES[prefix]) {
      return OBD_CODE_CATEGORIES[prefix]
    }
  }
  
  // Fallback to keyword matching for non-standard codes
  if (name.includes('engine') || name.includes('misfire')) {
    return 'engine'
  }
  if (name.includes('transmission')) {
    return 'transmission'
  }
  if (name.includes('brake') || name.includes('abs')) {
    return 'brakes'
  }
  if (name.includes('electrical') || name.includes('voltage')) {
    return 'electrical'
  }
  if (name.includes('coolant') || name.includes('cooling') || name.includes('temperature')) {
    return 'cooling'
  }
  if (name.includes('fuel')) {
    return 'fuel'
  }
  if (name.includes('emission')) {
    return 'emissions'
  }
  
  return 'other'
}

// Helper functions
function mapKeepTruckinStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'driving': 'driving',
    'on_duty': 'on_duty',
    'off_duty': 'off_duty',
    'sleeper': 'sleeper_berth',
    'sleeper_berth': 'sleeper_berth'
  }
  return statusMap[status?.toLowerCase()] || 'on_duty'
}

function mapKeepTruckinEventType(type: string): string {
  const typeMap: Record<string, string> = {
    'hos_violation': 'hos_violation',
    'speeding': 'speeding',
    'hard_brake': 'hard_brake',
    'hard_accel': 'hard_accel',
    'device_malfunction': 'device_malfunction'
  }
  return typeMap[type?.toLowerCase()] || 'other'
}

function mapKeepTruckinSafetyEventType(type: string): string {
  const normalized = type?.toLowerCase()
  if (normalized.includes("speed")) return "speeding"
  if (normalized.includes("brake")) return "harsh_brake"
  if (normalized.includes("accel")) return "hard_accel"
  return "other"
}

function mapProviderInspectionType(type: string | undefined): string {
  const normalized = type?.toLowerCase() ?? ""
  if (normalized.includes("post")) return "post_trip"
  if (normalized.includes("road")) return "on_road"
  return "pre_trip"
}

type DvirDefect = { corrected?: boolean }

function deriveDvirStatus(defectsFound: boolean, defects: DvirDefect[]): string {
  if (!defectsFound) return "passed"
  const allCorrected = defects.length > 0 && defects.every((d) => d.corrected === true)
  return allCorrected ? "defects_corrected" : "failed"
}

function mapSamsaraStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'driving': 'driving',
    'on_duty': 'on_duty',
    'off_duty': 'off_duty',
    'sleeper': 'sleeper_berth',
    'sleeper_berth': 'sleeper_berth',
    'onDuty': 'on_duty',
    'offDuty': 'off_duty',
    'sleeperBerth': 'sleeper_berth'
  }
  return statusMap[status?.toLowerCase()] || 'on_duty'
}

function mapSamsaraEventType(type: string): string {
  const typeMap: Record<string, string> = {
    'hos_violation': 'hos_violation',
    'hosViolation': 'hos_violation',
    'speeding': 'speeding',
    'hard_brake': 'hard_brake',
    'hardBrake': 'hard_brake',
    'hard_accel': 'hard_accel',
    'hardAccel': 'hard_accel',
    'device_malfunction': 'device_malfunction',
    'deviceMalfunction': 'device_malfunction'
  }
  return typeMap[type?.toLowerCase()] || 'other'
}

function mapSamsaraSafetyEventType(type: string): string {
  const normalized = type?.toLowerCase()
  if (normalized.includes("speed")) return "speeding"
  if (normalized.includes("brake")) return "harsh_brake"
  if (normalized.includes("accel")) return "hard_accel"
  return "other"
}

function mapGeotabStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'driving': 'driving',
    'on_duty': 'on_duty',
    'off_duty': 'off_duty',
    'sleeper': 'sleeper_berth',
    'sleeper_berth': 'sleeper_berth',
    'onDuty': 'on_duty',
    'offDuty': 'off_duty',
    'sleeperBerth': 'sleeper_berth'
  }
  return statusMap[status?.toLowerCase()] || 'on_duty'
}

function mapGeotabEventType(type: string): string {
  const typeMap: Record<string, string> = {
    'hos_violation': 'hos_violation',
    'hosViolation': 'hos_violation',
    'speeding': 'speeding',
    'hard_brake': 'hard_brake',
    'hardBrake': 'hard_brake',
    'hard_accel': 'hard_accel',
    'hardAccel': 'hard_accel',
    'device_malfunction': 'device_malfunction',
    'deviceMalfunction': 'device_malfunction'
  }
  return typeMap[type?.toLowerCase()] || 'other'
}

function calculateDuration(start: string, end: string): number | null {
  if (!start || !end) return null
  try {
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    return Math.round((endTime - startTime) / (1000 * 60)) // minutes
  } catch {
    return null
  }
}

// Main sync function - syncs a single device
export async function syncELDDevice(deviceId: string) {
  const deviceResult = await getELDDevice(deviceId)
  
  if (deviceResult.error || !deviceResult.data) {
    return { error: deviceResult.error || "Device not found", data: null }
  }

  const device = deviceResult.data
  // Prevent unbounded `eld_locations` growth by only inserting provider data
  // newer than the last successful sync (with a small safety buffer).
  const safetyBufferMs = 5 * 60 * 1000 // 5 minutes
  const lastSyncAt = device.last_sync_at || device.lastSyncAt
  const sinceMs = lastSyncAt
    ? Math.max(0, new Date(lastSyncAt).getTime() - safetyBufferMs)
    : Date.now() - 24 * 60 * 60 * 1000 // fallback: last 24 hours

  switch (device.provider) {
    case 'keeptruckin':
      return await syncKeepTruckinData(device, sinceMs)
    case 'samsara':
      return await syncSamsaraData(device, sinceMs)
    case 'geotab':
      return await syncGeotabData(device, sinceMs)
    default:
      return { error: `Provider ${device.provider} not yet supported`, data: null }
  }
}

// Sync all active devices for a company
export async function syncAllELDDevices() {
  const devicesResult = await getELDDevices()
  
  if (devicesResult.error || !devicesResult.data) {
    return { error: devicesResult.error || "Failed to get devices", data: null }
  }

  const activeDevices = devicesResult.data.filter((d: EldDeviceSyncRow) => d.status === "active")
  const results = []

  for (const device of activeDevices) {
    const result = await syncELDDevice(device.id)
    results.push({
      device_id: device.id,
      device_name: device.device_name,
      ...result
    })
  }

  return {
    data: {
      synced: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results
    },
    error: null
  }
}

