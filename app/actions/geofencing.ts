"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { validateRequiredString, sanitizeString } from "@/lib/validation"

/**
 * Check if a point is inside a geofence
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
    let inside = false
    for (let i = 0, j = geofence.polygon_coordinates.length - 1; i < geofence.polygon_coordinates.length; j = i++) {
      const xi = geofence.polygon_coordinates[i].lat || geofence.polygon_coordinates[i].latitude
      const yi = geofence.polygon_coordinates[i].lng || geofence.polygon_coordinates[i].longitude
      const xj = geofence.polygon_coordinates[j].lat || geofence.polygon_coordinates[j].latitude
      const yj = geofence.polygon_coordinates[j].lng || geofence.polygon_coordinates[j].longitude

      const intersect =
        yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  try {
    let query = supabase
      .from("geofences")
      .select("*")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active)
    }

    const { data: geofences, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    // Filter by truck_id if provided
    let filteredGeofences = geofences || []
    if (filters?.truck_id) {
      filteredGeofences = filteredGeofences.filter(
        (g) => !g.assigned_trucks || g.assigned_trucks.includes(filters.truck_id!)
      )
    }

    if (filters?.route_id) {
      filteredGeofences = filteredGeofences.filter(
        (g) => !g.assigned_routes || g.assigned_routes.includes(filters.route_id!)
      )
    }

    return { data: filteredGeofences, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofences", data: null }
  }
}

/**
 * Get single geofence
 */
export async function getGeofence(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data: geofence, error } = await supabase
      .from("geofences")
      .select("*")
      .eq("id", id)
      .eq("company_id", company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
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
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
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
        company_id,
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
}>) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

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

    const { data: geofence, error } = await supabase
      .from("geofences")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", company_id)
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
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { error } = await supabase
      .from("geofences")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id)

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get truck info
    const { data: truck } = await supabase
      .from("trucks")
      .select("id, driver_id, company_id")
      .eq("id", truckId)
      .eq("company_id", company_id)
      .single()

    if (!truck) {
      return { error: "Truck not found", data: null }
    }

    // Get active geofences
    const { data: geofences } = await supabase
      .from("geofences")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true)

    if (!geofences || geofences.length === 0) {
      return { data: { events: [] }, error: null }
    }

    const events: any[] = []

    for (const geofence of geofences) {
      // Check if truck is assigned to this geofence (if assignments exist)
      if (geofence.assigned_trucks && geofence.assigned_trucks.length > 0) {
        if (!geofence.assigned_trucks.includes(truckId)) {
          continue
        }
      }

      const isInside = isPointInGeofence(latitude, longitude, geofence)

      // Check for recent visit to determine entry/exit
      const { data: recentVisit } = await supabase
        .from("zone_visits")
        .select("*")
        .eq("geofence_id", geofence.id)
        .eq("truck_id", truckId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single()

      const wasInside = recentVisit?.event_type === "entry" && !recentVisit.exit_timestamp

      if (isInside && !wasInside) {
        // Entry event
        const { data: visit } = await supabase
          .from("zone_visits")
          .insert({
            company_id,
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
            company_id,
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

        // Update entry visit with exit info
        if (recentVisit) {
          await supabase
            .from("zone_visits")
            .update({
              exit_timestamp: timestamp || new Date().toISOString(),
              duration_minutes: duration,
            })
            .eq("id", recentVisit.id)
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
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
      .eq("company_id", company_id)
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
 * Get geofencing statistics
 */
export async function getGeofencingStats(filters?: {
  geofence_id?: string
  truck_id?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let visitsQuery = supabase
      .from("zone_visits")
      .select("id, event_type, duration_minutes, geofence_id, truck_id")
      .eq("company_id", company_id)

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
      .eq("company_id", company_id)
      .eq("is_active", true)

    const stats = {
      total_geofences: geofences?.length || 0,
      total_visits: visits?.length || 0,
      entries: visits?.filter((v) => v.event_type === "entry").length || 0,
      exits: visits?.filter((v) => v.event_type === "exit").length || 0,
      avg_duration_minutes:
        visits?.filter((v) => v.duration_minutes && v.duration_minutes > 0).length > 0
          ? Math.round(
              visits
                .filter((v) => v.duration_minutes && v.duration_minutes > 0)
                .reduce((sum, v) => sum + (v.duration_minutes || 0), 0) /
                visits.filter((v) => v.duration_minutes && v.duration_minutes > 0).length
            )
          : null,
    }

    return { data: stats, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get geofencing stats", data: null }
  }
}

