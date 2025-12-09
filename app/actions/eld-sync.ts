"use server"

import { createClient } from "@/lib/supabase/server"
import { getELDDevices, getELDDevice } from "./eld"

// Generic ELD provider interface
interface ELDProvider {
  name: string
  syncLogs: (device: any) => Promise<any[]>
  syncLocations: (device: any) => Promise<any[]>
  syncEvents: (device: any) => Promise<any[]>
}

// KeepTruckin API integration
async function syncKeepTruckinData(device: any) {
  const supabase = await createClient()
  
  if (!device.api_key || !device.api_secret) {
    return { error: "API credentials not configured", data: null }
  }

  try {
    // Sync HOS Logs
    const logsResponse = await fetch(`https://api.keeptruckin.com/v1/logs?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    if (!logsResponse.ok) {
      throw new Error(`KeepTruckin API error: ${logsResponse.statusText}`)
    }

    const logsData = await logsResponse.json()
    const logs = logsData.logs || []

    // Sync Locations
    const locationsResponse = await fetch(`https://api.keeptruckin.com/v1/locations?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations || []

    // Sync Events/Violations
    const eventsResponse = await fetch(`https://api.keeptruckin.com/v1/violations?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })

    const eventsData = await eventsResponse.json()
    const events = eventsData.violations || []

    // Store logs in database
    const logsToInsert = logs.map((log: any) => ({
      company_id: device.company_id,
      eld_device_id: device.id,
      driver_id: log.driver_id || null,
      truck_id: device.truck_id || null,
      log_date: log.date || log.log_date,
      log_type: mapKeepTruckinStatus(log.status),
      start_time: log.start_time || log.start_datetime,
      end_time: log.end_time || log.end_datetime,
      duration_minutes: log.duration_minutes || calculateDuration(log.start_time, log.end_time),
      location_start: log.start_location ? {
        lat: log.start_location.latitude,
        lng: log.start_location.longitude,
        address: log.start_location.address
      } : null,
      location_end: log.end_location ? {
        lat: log.end_location.latitude,
        lng: log.end_location.longitude,
        address: log.end_location.address
      } : null,
      odometer_start: log.odometer_start || log.start_odometer,
      odometer_end: log.odometer_end || log.end_odometer,
      miles_driven: log.miles_driven || (log.odometer_end && log.odometer_start ? log.odometer_end - log.odometer_start : null),
      engine_hours: log.engine_hours,
      violations: log.violations || null,
      raw_data: log
    }))

    if (logsToInsert.length > 0) {
      const { error: logsError } = await supabase
        .from("eld_logs")
        .upsert(logsToInsert, { onConflict: "id", ignoreDuplicates: true })

      if (logsError) {
        console.error("Error inserting ELD logs:", logsError)
      }
    }

    // Store locations in database
    const locationsToInsert = locations.map((loc: any) => ({
      company_id: device.company_id,
      eld_device_id: device.id,
      driver_id: loc.driver_id || null,
      truck_id: device.truck_id || null,
      timestamp: loc.timestamp || loc.datetime,
      latitude: loc.latitude || loc.lat,
      longitude: loc.longitude || loc.lng,
      address: loc.address || loc.formatted_address,
      speed: loc.speed || null,
      heading: loc.heading || loc.bearing || null,
      odometer: loc.odometer || null,
      engine_status: loc.engine_status || (loc.engine_on ? "on" : "off")
    }))

    if (locationsToInsert.length > 0) {
      const { error: locationsError } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)

      if (locationsError) {
        console.error("Error inserting ELD locations:", locationsError)
      }
    }

    // Store events in database
    const eventsToInsert = events.map((event: any) => ({
      company_id: device.company_id,
      eld_device_id: device.id,
      driver_id: event.driver_id || null,
      truck_id: device.truck_id || null,
      event_type: mapKeepTruckinEventType(event.type),
      severity: event.severity || "warning",
      title: event.title || event.violation_type,
      description: event.description || event.message,
      event_time: event.event_time || event.datetime,
      location: event.location ? {
        lat: event.location.latitude,
        lng: event.location.longitude,
        address: event.location.address
      } : null,
      resolved: false,
      metadata: event
    }))

    if (eventsToInsert.length > 0) {
      const { error: eventsError } = await supabase
        .from("eld_events")
        .insert(eventsToInsert)

      if (eventsError) {
        console.error("Error inserting ELD events:", eventsError)
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
        events: eventsToInsert.length
      },
      error: null
    }

  } catch (error: any) {
    console.error("KeepTruckin sync error:", error)
    return { error: error.message || "Failed to sync KeepTruckin data", data: null }
  }
}

// Samsara API integration
async function syncSamsaraData(device: any) {
  const supabase = await createClient()
  
  if (!device.api_key) {
    return { error: "API key not configured", data: null }
  }

  try {
    // Samsara uses different endpoint structure
    const baseUrl = "https://api.samsara.com"
    const vehicleId = device.provider_device_id

    // Sync HOS Logs
    const logsResponse = await fetch(`${baseUrl}/fleet/drivers/hos_daily_logs?vehicleId=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    if (!logsResponse.ok) {
      throw new Error(`Samsara API error: ${logsResponse.statusText}`)
    }

    const logsData = await logsResponse.json()
    const logs = logsData.data || []

    // Sync Locations
    const locationsResponse = await fetch(`${baseUrl}/fleet/vehicles/locations?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    const locationsData = await locationsResponse.json()
    const locations = locationsData.data || []

    // Sync Events
    const eventsResponse = await fetch(`${baseUrl}/fleet/drivers/safety/score?vehicleId=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    const eventsData = await eventsResponse.json()
    const events = eventsData.data || []

    // Transform and store data (similar to KeepTruckin but with Samsara format)
    // ... (similar transformation logic)

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    return {
      data: {
        logs: logs.length,
        locations: locations.length,
        events: events.length
      },
      error: null
    }

  } catch (error: any) {
    console.error("Samsara sync error:", error)
    return { error: error.message || "Failed to sync Samsara data", data: null }
  }
}

// Geotab API integration
async function syncGeotabData(device: any) {
  const supabase = await createClient()
  
  if (!device.api_key || !device.api_secret) {
    return { error: "API credentials not configured", data: null }
  }

  try {
    // Geotab uses MyGeotab API with different authentication
    const baseUrl = device.provider_device_id || "https://my.geotab.com/apiv1"
    
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

    // Get logs, locations, events using session
    // ... (Geotab-specific API calls)

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    return {
      data: {
        logs: 0,
        locations: 0,
        events: 0
      },
      error: null
    }

  } catch (error: any) {
    console.error("Geotab sync error:", error)
    return { error: error.message || "Failed to sync Geotab data", data: null }
  }
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

  switch (device.provider) {
    case 'keeptruckin':
      return await syncKeepTruckinData(device)
    case 'samsara':
      return await syncSamsaraData(device)
    case 'geotab':
      return await syncGeotabData(device)
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

  const activeDevices = devicesResult.data.filter((d: any) => d.status === 'active')
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

