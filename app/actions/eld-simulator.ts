"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/server"

/**
 * Fake ELD Device Simulator
 * Simulates a real ELD device sending location, logs, and events
 */

interface SimulatorConfig {
  device_id: string
  truck_id?: string
  driver_id?: string
  route_id?: string
  speed?: number // MPH
  update_interval?: number // seconds
  simulate_route?: boolean
  origin?: { lat: number; lng: number }
  destination?: { lat: number; lng: number }
}

/**
 * Create a fake ELD device for testing
 */
export async function createFakeELDDevice(config: {
  device_name: string
  truck_id?: string
  company_id?: string
}) {
  const supabase = await createClient()
  const { companyId, error: authError } = await getAuthContext()
  
  if (authError || !companyId) {
    return { error: authError || "Not authenticated", data: null }
  }

  const deviceSerial = `FAKE-${Date.now()}-${Math.random().toString(36).substring(7)}`
  
  const deviceData = {
    company_id: config.company_id || companyId,
    device_name: config.device_name,
    device_serial_number: deviceSerial,
    provider: "truckmates_simulator",
    provider_device_id: deviceSerial,
    truck_id: config.truck_id || null,
    status: "active",
    firmware_version: "1.0.0-simulator",
    installation_date: new Date().toISOString().split("T")[0],
    notes: "Fake ELD device for testing",
    last_sync_at: new Date().toISOString(),
  }

  const { data: device, error } = await supabase
    .from("eld_devices")
    .insert(deviceData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: device, error: null }
}

/**
 * Simulate GPS location update
 */
export async function simulateLocationUpdate(config: SimulatorConfig) {
  const supabase = await createClient()
  const { companyId } = await getAuthContext()
  
  if (!companyId) {
    return { error: "Not authenticated", data: null }
  }

  // Get current location or generate new one
  const { data: lastLocation } = await supabase
    .from("eld_locations")
    .select("latitude, longitude, heading, odometer")
    .eq("eld_device_id", config.device_id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single()

  let lat: number
  let lng: number
  let heading: number
  let odometer: number

  if (lastLocation && config.simulate_route && config.origin && config.destination) {
    // Simulate movement along route
    const progress = Math.min(1, Math.random() * 0.1 + 0.9) // 90-100% progress
    lat = config.origin.lat + (config.destination.lat - config.origin.lat) * progress
    lng = config.origin.lng + (config.destination.lng - config.origin.lng) * progress
    heading = lastLocation.heading || Math.random() * 360
    odometer = (lastLocation.odometer || 0) + (config.speed || 60) * (config.update_interval || 30) / 3600 // miles
  } else {
    // Random location near last location or origin
    const baseLat = lastLocation?.latitude || config.origin?.lat || 40.7128
    const baseLng = lastLocation?.longitude || config.origin?.lng || -74.0060
    const offset = 0.01 // ~1km
    lat = baseLat + (Math.random() - 0.5) * offset
    lng = baseLng + (Math.random() - 0.5) * offset
    heading = lastLocation?.heading || Math.random() * 360
    odometer = (lastLocation?.odometer || 0) + (config.speed || 60) * (config.update_interval || 30) / 3600
  }

  const location = {
    company_id: companyId,
    eld_device_id: config.device_id,
    driver_id: config.driver_id || null,
    truck_id: config.truck_id || null,
    timestamp: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    speed: config.speed || Math.floor(Math.random() * 20 + 50), // 50-70 MPH
    heading: Math.floor(heading),
    odometer: Math.floor(odometer),
    engine_status: "on",
  }

  const { data, error } = await supabase
    .from("eld_locations")
    .insert(location)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

/**
 * Simulate HOS log entry
 */
export async function simulateHOSLog(config: {
  device_id: string
  driver_id?: string
  truck_id?: string
  log_type: "driving" | "on_duty" | "off_duty" | "sleeper_berth"
  duration_minutes?: number
}) {
  const supabase = await createClient()
  const { companyId } = await getAuthContext()
  
  if (!companyId) {
    return { error: "Not authenticated", data: null }
  }

  const now = new Date()
  const startTime = new Date(now.getTime() - (config.duration_minutes || 60) * 60 * 1000)

  const logData = {
    company_id: companyId,
    eld_device_id: config.device_id,
    driver_id: config.driver_id || null,
    truck_id: config.truck_id || null,
    log_date: now.toISOString().split("T")[0],
    log_type: config.log_type,
    start_time: startTime.toISOString(),
    end_time: now.toISOString(),
    duration_minutes: config.duration_minutes || 60,
    location_start: { lat: 40.7128, lng: -74.0060, address: "New York, NY" },
    location_end: { lat: 40.7580, lng: -73.9855, address: "New York, NY" },
    miles_driven: config.log_type === "driving" ? (config.duration_minutes || 60) / 60 * 60 : 0, // Assume 60 MPH
    engine_hours: config.log_type === "driving" ? (config.duration_minutes || 60) / 60 : 0,
  }

  const { data, error } = await supabase
    .from("eld_logs")
    .insert(logData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

/**
 * Simulate ELD event/violation
 */
export async function simulateELDEvent(config: {
  device_id: string
  driver_id?: string
  truck_id?: string
  event_type: "hos_violation" | "speeding" | "hard_brake" | "hard_accel" | "device_malfunction" | "other"
  severity?: "info" | "warning" | "critical"
  title?: string
  description?: string
}) {
  const supabase = await createClient()
  const { companyId } = await getAuthContext()
  
  if (!companyId) {
    return { error: "Not authenticated", data: null }
  }

  const eventTitles: Record<string, string> = {
    hos_violation: "HOS Violation Detected",
    speeding: "Speeding Alert",
    hard_brake: "Hard Braking Event",
    hard_accel: "Hard Acceleration Event",
    device_malfunction: "Device Malfunction",
    other: "ELD Event",
  }

  const eventDescriptions: Record<string, string> = {
    hos_violation: "Driver exceeded maximum driving hours",
    speeding: "Vehicle speed exceeded posted limit",
    hard_brake: "Hard braking detected (deceleration > 0.5g)",
    hard_accel: "Hard acceleration detected (acceleration > 0.5g)",
    device_malfunction: "ELD device reporting malfunction",
    other: "General ELD event",
  }

  const eventData = {
    company_id: companyId,
    eld_device_id: config.device_id,
    driver_id: config.driver_id || null,
    truck_id: config.truck_id || null,
    event_type: config.event_type,
    severity: config.severity || (config.event_type === "hos_violation" ? "critical" : "warning"),
    title: config.title || eventTitles[config.event_type] || "ELD Event",
    description: config.description || eventDescriptions[config.event_type] || "",
    event_time: new Date().toISOString(),
    location: { lat: 40.7128, lng: -74.0060, address: "New York, NY" },
    resolved: false,
    metadata: { simulated: true },
  }

  const { data, error } = await supabase
    .from("eld_events")
    .insert(eventData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

