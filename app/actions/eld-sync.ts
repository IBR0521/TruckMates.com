"use server"

import { createClient } from "@/lib/supabase/server"
import { getELDDevices, getELDDevice } from "./eld"
import { mapProviderDriverId } from "./eld-driver-mapping"

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
    // Use Motive API (formerly KeepTruckin) - updated domain
    // Fallback to old domain for backward compatibility
    const apiBaseUrl = "https://api.gomotive.com/v1"
    const fallbackUrl = "https://api.keeptruckin.com/v1"
    
    // Sync HOS Logs
    let logsResponse = await fetch(`${apiBaseUrl}/logs?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!logsResponse.ok && logsResponse.status === 404) {
      logsResponse = await fetch(`${fallbackUrl}/logs?device_id=${device.provider_device_id}`, {
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

    const logsData = await logsResponse.json()
    const logs = logsData.logs || []

    // Sync Locations
    let locationsResponse = await fetch(`${apiBaseUrl}/locations?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!locationsResponse.ok && locationsResponse.status === 404) {
      locationsResponse = await fetch(`${fallbackUrl}/locations?device_id=${device.provider_device_id}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations || []

    // Sync Events/Violations
    let eventsResponse = await fetch(`${apiBaseUrl}/violations?device_id=${device.provider_device_id}`, {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret,
        'Content-Type': 'application/json'
      }
    })
    
    // Fallback to old domain if new one fails
    if (!eventsResponse.ok && eventsResponse.status === 404) {
      eventsResponse = await fetch(`${fallbackUrl}/violations?device_id=${device.provider_device_id}`, {
        headers: {
          'X-Api-Key': device.api_key,
          'X-Api-Secret': device.api_secret,
          'Content-Type': 'application/json'
        }
      })
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.violations || []

    // Store logs in database
    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueProviderDriverIds = [...new Set(
      logs
        .map((log: any) => log.driver_id || log.driverId)
        .filter((id: any) => id !== null && id !== undefined)
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
    mappings?.forEach((m: any) => {
      driverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Map provider driver IDs to internal driver IDs
    const logsToInsert = logs.map((log: any) => {
      const providerDriverId = log.driver_id || log.driverId || null
      const internalDriverId = providerDriverId
        ? driverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
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
        console.error("Error inserting ELD logs:", logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // Store locations in database
    // Reuse driver mapping for locations
    const locationsToInsert = locations.map((loc: any) => {
      const providerDriverId = loc.driver_id || loc.driverId || null
      const internalDriverId = providerDriverId
        ? driverIdMap.get(String(providerDriverId)) || null
        : null

      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: internalDriverId,
        truck_id: device.truck_id || null,
        timestamp: loc.timestamp || loc.datetime,
        latitude: loc.latitude || loc.lat,
        longitude: loc.longitude || loc.lng,
        address: loc.address || loc.formatted_address,
        speed: loc.speed || null,
        heading: loc.heading || loc.bearing || null,
        odometer: loc.odometer || null,
        engine_status: loc.engine_status || (loc.engine_on ? "on" : "off")
      }
    })

    if (locationsToInsert.length > 0) {
      const { error: locationsError } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)

      if (locationsError) {
        console.error("Error inserting ELD locations:", locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
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
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    // Collect any errors that occurred
    const errors: string[] = []
    if (logsToInsert.length > 0 && logsError) errors.push(`Logs: ${logsError.message}`)
    if (locationsToInsert.length > 0 && locationsError) errors.push(`Locations: ${locationsError.message}`)
    if (eventsToInsert.length > 0 && eventsError) errors.push(`Events: ${eventsError.message}`)

    return {
      data: {
        logs: logsToInsert.length,
        locations: locationsToInsert.length,
        events: eventsToInsert.length
      },
      errors: errors.length > 0 ? errors : undefined,
      error: errors.length > 0 ? "Partial sync failure" : null
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

    const logsData = await logsResponse.json()
    const logs = logsData.data || []

    // Sync Locations - Correct Samsara v2 API endpoint
    const locationsResponse = await fetch(`${baseUrl}/v2/fleet/vehicles/locations/feed?vehicleIds=${vehicleId}`, {
      headers: {
        'Authorization': `Bearer ${device.api_key}`,
        'Content-Type': 'application/json'
      }
    })

    const locationsData = await locationsResponse.json()
    const locations = locationsData.data || []

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

    const eventsData = await eventsResponse.json()
    const events = eventsData.data || []

    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueProviderDriverIds = [...new Set(
      logs
        .map((log: any) => log.driver_id || log.driverId)
        .filter((id: any) => id !== null && id !== undefined)
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
    mappings?.forEach((m: any) => {
      driverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store logs
    const logsToInsert = logs.map((log: any) => {
      const providerDriverId = log.driver_id || log.driverId || null
      const internalDriverId = providerDriverId
        ? driverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
      truck_id: device.truck_id || null,
      log_date: log.date || log.logDate || new Date().toISOString().split('T')[0],
      log_type: mapSamsaraStatus(log.status || log.dutyStatus),
      start_time: log.startTime || log.start_time || log.logStartTime,
      end_time: log.endTime || log.end_time || log.logEndTime,
      duration_minutes: log.durationMinutes || calculateDuration(log.startTime, log.endTime),
      location_start: log.startLocation ? {
        lat: log.startLocation.latitude || log.startLocation.lat,
        lng: log.startLocation.longitude || log.startLocation.lng,
        address: log.startLocation.address || log.startLocation.formattedAddress
      } : null,
      location_end: log.endLocation ? {
        lat: log.endLocation.latitude || log.endLocation.lat,
        lng: log.endLocation.longitude || log.endLocation.lng,
        address: log.endLocation.address || log.endLocation.formattedAddress
      } : null,
      odometer_start: log.startOdometer || log.odometerStart,
      odometer_end: log.endOdometer || log.odometerEnd,
      miles_driven: log.milesDriven || (log.endOdometer && log.startOdometer ? log.endOdometer - log.startOdometer : null),
      engine_hours: log.engineHours || null,
          violations: log.violations || null,
          raw_data: log
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
        console.error("Error inserting ELD logs:", logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // OPTIMIZATION: Batch fetch driver mappings for locations
    const uniqueLocationDriverIds = [...new Set(
      locations
        .map((loc: any) => loc.driverId || loc.driver_id)
        .filter((id: any) => id !== null && id !== undefined)
    )]
    
    const { data: locationMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueLocationDriverIds.map(String))
    
    const locationDriverIdMap = new Map<string, string>()
    locationMappings?.forEach((m: any) => {
      locationDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store locations
    const locationsToInsert = locations.map((loc: any) => {
      const providerDriverId = loc.driverId || loc.driver_id || null
      const internalDriverId = providerDriverId
        ? locationDriverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
      truck_id: device.truck_id || null,
      timestamp: loc.time || loc.timestamp || loc.datetime || new Date().toISOString(),
      latitude: loc.latitude || loc.lat,
      longitude: loc.longitude || loc.lng || loc.lon,
      address: loc.address || loc.formattedAddress || loc.name,
      speed: loc.speed || loc.speedMph || null,
      heading: loc.heading || loc.bearing || null,
      odometer: loc.odometer || loc.odometerMiles || null,
          engine_status: loc.engineState || (loc.engineOn ? "on" : "off") || "unknown"
        }
      })

    if (locationsToInsert.length > 0) {
      const { error: locationsError } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)

      if (locationsError) {
        console.error("Error inserting ELD locations:", locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
      }
    }

    // OPTIMIZATION: Batch fetch driver mappings for events
    const uniqueEventDriverIds = [...new Set(
      events
        .map((event: any) => event.driverId || event.driver_id)
        .filter((id: any) => id !== null && id !== undefined)
    )]
    
    const { data: eventMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "samsara")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueEventDriverIds.map(String))
    
    const eventDriverIdMap = new Map<string, string>()
    eventMappings?.forEach((m: any) => {
      eventDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store events
    const eventsToInsert = events.map((event: any) => {
      const providerDriverId = event.driverId || event.driver_id || null
      const internalDriverId = providerDriverId
        ? eventDriverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
          truck_id: device.truck_id || null,
          event_type: mapSamsaraEventType(event.type || event.eventType),
          severity: event.severity || event.priority || "warning",
          title: event.title || event.name || event.eventType || "Event",
          description: event.description || event.message || event.details,
          event_time: event.time || event.timestamp || event.eventTime || new Date().toISOString(),
          location: event.location ? {
            lat: event.location.latitude || event.location.lat,
            lng: event.location.longitude || event.location.lng,
            address: event.location.address || event.location.formattedAddress
          } : null,
          resolved: false,
          metadata: event
        }
      })

    if (eventsToInsert.length > 0) {
      const { error: eventsError } = await supabase
        .from("eld_events")
        .insert(eventsToInsert)

      if (eventsError) {
        console.error("Error inserting ELD events:", eventsError)
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
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
    // For now, check if there's an api_endpoint field, otherwise use default
    // provider_device_id is the device serial/ID, not the API endpoint
    let baseUrl = "https://my.geotab.com/apiv1" // Default Geotab server
    
    // If device has api_endpoint field, use it (future enhancement)
    // For now, always use default since provider_device_id is not the URL
    // TODO: Add api_endpoint column to eld_devices table for Geotab server URL
    
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

    const logsData = await logsResponse.json()
    const logs = logsData.result || []

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

    const locationsData = await locationsResponse.json()
    const locations = locationsData.result || []

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

    const eventsData = await eventsResponse.json()
    const events = eventsData.result || []

    // OPTIMIZATION: Batch fetch all driver mappings to avoid N+1 queries
    const uniqueGeotabDriverIds = [...new Set(
      logs
        .map((log: any) => log.driver?.id || log.driverId)
        .filter((id: any) => id !== null && id !== undefined)
    )]
    
    const { data: geotabMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "geotab")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueGeotabDriverIds.map(String))
    
    const geotabDriverIdMap = new Map<string, string>()
    geotabMappings?.forEach((m: any) => {
      geotabDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    // Transform and store Geotab data
    const logsToInsert = logs.map((log: any) => {
      const providerDriverId = log.driver?.id || log.driverId || null
      const internalDriverId = providerDriverId
        ? geotabDriverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
      truck_id: device.truck_id || null,
      log_date: log.date ? new Date(log.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      log_type: mapGeotabStatus(log.dutyStatus),
      start_time: log.startDateTime || log.date,
      end_time: log.endDateTime || log.date,
      // Geotab duration is in seconds, not milliseconds
      duration_minutes: log.duration ? Math.round(log.duration / 60) : null,
      location_start: log.startLocation ? {
        lat: log.startLocation.latitude,
        lng: log.startLocation.longitude,
        address: log.startLocation.address
      } : null,
      location_end: log.endLocation ? {
        lat: log.endLocation.latitude,
        lng: log.endLocation.longitude,
        address: log.endLocation.address
      } : null,
      odometer_start: log.startOdometer,
      odometer_end: log.endOdometer,
          miles_driven: log.distance ? log.distance * 0.000621371 : null, // Convert meters to miles
          engine_hours: log.engineHours || null,
          violations: log.violations || null,
          raw_data: log
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
        console.error("Error inserting ELD logs:", logsError)
        return { error: `Failed to sync logs: ${logsError.message}`, data: null }
      }
    }

    // Reuse driver mapping for locations if needed
    const uniqueGeotabLocationDriverIds = [...new Set(
      locations
        .map((loc: any) => loc.driver?.id || loc.driverId)
        .filter((id: any) => id !== null && id !== undefined)
    )]
    
    const { data: geotabLocationMappings } = await supabase
      .from("eld_driver_mappings")
      .select("provider_driver_id, internal_driver_id")
      .eq("eld_device_id", device.id)
      .eq("provider", "geotab")
      .eq("is_active", true)
      .in("provider_driver_id", uniqueGeotabLocationDriverIds.map(String))
    
    const geotabLocationDriverIdMap = new Map<string, string>()
    geotabLocationMappings?.forEach((m: any) => {
      geotabLocationDriverIdMap.set(String(m.provider_driver_id), m.internal_driver_id)
    })
    
    const locationsToInsert = locations.map((loc: any) => {
      const providerDriverId = loc.driver?.id || loc.driverId || null
      const internalDriverId = providerDriverId
        ? geotabLocationDriverIdMap.get(String(providerDriverId)) || null
        : null

        return {
          company_id: device.company_id,
          eld_device_id: device.id,
          driver_id: internalDriverId,
          truck_id: device.truck_id || null,
          timestamp: loc.dateTime || loc.date || new Date().toISOString(),
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address || null,
          speed: loc.speed ? Math.round(loc.speed * 2.23694) : null, // Convert m/s to mph
          heading: loc.heading || null,
          odometer: loc.odometer || null,
          engine_status: loc.engineStatus || "unknown"
        }
      })

    if (locationsToInsert.length > 0) {
      const { error: locationsError } = await supabase
        .from("eld_locations")
        .insert(locationsToInsert)

      if (locationsError) {
        console.error("Error inserting ELD locations:", locationsError)
        return { error: `Failed to sync locations: ${locationsError.message}`, data: null }
      }
    }

    const eventsToInsert = events.map((event: any) => {
      // Extract fault code information
      const faultCode = event.faultCode?.code || event.faultCode?.id || event.code || null
      const faultCodeCategory = determineFaultCodeCategory(event.faultCode?.name || event.faultCode?.code || event.title)
      const faultCodeDescription = event.faultCode?.description || event.description || null
      
      return {
        company_id: device.company_id,
        eld_device_id: device.id,
        driver_id: event.driver?.id || null,
        truck_id: device.truck_id || null,
        event_type: mapGeotabEventType(event.faultCode?.name),
        severity: event.severity || "warning",
        title: event.faultCode?.name || "Event",
        description: faultCodeDescription,
        event_time: event.dateTime || event.date || new Date().toISOString(),
        location: event.location ? {
          lat: event.location.latitude,
          lng: event.location.longitude,
          address: event.location.address
        } : null,
        resolved: false,
        fault_code: faultCode,
        fault_code_category: faultCodeCategory,
        fault_code_description: faultCodeDescription,
        metadata: event
      }
    })

    if (eventsToInsert.length > 0) {
      const { error: eventsError } = await supabase
        .from("eld_events")
        .insert(eventsToInsert)

      if (eventsError) {
        console.error("Error inserting ELD events:", eventsError)
        return { error: `Failed to sync events: ${eventsError.message}`, data: null }
      }
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id)

    // Collect any errors that occurred
    const errors: string[] = []
    if (logsToInsert.length > 0 && logsError) errors.push(`Logs: ${logsError.message}`)
    if (locationsToInsert.length > 0 && locationsError) errors.push(`Locations: ${locationsError.message}`)
    if (eventsToInsert.length > 0 && eventsError) errors.push(`Events: ${eventsError.message}`)

    return {
      data: {
        logs: logsToInsert.length,
        locations: locationsToInsert.length,
        events: eventsToInsert.length
      },
      errors: errors.length > 0 ? errors : undefined,
      error: errors.length > 0 ? "Partial sync failure" : null
    }

  } catch (error: any) {
    console.error("Geotab sync error:", error)
    return { error: error.message || "Failed to sync Geotab data", data: null }
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

