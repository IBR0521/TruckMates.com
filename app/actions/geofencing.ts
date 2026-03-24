"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { validateRequiredString, sanitizeString } from "@/lib/validation"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

/** `public.geofences` — geofencing_schema.sql + PostGIS columns from postgis_migration.sql */
const GEOFENCE_FULL_SELECT =
  "id, company_id, name, description, zone_type, center_latitude, center_longitude, radius_meters, polygon_coordinates, north_bound, south_bound, east_bound, west_bound, is_active, alert_on_entry, alert_on_exit, alert_on_dwell, dwell_time_minutes, assigned_trucks, assigned_routes, address, city, state, zip_code, created_at, updated_at, center_geography, polygon_geography"

/** `public.zone_visits` — supabase/geofencing_schema.sql */
const ZONE_VISITS_SELECT =
  "id, company_id, geofence_id, truck_id, driver_id, route_id, event_type, latitude, longitude, timestamp, entry_timestamp, exit_timestamp, duration_minutes, speed, heading, created_at"

/**
 * Check if a point is inside a geofence using PostGIS (database-level)
 * Falls back to client-side calculation if PostGIS function fails
 */
async function isPointInGeofencePostGIS(
  supabase: any,
  lat: number,
  lng: number,
  geofenceId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_point_in_geofence', {
      point_lat: lat,
      point_lng: lng,
      geofence_id: geofenceId
    })
    
    if (error) {
      console.warn('PostGIS function failed, using fallback:', error)
      return false
    }
    
    return data === true
  } catch (error) {
    console.warn('PostGIS function error, using fallback:', error)
    return false
  }
}

/**
 * Check if a point is inside a geofence (client-side fallback)
 * Used when PostGIS is not available or as fallback
 */
