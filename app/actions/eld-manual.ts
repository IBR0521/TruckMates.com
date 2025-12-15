"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Manually create ELD log entry
export async function createELDLog(formData: {
  eld_device_id: string
  driver_id?: string
  truck_id?: string
  log_date: string
  log_type: string
  start_time: string
  end_time?: string
  duration_minutes?: number
  location_start?: { lat: number; lng: number; address?: string }
  location_end?: { lat: number; lng: number; address?: string }
  odometer_start?: number
  odometer_end?: number
  miles_driven?: number
  engine_hours?: number
  violations?: any
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can create ELD logs", data: null }
  }

  // Calculate duration if not provided
  let duration = formData.duration_minutes
  if (!duration && formData.start_time && formData.end_time) {
    const start = new Date(formData.start_time).getTime()
    const end = new Date(formData.end_time).getTime()
    duration = Math.round((end - start) / (1000 * 60))
  }

  // Calculate miles if not provided
  let miles = formData.miles_driven
  if (!miles && formData.odometer_start && formData.odometer_end) {
    miles = formData.odometer_end - formData.odometer_start
  }

  const { data, error } = await supabase
    .from("eld_logs")
    .insert({
      company_id: userData.company_id,
      eld_device_id: formData.eld_device_id,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      log_date: formData.log_date,
      log_type: formData.log_type,
      start_time: formData.start_time,
      end_time: formData.end_time || null,
      duration_minutes: duration || null,
      location_start: formData.location_start || null,
      location_end: formData.location_end || null,
      odometer_start: formData.odometer_start || null,
      odometer_end: formData.odometer_end || null,
      miles_driven: miles || null,
      engine_hours: formData.engine_hours || null,
      violations: formData.violations || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld/logs")
  return { data, error: null }
}

// Manually create ELD location entry
export async function createELDLocation(formData: {
  eld_device_id: string
  driver_id?: string
  truck_id?: string
  timestamp: string
  latitude: number
  longitude: number
  address?: string
  speed?: number
  heading?: number
  odometer?: number
  engine_status?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can create ELD locations", data: null }
  }

  const { data, error } = await supabase
    .from("eld_locations")
    .insert({
      company_id: userData.company_id,
      eld_device_id: formData.eld_device_id,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      timestamp: formData.timestamp,
      latitude: formData.latitude,
      longitude: formData.longitude,
      address: formData.address || null,
      speed: formData.speed || null,
      heading: formData.heading || null,
      odometer: formData.odometer || null,
      engine_status: formData.engine_status || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  return { data, error: null }
}

// Manually create ELD event/violation
export async function createELDEvent(formData: {
  eld_device_id: string
  driver_id?: string
  truck_id?: string
  event_type: string
  severity?: string
  title: string
  description?: string
  event_time: string
  location?: { lat: number; lng: number; address?: string }
  metadata?: any
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can create ELD events", data: null }
  }

  const { data, error } = await supabase
    .from("eld_events")
    .insert({
      company_id: userData.company_id,
      eld_device_id: formData.eld_device_id,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      event_type: formData.event_type,
      severity: formData.severity || "warning",
      title: formData.title,
      description: formData.description || null,
      event_time: formData.event_time,
      location: formData.location || null,
      resolved: false,
      metadata: formData.metadata || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld/violations")
  return { data, error: null }
}
