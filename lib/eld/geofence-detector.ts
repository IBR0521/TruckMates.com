/**
 * Telemetry-driven geofence enter/exit detection (Phase C-4).
 *
 * Accuracy: ELD points are often 1–2 minutes apart; a truck can traverse a small zone between samples
 * and generate no "inside" reading. Do not treat events as legally exact.
 */

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeDbError } from "@/lib/utils/error"
import { pointInsideGeofence, type GeofenceShape } from "@/lib/eld/geofence-geometry"
import {
  fetchActiveLoadForTruck,
  handleGeofenceEnter,
  handleGeofenceExit,
  type GeofenceRow,
  type GeofenceEventRow,
  type TruckLite,
} from "@/lib/eld/geofence-actions"

const MAX_POINTS = 5000
const MAX_GEOFENCES_WARN = 100
const DEBOUNCE_MS = 5 * 60 * 1000

type TelemetryRow = {
  truck_id: string
  driver_id: string | null
  recorded_at: string
  location_lat: number
  location_lng: number
}

type StateRow = {
  truck_id: string
  geofence_id: string
  entered_at: string
  last_seen_at: string
  enter_event_id: string | null
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function toGeofenceRow(row: Record<string, unknown>): GeofenceRow | null {
  const id = typeof row.id === "string" ? row.id : null
  const name = typeof row.name === "string" ? row.name : "Geofence"
  if (!id) return null
  const gType = typeof row.geofence_type === "string" ? row.geofence_type : "customer"
  const zType = typeof row.zone_type === "string" ? row.zone_type : "circle"
  const rel = row.related_customer_id == null ? null : String(row.related_customer_id)
  return {
    id,
    name,
    geofence_type: gType,
    zone_type: zType,
    related_customer_id: rel,
    auto_update_load_status: typeof row.auto_update_load_status === "boolean" ? row.auto_update_load_status : false,
    alert_on_entry: typeof row.alert_on_entry === "boolean" ? row.alert_on_entry : true,
    alert_on_exit: typeof row.alert_on_exit === "boolean" ? row.alert_on_exit : false,
    alert_on_dwell: typeof row.alert_on_dwell === "boolean" ? row.alert_on_dwell : false,
    detention_enabled: typeof row.detention_enabled === "boolean" ? row.detention_enabled : false,
    detention_threshold_minutes:
      typeof row.detention_threshold_minutes === "number" ? row.detention_threshold_minutes : 120,
  }
}

function geofenceShapeFromRow(
  row: GeofenceRow & Record<string, unknown>,
  defaultRadiusMeters?: number,
): GeofenceShape {
  const radius =
    row.radius_meters != null && Number(row.radius_meters) > 0
      ? Number(row.radius_meters)
      : defaultRadiusMeters
  return {
    zone_type: row.zone_type,
    center_latitude: row.center_latitude as number | null | undefined,
    center_longitude: row.center_longitude as number | null | undefined,
    radius_meters: radius,
    polygon_coordinates: row.polygon_coordinates as GeofenceShape["polygon_coordinates"],
    north_bound: row.north_bound as number | null | undefined,
    south_bound: row.south_bound as number | null | undefined,
    east_bound: row.east_bound as number | null | undefined,
    west_bound: row.west_bound as number | null | undefined,
  }
}

function truckAllowedOnGeofence(geofence: Record<string, unknown>, truckId: string): boolean {
  const raw = geofence.assigned_trucks
  if (raw == null) return true
  if (!Array.isArray(raw)) return true
  if (raw.length === 0) return true
  return raw.map(String).includes(truckId)
}

export async function processGeofenceTelemetryForCompany(companyId: string): Promise<{
  processedPoints: number
  error: string | null
}> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  try {
    const { data: companySettings } = await admin
      .from("company_settings")
      .select("geofence_enabled, track_driver_location, geofence_radius")
      .eq("company_id", companyId)
      .maybeSingle()

    if (companySettings?.track_driver_location === false) {
      return { processedPoints: 0, error: null }
    }
    if (companySettings?.geofence_enabled === false) {
      return { processedPoints: 0, error: null }
    }

    const defaultRadiusMeters =
      typeof companySettings?.geofence_radius === "number" && companySettings.geofence_radius > 0
        ? Math.round(companySettings.geofence_radius * 1609.34)
        : undefined

    const { data: cursorRow, error: curErr } = await admin
      .from("geofence_detection_cursors")
      .select("id, company_id, last_processed_telemetry_at, last_run_at, consecutive_failures")
      .eq("company_id", companyId)
      .maybeSingle()

    if (curErr) {
      return { processedPoints: 0, error: safeDbError(curErr) }
    }

    const cursor = cursorRow as Record<string, unknown> | null
    const lastRun = cursor?.last_run_at != null ? new Date(String(cursor.last_run_at)).getTime() : 0
    if (lastRun > 0 && Date.now() - lastRun < DEBOUNCE_MS) {
      return { processedPoints: 0, error: null }
    }

    const lastProcessed =
      cursor?.last_processed_telemetry_at != null
        ? String(cursor.last_processed_telemetry_at)
        : new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: gfRows, error: gfErr } = await admin
      .from("geofences")
      .select(
        "id, company_id, name, zone_type, geofence_type, center_latitude, center_longitude, radius_meters, polygon_coordinates, north_bound, south_bound, east_bound, west_bound, is_active, assigned_trucks, auto_update_load_status, alert_on_entry, alert_on_exit, alert_on_dwell, detention_enabled, detention_threshold_minutes, related_customer_id",
      )
      .eq("company_id", companyId)
      .eq("is_active", true)

    if (gfErr) {
      return { processedPoints: 0, error: safeDbError(gfErr) }
    }

    const geofenceRecords = ((gfRows ?? []) as unknown[]).map(asRecord)
    const geofences = geofenceRecords
      .map((r) => toGeofenceRow(r))
      .filter((g): g is GeofenceRow => g != null)
      .map((g) => {
        const full = geofenceRecords.find((r) => String(r.id) === g.id)
        return { ...g, ...(full ?? {}) } as GeofenceRow & Record<string, unknown>
      })

    if (geofences.length === 0) {
      await admin
        .from("geofence_detection_cursors")
        .upsert(
          {
            company_id: companyId,
            last_processed_telemetry_at: lastProcessed,
            last_run_at: nowIso,
            consecutive_failures: 0,
          },
          { onConflict: "company_id" },
        )
      return { processedPoints: 0, error: null }
    }

    if (geofences.length > MAX_GEOFENCES_WARN) {
      Sentry.captureMessage(`Geofence count high (${geofences.length}) for company ${companyId}`, { level: "warning" })
    }

    const { data: ptRows, error: ptErr } = await admin
      .from("eld_telemetry_points")
      .select("truck_id, driver_id, recorded_at, location_lat, location_lng")
      .eq("company_id", companyId)
      .gt("recorded_at", lastProcessed)
      .order("recorded_at", { ascending: true })
      .limit(MAX_POINTS)

    if (ptErr) {
      await admin
        .from("geofence_detection_cursors")
        .upsert(
          {
            company_id: companyId,
            last_processed_telemetry_at: lastProcessed,
            last_run_at: nowIso,
            consecutive_failures: (Number(cursor?.consecutive_failures) || 0) + 1,
          },
          { onConflict: "company_id" },
        )
      return { processedPoints: 0, error: safeDbError(ptErr) }
    }

    const points: TelemetryRow[] = (ptRows ?? [])
      .map(asRecord)
      .map((o) => ({
        truck_id: typeof o.truck_id === "string" ? o.truck_id : "",
        driver_id: o.driver_id == null ? null : String(o.driver_id),
        recorded_at: String(o.recorded_at ?? ""),
        location_lat: Number(o.location_lat),
        location_lng: Number(o.location_lng),
      }))
      .filter((p) => p.truck_id && p.recorded_at && Number.isFinite(p.location_lat) && Number.isFinite(p.location_lng))

    if (points.length === 0) {
      await admin
        .from("geofence_detection_cursors")
        .upsert(
          {
            company_id: companyId,
            last_processed_telemetry_at: lastProcessed,
            last_run_at: nowIso,
            consecutive_failures: 0,
          },
          { onConflict: "company_id" },
        )
      return { processedPoints: 0, error: null }
    }

    let maxTs = lastProcessed
    const truckIds = [...new Set(points.map((p) => p.truck_id))]

    const { data: stateRows } = await admin
      .from("truck_geofence_state")
      .select("truck_id, geofence_id, entered_at, last_seen_at, enter_event_id")
      .eq("company_id", companyId)
      .in("truck_id", truckIds)

    const stateMap = new Map<string, StateRow>()
    for (const s of (stateRows ?? []) as unknown[]) {
      const o = asRecord(s)
      const tid = typeof o.truck_id === "string" ? o.truck_id : ""
      const gid = typeof o.geofence_id === "string" ? o.geofence_id : ""
      if (!tid || !gid) continue
      stateMap.set(`${tid}:${gid}`, {
        truck_id: tid,
        geofence_id: gid,
        entered_at: String(o.entered_at ?? ""),
        last_seen_at: String(o.last_seen_at ?? ""),
        enter_event_id: o.enter_event_id == null ? null : String(o.enter_event_id),
      })
    }

    const { data: truckRows } = await admin.from("trucks").select("id, truck_number").eq("company_id", companyId).in("id", truckIds)
    const truckMap = new Map<string, TruckLite>()
    for (const t of (truckRows ?? []) as unknown[]) {
      const o = asRecord(t)
      const id = typeof o.id === "string" ? o.id : ""
      if (id) truckMap.set(id, { id, truck_number: typeof o.truck_number === "string" ? o.truck_number : null })
    }

    const byTruck = new Map<string, TelemetryRow[]>()
    for (const p of points) {
      const arr = byTruck.get(p.truck_id) ?? []
      arr.push(p)
      byTruck.set(p.truck_id, arr)
    }

    for (const [, pts] of byTruck) {
      pts.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    }

    for (const p of points) {
      if (p.recorded_at > maxTs) maxTs = p.recorded_at
    }

    for (const [truckId, pts] of byTruck) {
      const truckLite = truckMap.get(truckId) ?? { id: truckId, truck_number: null }
      const adminClient = admin

      for (const p of pts) {
        for (const g of geofences) {
          const full = g as GeofenceRow & Record<string, unknown>
          if (!truckAllowedOnGeofence(full, truckId)) continue

          const inside = pointInsideGeofence(p.location_lat, p.location_lng, geofenceShapeFromRow(full, defaultRadiusMeters))
          const key = `${truckId}:${g.id}`
          const st = stateMap.get(key)

          if (inside) {
            if (st) {
              await adminClient
                .from("truck_geofence_state")
                .update({ last_seen_at: p.recorded_at })
                .eq("company_id", companyId)
                .eq("truck_id", truckId)
                .eq("geofence_id", g.id)
              st.last_seen_at = p.recorded_at
              stateMap.set(key, st)
            } else {
              const activeLoad = await fetchActiveLoadForTruck(adminClient, companyId, truckId)
              const loadId = activeLoad?.id ? String(activeLoad.id) : null

              const { data: enterRow, error: enErr } = await adminClient
                .from("geofence_events")
                .insert({
                  company_id: companyId,
                  geofence_id: g.id,
                  truck_id: truckId,
                  driver_id: p.driver_id,
                  load_id: loadId,
                  event_type: "enter",
                  occurred_at: p.recorded_at,
                  location_lat: p.location_lat,
                  location_lng: p.location_lng,
                })
                .select("id, company_id, geofence_id, truck_id, driver_id, load_id, event_type, occurred_at, location_lat, location_lng")
                .maybeSingle()

              if (enErr || !enterRow) {
                Sentry.captureMessage(`geofence enter insert failed: ${safeDbError(enErr)}`, { level: "warning" })
                continue
              }

              const ev = asRecord(enterRow)
              const event: GeofenceEventRow = {
                id: String(ev.id ?? ""),
                company_id: companyId,
                geofence_id: g.id,
                truck_id: truckId,
                driver_id: p.driver_id,
                load_id: loadId,
                event_type: "enter",
                occurred_at: p.recorded_at,
                location_lat: p.location_lat,
                location_lng: p.location_lng,
              }

              const { error: stErr } = await adminClient.from("truck_geofence_state").insert({
                company_id: companyId,
                truck_id: truckId,
                geofence_id: g.id,
                entered_at: p.recorded_at,
                last_seen_at: p.recorded_at,
                enter_event_id: event.id,
              })
              if (stErr) {
                Sentry.captureMessage(`truck_geofence_state insert failed: ${safeDbError(stErr)}`, { level: "warning" })
                continue
              }

              stateMap.set(key, {
                truck_id: truckId,
                geofence_id: g.id,
                entered_at: p.recorded_at,
                last_seen_at: p.recorded_at,
                enter_event_id: event.id,
              })

              await handleGeofenceEnter({
                companyId,
                geofenceEvent: event,
                geofence: g,
                truck: truckLite,
                activeLoad: activeLoad,
              })
            }
          } else if (st) {
            const enterAt = new Date(st.entered_at).getTime()
            const exitAt = new Date(p.recorded_at).getTime()
            const dwellSeconds = Math.max(0, Math.round((exitAt - enterAt) / 1000))

            let exitLoadId: string | null = null
            if (st.enter_event_id) {
              const { data: enterEv } = await adminClient
                .from("geofence_events")
                .select("load_id")
                .eq("id", st.enter_event_id)
                .eq("company_id", companyId)
                .maybeSingle()
              const er = asRecord(enterEv ?? {})
              exitLoadId = typeof er.load_id === "string" ? er.load_id : null
            }

            const { data: exitRow, error: exErr } = await adminClient
              .from("geofence_events")
              .insert({
                company_id: companyId,
                geofence_id: g.id,
                truck_id: truckId,
                driver_id: p.driver_id,
                load_id: exitLoadId,
                event_type: "exit",
                occurred_at: p.recorded_at,
                location_lat: p.location_lat,
                location_lng: p.location_lng,
                paired_event_id: st.enter_event_id,
                dwell_seconds: dwellSeconds,
              })
              .select("id, company_id, geofence_id, truck_id, driver_id, load_id, event_type, occurred_at, location_lat, location_lng")
              .maybeSingle()

            if (exErr || !exitRow) {
              Sentry.captureMessage(`geofence exit insert failed: ${safeDbError(exErr)}`, { level: "warning" })
              continue
            }

            const ex = asRecord(exitRow)
            const exitEvent: GeofenceEventRow = {
              id: String(ex.id ?? ""),
              company_id: companyId,
              geofence_id: g.id,
              truck_id: truckId,
              driver_id: p.driver_id,
              load_id: exitLoadId,
              event_type: "exit",
              occurred_at: p.recorded_at,
              location_lat: p.location_lat,
              location_lng: p.location_lng,
            }

            await adminClient.from("truck_geofence_state").delete().eq("company_id", companyId).eq("truck_id", truckId).eq("geofence_id", g.id)
            stateMap.delete(key)

            await handleGeofenceExit({
              companyId,
              geofenceEvent: exitEvent,
              geofence: g,
              truck: truckLite,
              enterEventId: st.enter_event_id,
              dwellSeconds,
            })
          }
        }
      }
    }

    await admin.from("geofence_detection_cursors").upsert(
      {
        company_id: companyId,
        last_processed_telemetry_at: maxTs,
        last_run_at: nowIso,
        consecutive_failures: 0,
      },
      { onConflict: "company_id" },
    )

    return { processedPoints: points.length, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "geofence detection failed"
    Sentry.captureException(e)
    return { processedPoints: 0, error: msg }
  }
}