function isPointInGeofence(
  lat: number,
  lng: number,
  geofence: {
    zone_type: string
    center_latitude?: number
    center_longitude?: number
    radius_meters?: number
    polygon_coordinates?: any
    north_bound?: number
    south_bound?: number
    east_bound?: number
    west_bound?: number
  }
): boolean {
  if (geofence.zone_type === "circle") {
    if (!geofence.center_latitude || !geofence.center_longitude || !geofence.radius_meters) {
      return false
    }
    // Calculate distance using Haversine formula
    const R = 6371000 // Earth radius in meters
    const dLat = ((lat - geofence.center_latitude) * Math.PI) / 180
    const dLon = ((lng - geofence.center_longitude) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((geofence.center_latitude * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    return distance <= geofence.radius_meters
  } else if (geofence.zone_type === "rectangle") {
    if (
      !geofence.north_bound ||
      !geofence.south_bound ||
      !geofence.east_bound ||
      !geofence.west_bound
    ) {
      return false
    }
    return (
      lat >= geofence.south_bound &&
      lat <= geofence.north_bound &&
      lng >= geofence.west_bound &&
      lng <= geofence.east_bound
    )
  } else if (geofence.zone_type === "polygon") {
    if (!geofence.polygon_coordinates || !Array.isArray(geofence.polygon_coordinates)) {
      return false
    }
    // Ray casting algorithm for point in polygon
    // Correct axes: x = longitude, y = latitude
    let inside = false
    for (let i = 0, j = geofence.polygon_coordinates.length - 1; i < geofence.polygon_coordinates.length; j = i++) {
      // Handle both {lat, lng} and [lat, lng] formats
      const coordI = geofence.polygon_coordinates[i]
      const coordJ = geofence.polygon_coordinates[j]
      
      const xi = (typeof coordI === 'object' && 'lng' in coordI) ? coordI.lng : (Array.isArray(coordI) ? coordI[1] : coordI.longitude)
      const yi = (typeof coordI === 'object' && 'lat' in coordI) ? coordI.lat : (Array.isArray(coordI) ? coordI[0] : coordI.latitude)
      const xj = (typeof coordJ === 'object' && 'lng' in coordJ) ? coordJ.lng : (Array.isArray(coordJ) ? coordJ[1] : coordJ.longitude)
      const yj = (typeof coordJ === 'object' && 'lat' in coordJ) ? coordJ.lat : (Array.isArray(coordJ) ? coordJ[0] : coordJ.latitude)

      // Ray casting: x = longitude, y = latitude
      const intersect =
        yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }
  return false
}

/**
 * Get all geofences
 */
export async function getGeofences(filters?: {
  is_active?: boolean
  truck_id?: string
  route_id?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("geofences")
      .select(GEOFENCE_FULL_SELECT)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active)
    }

    // Use database-level JSONB contains operator for array filtering (more efficient)
    if (filters?.truck_id) {
      // Filter: assigned_trucks is null OR assigned_trucks contains truck_id
      query = query.or(`assigned_trucks.is.null,assigned_trucks.cs.{${filters.truck_id}}`)
    }

    if (filters?.route_id) {
      // Filter: assigned_routes is null OR assigned_routes contains route_id
      query = query.or(`assigned_routes.is.null,assigned_routes.cs.{${filters.route_id}}`)
    }

    const { data: geofences, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: geofences || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofences", data: null }
  }
}

/**
 * Get single geofence
 */
export async function getGeofence(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: geofence, error } = await supabase
      .from("geofences")
      .select(GEOFENCE_FULL_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }
    if (!geofence) {
      return { error: "Geofence not found", data: null }
    }

    return { data: geofence, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofence", data: null }
  }
}

/**
 * Create geofence
 */
export async function createGeofence(formData: {
  name: string
  description?: string
  zone_type: string
  center_latitude?: number
  center_longitude?: number
  radius_meters?: number
  polygon_coordinates?: Array<{ lat: number; lng: number }>
  north_bound?: number
  south_bound?: number
  east_bound?: number
  west_bound?: number
  is_active?: boolean
  alert_on_entry?: boolean
  alert_on_exit?: boolean
  alert_on_dwell?: boolean
  dwell_time_minutes?: number
  assigned_trucks?: string[]
  assigned_routes?: string[]
  address?: string
  city?: string
  state?: string
  zip_code?: string
  auto_update_load_status?: boolean
  entry_load_status?: string
  exit_load_status?: string
}) {
  // Check permission
  const permission = await checkCreatePermission("fleet_map" as any)
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create geofences", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Validation
  if (!validateRequiredString(formData.name, 1, 200)) {
    return { error: "Name is required and must be between 1 and 200 characters", data: null }
  }

  if (!formData.zone_type || !["circle", "polygon", "rectangle"].includes(formData.zone_type)) {
    return { error: "Invalid zone type", data: null }
  }

  // Validate zone-specific data
  if (formData.zone_type === "circle") {
    if (!formData.center_latitude || !formData.center_longitude || !formData.radius_meters) {
      return { error: "Circle zone requires center coordinates and radius", data: null }
    }
  } else if (formData.zone_type === "rectangle") {
    if (
      !formData.north_bound ||
      !formData.south_bound ||
      !formData.east_bound ||
      !formData.west_bound
    ) {
      return { error: "Rectangle zone requires all boundary coordinates", data: null }
    }
  } else if (formData.zone_type === "polygon") {
    if (!formData.polygon_coordinates || formData.polygon_coordinates.length < 3) {
      return { error: "Polygon zone requires at least 3 coordinates", data: null }
    }
  }

  try {
    const { data: geofence, error } = await supabase
      .from("geofences")
      .insert({
        company_id: ctx.companyId,
        name: sanitizeString(formData.name, 200),
        description: formData.description ? sanitizeString(formData.description, 1000) : null,
        zone_type: formData.zone_type,
        center_latitude: formData.center_latitude || null,
        center_longitude: formData.center_longitude || null,
        radius_meters: formData.radius_meters || null,
        polygon_coordinates: formData.polygon_coordinates || null,
        north_bound: formData.north_bound || null,
        south_bound: formData.south_bound || null,
        east_bound: formData.east_bound || null,
        west_bound: formData.west_bound || null,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
        alert_on_entry: formData.alert_on_entry !== undefined ? formData.alert_on_entry : true,
        alert_on_exit: formData.alert_on_exit !== undefined ? formData.alert_on_exit : true,
        alert_on_dwell: formData.alert_on_dwell || false,
        dwell_time_minutes: formData.dwell_time_minutes || null,
        assigned_trucks: formData.assigned_trucks && formData.assigned_trucks.length > 0 ? formData.assigned_trucks : null,
        assigned_routes: formData.assigned_routes && formData.assigned_routes.length > 0 ? formData.assigned_routes : null,
        auto_update_load_status: formData.auto_update_load_status || false,
        entry_load_status: formData.entry_load_status || null,
        exit_load_status: formData.exit_load_status || null,
        address: formData.address ? sanitizeString(formData.address, 500) : null,
        city: formData.city ? sanitizeString(formData.city, 100) : null,
        state: formData.state ? sanitizeString(formData.state, 50) : null,
        zip_code: formData.zip_code ? sanitizeString(formData.zip_code, 20) : null,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/geofencing")
    return { data: geofence, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to create geofence", data: null }
  }
}

/**
 * Update geofence
 */
export async function updateGeofence(id: string, formData: Partial<{
  name: string
  description: string
  is_active: boolean
  alert_on_entry: boolean
  alert_on_exit: boolean
  alert_on_dwell: boolean
  dwell_time_minutes: number
  assigned_trucks: string[]
  assigned_routes: string[]
  address: string
  city: string
  state: string
  zip_code: string
  auto_update_load_status?: boolean
  entry_load_status?: string
  exit_load_status?: string
}>) {
  // Check permission
  const permission = await checkEditPermission("fleet_map" as any)
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit geofences", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // LOW FIX: Sanitize geofence name to prevent stored XSS
    if (formData.name !== undefined) {
      updateData.name = sanitizeString(formData.name, 200)
    }
    if (formData.description !== undefined) {
      updateData.description = formData.description ? sanitizeString(formData.description, 1000) : null
    }
    if (formData.is_active !== undefined) {
      updateData.is_active = formData.is_active
    }
    if (formData.alert_on_entry !== undefined) {
      updateData.alert_on_entry = formData.alert_on_entry
    }
    if (formData.alert_on_exit !== undefined) {
      updateData.alert_on_exit = formData.alert_on_exit
    }
    if (formData.alert_on_dwell !== undefined) {
      updateData.alert_on_dwell = formData.alert_on_dwell
    }
    if (formData.dwell_time_minutes !== undefined) {
      updateData.dwell_time_minutes = formData.dwell_time_minutes || null
    }
    if (formData.assigned_trucks !== undefined) {
      updateData.assigned_trucks = formData.assigned_trucks && formData.assigned_trucks.length > 0 ? formData.assigned_trucks : null
    }
    if (formData.assigned_routes !== undefined) {
      updateData.assigned_routes = formData.assigned_routes && formData.assigned_routes.length > 0 ? formData.assigned_routes : null
    }
    if (formData.address !== undefined) {
      updateData.address = formData.address ? sanitizeString(formData.address, 500) : null
    }
    if (formData.city !== undefined) {
      updateData.city = formData.city ? sanitizeString(formData.city, 100) : null
    }
    if (formData.state !== undefined) {
      updateData.state = formData.state ? sanitizeString(formData.state, 50) : null
    }
    if (formData.zip_code !== undefined) {
      updateData.zip_code = formData.zip_code ? sanitizeString(formData.zip_code, 20) : null
    }
    if (formData.auto_update_load_status !== undefined) {
      updateData.auto_update_load_status = formData.auto_update_load_status
    }
    if (formData.entry_load_status !== undefined) {
      updateData.entry_load_status = formData.entry_load_status || null
    }
    if (formData.exit_load_status !== undefined) {
      updateData.exit_load_status = formData.exit_load_status || null
    }

    const { data: geofence, error } = await supabase
      .from("geofences")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/geofencing")
    revalidatePath(`/dashboard/geofencing/${id}`)
    return { data: geofence, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update geofence", data: null }
  }
}

/**
 * Delete geofence
 */
export async function deleteGeofence(id: string) {
  // Check permission
  const permission = await checkDeletePermission("fleet_map" as any)
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete geofences", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // LOW FIX: Cascade cleanup - delete zone_visits before deleting geofence
    // This prevents orphaned records
    await supabase
      .from("zone_visits")
      .delete()
      .eq("geofence_id", id)
      .eq("company_id", ctx.companyId)
    
    const { error } = await supabase
      .from("geofences")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/geofencing")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to delete geofence", data: null }
  }
}

/**
 * Check vehicle location against geofences and create visit records
 * This should be called periodically (e.g., from a cron job or real-time location updates)
 */
export async function checkGeofenceEntry(truckId: string, latitude: number, longitude: number, timestamp?: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get truck info
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, driver_id, company_id")
      .eq("id", truckId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (truckError) {
      return { error: truckError.message, data: null }
    }

    if (!truck) {
      return { error: "Truck not found", data: null }
    }

    // MEDIUM FIX: Filter geofences by assigned_trucks at database level to avoid full table scan
    // Use JSONB contains operator for efficient filtering
    let geofenceQuery = supabase
      .from("geofences")
      .select(GEOFENCE_FULL_SELECT)
      .eq("company_id", ctx.companyId)
      .eq("is_active", true)
    
    // Filter by assigned_trucks if geofence has assignments
    // Use .or() to include geofences with no assignments OR geofences assigned to this truck
    geofenceQuery = geofenceQuery.or(`assigned_trucks.is.null,assigned_trucks.cs.{${truckId}}`)
    
    const { data: geofences } = await geofenceQuery

    if (!geofences || geofences.length === 0) {
      return { data: { events: [] }, error: null }
    }

    const events: any[] = []

    // Batch fetch all recent visits for this truck across all geofences
    const geofenceIds = geofences.map((g: { id: string; [key: string]: any }) => g.id)
    const { data: allRecentVisits } = await supabase
      .from("zone_visits")
      .select(ZONE_VISITS_SELECT)
      .eq("truck_id", truckId)
      .in("geofence_id", geofenceIds)
      .order("timestamp", { ascending: false })

    // Group visits by geofence_id (get most recent per geofence)
    const visitsByGeofence = new Map<string, any>()
    if (allRecentVisits) {
      allRecentVisits.forEach((visit: { geofence_id: string; [key: string]: any }) => {
        if (!visitsByGeofence.has(visit.geofence_id)) {
          visitsByGeofence.set(visit.geofence_id, visit)
        }
      })
    }

    for (const geofence of geofences) {
      // Check if truck is assigned to this geofence (if assignments exist)
      if (geofence.assigned_trucks && geofence.assigned_trucks.length > 0) {
        if (!geofence.assigned_trucks.includes(truckId)) {
          continue
        }
      }

      // Try PostGIS first, fallback to client-side calculation
      let isInside = false
      try {
        isInside = await isPointInGeofencePostGIS(supabase, latitude, longitude, geofence.id)
      } catch (error) {
        // Fallback to client-side calculation
        isInside = isPointInGeofence(latitude, longitude, geofence)
      }

      // Get recent visit from batched data
      const recentVisit = visitsByGeofence.get(geofence.id)

      const wasInside = recentVisit?.event_type === "entry" && !recentVisit.exit_timestamp

      if (isInside && !wasInside) {
        // Entry event
        const { data: visit } = await supabase
          .from("zone_visits")
          .insert({
            company_id: ctx.companyId,
            geofence_id: geofence.id,
            truck_id: truckId,
            driver_id: truck.driver_id || null,
            event_type: "entry",
            latitude,
            longitude,
            timestamp: timestamp || new Date().toISOString(),
            entry_timestamp: timestamp || new Date().toISOString(),
          })
          .select()
          .single()

        if (visit && geofence.alert_on_entry) {
          // Create alert
          const { createAlert } = await import("./alerts")
          await createAlert({
            title: `Vehicle Entered Zone: ${geofence.name}`,
            message: `Truck entered geofence zone "${geofence.name}"`,
            event_type: "geofence_entry",
            priority: "normal",
            truck_id: truckId,
            driver_id: truck.driver_id || null,
            metadata: {
              geofence_id: geofence.id,
              geofence_name: geofence.name,
              latitude,
              longitude,
            },
          })
        }

        events.push({ type: "entry", geofence_id: geofence.id, visit })
        
        // Auto-update load status if enabled
        if (visit && geofence.auto_update_load_status && geofence.entry_load_status) {
          try {
            const { autoUpdateLoadStatusFromGeofence } = await import("./auto-status-updates")
            await autoUpdateLoadStatusFromGeofence(visit.id, 'entry')
          } catch (error) {
            console.error("Failed to auto-update load status on entry:", error)
          }
        }
      } else if (!isInside && wasInside) {
        // Exit event
        const duration = recentVisit?.entry_timestamp
          ? Math.round(
              (new Date(timestamp || new Date()).getTime() - new Date(recentVisit.entry_timestamp).getTime()) /
                60000
            )
          : null

        const { data: visit } = await supabase
          .from("zone_visits")
          .insert({
            company_id: ctx.companyId,
            geofence_id: geofence.id,
            truck_id: truckId,
            driver_id: truck.driver_id || null,
            event_type: "exit",
            latitude,
            longitude,
            timestamp: timestamp || new Date().toISOString(),
            exit_timestamp: timestamp || new Date().toISOString(),
            entry_timestamp: recentVisit?.entry_timestamp || null,
            duration_minutes: duration,
          })
          .select()
          .single()

        // MEDIUM FIX: Update entry visit with exit info - verify ownership before update
        if (recentVisit) {
          // Verify the visit belongs to this company before updating
          const { data: visitCheck, error: visitCheckError } = await supabase
            .from("zone_visits")
            .select("id, company_id")
            .eq("id", recentVisit.id)
            .eq("company_id", ctx.companyId)
            .maybeSingle()

          if (visitCheckError) {
            return { error: visitCheckError.message, data: null }
          }
          
          if (visitCheck) {
            await supabase
              .from("zone_visits")
              .update({
                exit_timestamp: timestamp || new Date().toISOString(),
                duration_minutes: duration,
              })
              .eq("id", recentVisit.id)
              .eq("company_id", ctx.companyId) // Additional safety check
          }
        }

        if (visit && geofence.alert_on_exit) {
          // Create alert
          const { createAlert } = await import("./alerts")
          await createAlert({
            title: `Vehicle Exited Zone: ${geofence.name}`,
            message: `Truck exited geofence zone "${geofence.name}"${duration ? ` after ${duration} minutes` : ""}`,
            event_type: "geofence_exit",
            priority: "normal",
            truck_id: truckId,
            driver_id: truck.driver_id || null,
            metadata: {
              geofence_id: geofence.id,
              geofence_name: geofence.name,
              latitude,
              longitude,
              duration_minutes: duration,
            },
          })
        }

        events.push({ type: "exit", geofence_id: geofence.id, visit })
        
        // Auto-update load status if enabled
        if (visit && geofence.auto_update_load_status && geofence.exit_load_status) {
          try {
            const { autoUpdateLoadStatusFromGeofence } = await import("./auto-status-updates")
            await autoUpdateLoadStatusFromGeofence(visit.id, 'exit')
          } catch (error) {
            console.error("Failed to auto-update load status on exit:", error)
          }
        }
        
        // Finalize detention if detention tracking is enabled
        if (geofence.detention_enabled && visit) {
          try {
            const { finalizeDetention } = await import("./detention-tracking")
            await finalizeDetention(visit.id)
          } catch (error) {
            console.error("Failed to finalize detention on exit:", error)
          }
        }
      }
    }

    return { data: { events }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to check geofence entry", data: null }
  }
}

/**
 * Get zone visits
 */
export async function getZoneVisits(filters?: {
  geofence_id?: string
  truck_id?: string
  driver_id?: string
  event_type?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("zone_visits")
      .select(`
        *,
        geofences:geofence_id (id, name),
        trucks:truck_id (id, truck_number),
        drivers:driver_id (id, name)
      `, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("timestamp", { ascending: false })

    if (filters?.geofence_id) {
      query = query.eq("geofence_id", filters.geofence_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.event_type) {
      query = query.eq("event_type", filters.event_type)
    }
    if (filters?.start_date) {
      query = query.gte("timestamp", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("timestamp", filters.end_date)
    }

    const limit = Math.min(filters?.limit || 50, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: visits, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: visits || [], error: null, count: count || 0 }
  } catch (error: any) {
    return { error: error.message || "Failed to get zone visits", data: null, count: 0 }
  }
}

/**
 * Get current geofence "inside/outside" states.
 * This is populated by the backend engine (public.process_geofence_point).
 */
export async function getGeofenceStates(filters?: {
  geofence_id?: string
  truck_id?: string
  is_inside?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null, count: 0 }
  }

  try {
    let query = supabase
      .from("geofence_states")
      .select(
        `
        *,
        geofences:geofence_id (id, name, zone_type),
        trucks:truck_id (id, truck_number),
        drivers:driver_id (id, name)
      `,
        { count: "exact" }
      )
      .eq("company_id", ctx.companyId)
      .order("last_seen_at", { ascending: false })

    if (filters?.geofence_id) query = query.eq("geofence_id", filters.geofence_id)
    if (filters?.truck_id) query = query.eq("truck_id", filters.truck_id)
    if (filters?.is_inside !== undefined) query = query.eq("is_inside", filters.is_inside)

    const limit = Math.min(filters?.limit || 50, 200)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return { error: error.message, data: null, count: 0 }

    return { data: data || [], error: null, count: count || 0 }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofence states", data: null, count: 0 }
  }
}

/**
 * Get geofencing statistics
 */
export async function getGeofencingStats(filters?: {
  geofence_id?: string
  truck_id?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let visitsQuery = supabase
      .from("zone_visits")
      .select("id, event_type, duration_minutes, geofence_id, truck_id")
      .eq("company_id", ctx.companyId)

    if (filters?.geofence_id) {
      visitsQuery = visitsQuery.eq("geofence_id", filters.geofence_id)
    }
    if (filters?.truck_id) {
      visitsQuery = visitsQuery.eq("truck_id", filters.truck_id)
    }
    if (filters?.start_date) {
      visitsQuery = visitsQuery.gte("timestamp", filters.start_date)
    }
    if (filters?.end_date) {
      visitsQuery = visitsQuery.lte("timestamp", filters.end_date)
    }

    const { data: visits } = await visitsQuery

    const { data: geofences } = await supabase
      .from("geofences")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("is_active", true)

    const stats = {
      total_geofences: geofences?.length || 0,
      total_visits: visits?.length || 0,
      entries: visits?.filter((v: { event_type: string; [key: string]: any }) => v.event_type === "entry").length || 0,
      exits: visits?.filter((v: { event_type: string; [key: string]: any }) => v.event_type === "exit").length || 0,
      avg_duration_minutes:
        visits?.filter((v: { duration_minutes: number | null; [key: string]: any }) => v.duration_minutes && v.duration_minutes > 0).length > 0
          ? Math.round(
              visits
                .filter((v: { duration_minutes: number | null; [key: string]: any }) => v.duration_minutes && v.duration_minutes > 0)
                .reduce((sum: number, v: { duration_minutes: number | null; [key: string]: any }) => sum + (v.duration_minutes || 0), 0) /
                visits.filter((v: { duration_minutes: number | null; [key: string]: any }) => v.duration_minutes && v.duration_minutes > 0).length
            )
          : null,
    }

    return { data: stats, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofencing stats", data: null }
  }
}




