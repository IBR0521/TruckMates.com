import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMobileAuthContext } from "@/lib/auth/mobile"

type StateCrossingCacheEntry = {
  lat: number
  lng: number
  ts: number
  state_code?: string
}

// Throttle repeated state-crossing checks for stationary devices.
// This reduces the chance of unnecessary reverse-geocoding calls.
const stateCrossingCache = new Map<string, StateCrossingCacheEntry>()
const STATE_CROSSING_MIN_INTERVAL_MS = 90_000 // 1.5 minutes
const STATE_CROSSING_MIN_MOVEMENT_METERS = 300 // ~0.3 km

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000 // meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Receive GPS location updates from mobile app
 * POST /api/eld/mobile/locations
 * 
 * Body:
 * {
 *   device_id: string (ELD device ID from register endpoint)
 *   locations: Array<{
 *     timestamp: string (ISO timestamp)
 *     latitude: number
 *     longitude: number
 *     address?: string
 *     speed?: number (MPH)
 *     heading?: number (0-360 degrees)
 *     odometer?: number
 *     engine_status?: 'on' | 'off' | 'idle'
 *     driver_id?: string (optional)
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, error: authError } = await getMobileAuthContext(request)
    
    if (authError || !companyId) {
      return NextResponse.json(
        { error: authError || "Not authenticated" },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { device_id, locations } = body

    // Validate input
    if (!device_id || !locations || !Array.isArray(locations)) {
      return NextResponse.json(
        { error: "device_id and locations array are required" },
        { status: 400 }
      )
    }

    if (locations.length === 0) {
      return NextResponse.json(
        { error: "locations array cannot be empty" },
        { status: 400 }
      )
    }

    // Verify device belongs to user's company
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, truck_id, company_id")
      .eq("id", device_id)
      .eq("company_id", companyId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found or access denied" },
        { status: 404 }
      )
    }

    // Transform and validate locations
    const locationsToInsert = locations
      .filter((loc: any) => loc.latitude && loc.longitude) // Filter invalid locations
      .map((loc: any) => ({
        company_id: companyId,
        eld_device_id: device_id,
        driver_id: loc.driver_id || null,
        truck_id: device.truck_id || loc.truck_id || null,
        timestamp: loc.timestamp || new Date().toISOString(),
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        address: loc.address || null,
        speed: loc.speed ? Number(loc.speed) : null,
        heading: loc.heading ? Number(loc.heading) : null,
        odometer: loc.odometer ? Number(loc.odometer) : null,
        engine_status: loc.engine_status || "unknown",
      }))

    if (locationsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid locations to insert" },
        { status: 400 }
      )
    }

    // Batch insert locations (limit batch size to avoid timeout)
    const BATCH_SIZE = 100
    let insertedCount = 0

    for (let i = 0; i < locationsToInsert.length; i += BATCH_SIZE) {
      const batch = locationsToInsert.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from("eld_locations")
        .insert(batch)

      if (insertError) {
        console.error("Error inserting location batch:", insertError)
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }
      insertedCount += batch.length
    }

    // Check geofences for the latest location (backend engine via RPC; fallback to legacy action)
    if (device.truck_id && locationsToInsert.length > 0) {
      try {
        const latestLocation = locationsToInsert[locationsToInsert.length - 1]
        const { data: geofenceResult, error: rpcError } = await supabase.rpc("process_geofence_point", {
          company_id_param: companyId,
          truck_id_param: device.truck_id,
          driver_id_param: latestLocation.driver_id,
          point_lat: latestLocation.latitude,
          point_lng: latestLocation.longitude,
          point_ts: latestLocation.timestamp,
          point_speed: latestLocation.speed,
          point_heading: latestLocation.heading,
        })

        if (rpcError) {
          const { checkGeofenceEntry } = await import("@/app/actions/geofencing")
          await checkGeofenceEntry(
            device.truck_id,
            latestLocation.latitude,
            latestLocation.longitude,
            latestLocation.timestamp
          )
        } else {
          // Alerts-only v1: write in-app alerts for entry/exit/dwell events (deduped)
          const events = (geofenceResult as any)?.events
          if (Array.isArray(events) && events.length > 0) {
            const geofenceIds = Array.from(
              new Set(
                events
                  .map((e: any) => e?.geofence_id)
                  .filter((id: any) => typeof id === "string" && id.length > 0)
              )
            )

            const geofenceNameById = new Map<string, string>()
            if (geofenceIds.length > 0) {
              const { data: geofenceRows } = await supabase
                .from("geofences")
                .select("id, name")
                .eq("company_id", companyId)
                .in("id", geofenceIds)
              for (const g of geofenceRows || []) {
                if (g?.id) geofenceNameById.set(g.id, g.name || "Zone")
              }
            }

            const DEDUPE_MINUTES = 10
            const dedupeSince = new Date(Date.now() - DEDUPE_MINUTES * 60 * 1000).toISOString()

            for (const e of events) {
              const type = String(e?.type || "").toLowerCase()
              if (!["entry", "exit", "dwell"].includes(type)) continue

              const geofenceId = String(e?.geofence_id || "")
              if (!geofenceId) continue

              const zoneName = geofenceNameById.get(geofenceId) || "Zone"
              const eventType = `geofence_${type}`

              const durationMinutes =
                typeof e?.duration_minutes === "number"
                  ? e.duration_minutes
                  : e?.duration_minutes
                    ? Number(e.duration_minutes)
                    : null

              const title =
                type === "entry"
                  ? `Entered zone: ${zoneName}`
                  : type === "exit"
                    ? `Exited zone: ${zoneName}`
                    : `Dwell time reached: ${zoneName}`

              const message =
                type === "entry"
                  ? `Truck entered "${zoneName}".`
                  : type === "exit"
                    ? `Truck exited "${zoneName}"${durationMinutes ? ` after ${durationMinutes} minutes.` : "."}`
                    : `Truck has remained in "${zoneName}"${durationMinutes ? ` for ${durationMinutes} minutes.` : "."}`

              // Deduplicate: same truck + zone + event_type within window
              const { data: existing } = await supabase
                .from("alerts")
                .select("id")
                .eq("company_id", companyId)
                .eq("truck_id", device.truck_id)
                .eq("event_type", eventType)
                .eq("status", "active")
                .eq("metadata->>geofence_id", geofenceId)
                .gte("created_at", dedupeSince)
                .limit(1)

              if (existing && existing.length > 0) continue

              await supabase.from("alerts").insert({
                company_id: companyId,
                title,
                message,
                event_type: eventType,
                priority: "normal",
                status: "active",
                truck_id: device.truck_id,
                driver_id: latestLocation.driver_id || null,
                metadata: {
                  geofence_id: geofenceId,
                  geofence_name: zoneName,
                  latitude: latestLocation.latitude,
                  longitude: latestLocation.longitude,
                  timestamp: latestLocation.timestamp,
                  duration_minutes: durationMinutes,
                },
              })
            }
          }
        }
      } catch (geofenceError) {
        // Don't fail the request if geofence check fails
        console.error("Geofence check error (non-blocking):", geofenceError)
      }
    }

    // Detect idle time for the latest location
    if (device.truck_id && locationsToInsert.length > 0) {
      try {
        const latestLocation = locationsToInsert[locationsToInsert.length - 1]
        const { detectIdleTime } = await import("@/app/actions/idle-time-tracking")
        await detectIdleTime(
          device.truck_id,
          latestLocation.latitude,
          latestLocation.longitude,
          latestLocation.timestamp,
          latestLocation.speed || 0,
          latestLocation.engine_status || 'unknown',
          latestLocation.driver_id || undefined
        )
      } catch (idleError) {
        // Don't fail the request if idle detection fails
        console.error("Idle time detection error (non-blocking):", idleError)
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device_id)

    // Update actual route for active routes (non-blocking)
    let activeRouteId: string | null = null
    let activeLoadId: string | null = null
    
    if (device.truck_id) {
      try {
        const { data: activeRoute } = await supabase
          .from("routes")
          .select("id, load_id")
          .eq("truck_id", device.truck_id)
          .in("status", ["in_progress", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (activeRoute) {
          activeRouteId = activeRoute.id
          activeLoadId = activeRoute.load_id || null
          
          // Periodically rebuild actual route (every 10 location updates)
          const { buildActualRoute } = await import("@/app/actions/actual-route-tracking")
          // Only rebuild occasionally to avoid performance issues
          if (Math.random() < 0.1) { // 10% chance per location update
            buildActualRoute(activeRoute.id).catch(err => 
              console.error("Failed to update actual route:", err)
            )
          }
        }
      } catch (error) {
        // Don't fail location sync if route update fails
        console.error("Route update error (non-blocking):", error)
      }
    }

    // Detect state crossings for the latest location (non-blocking)
    // Only check for state crossing on the latest location to avoid API rate limits
    if (locationsToInsert.length > 0) {
      try {
        const latestLocation = locationsToInsert[locationsToInsert.length - 1]
        const { detectStateCrossing } = await import("@/app/actions/ifta-state-crossing")
        
        // Throttle checks when the device is essentially stationary.
        // We still rely on the backend engine for correctness, but we reduce how often we call it.
        const truckId = device.truck_id
        const cacheKey = `${companyId}:${truckId}`
        const cached = stateCrossingCache.get(cacheKey)
        const movedMeters = cached
          ? haversineDistanceMeters(cached.lat, cached.lng, latestLocation.latitude, latestLocation.longitude)
          : Number.POSITIVE_INFINITY
        const ageMs = cached ? Date.now() - cached.ts : Number.POSITIVE_INFINITY

        if (cached && ageMs < STATE_CROSSING_MIN_INTERVAL_MS && movedMeters < STATE_CROSSING_MIN_MOVEMENT_METERS) {
          // Skip state crossing detection for this update.
          // Next updates will still be checked after the throttle interval or movement.
        } else {
          const res = await detectStateCrossing({
            company_id: companyId,
            truck_id: device.truck_id,
            driver_id: latestLocation.driver_id,
            eld_device_id: device_id,
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            timestamp: latestLocation.timestamp,
            route_id: activeRouteId,
            load_id: activeLoadId,
            speed: latestLocation.speed,
            odometer: latestLocation.odometer,
            address: latestLocation.address,
          })

          // Cache last known point/state for throttling.
          if (!res?.error && (res as any)?.data?.state_code) {
            stateCrossingCache.set(cacheKey, {
              lat: latestLocation.latitude,
              lng: latestLocation.longitude,
              ts: Date.now(),
              state_code: (res as any).data.state_code,
            })
          } else {
            stateCrossingCache.set(cacheKey, {
              lat: latestLocation.latitude,
              lng: latestLocation.longitude,
              ts: Date.now(),
            })
          }
        }
      } catch (stateError) {
        // Don't fail the request if state crossing detection fails
        console.error("State crossing detection error (non-blocking):", stateError)
      }
    }

    return NextResponse.json({
      success: true,
      inserted: insertedCount,
      message: `Successfully inserted ${insertedCount} location(s)`,
    })
  } catch (error: unknown) {
    console.error("Location sync error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

