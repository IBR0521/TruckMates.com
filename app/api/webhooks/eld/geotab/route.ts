import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Geotab Webhook Endpoint
 * Receives real-time HOS logs, locations, and events from Geotab ELD devices
 * Geotab uses a different webhook format (DataChange events)
 */

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const supabase = await createClient()
    
    // Geotab webhooks include entityType and entity
    const entityType = data.entityType || data.type
    
    // Get device by provider_device_id (Geotab uses device serial)
    const deviceId = data.entity?.device?.id || data.deviceId
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, company_id, truck_id, provider_device_id")
      .eq("provider", "geotab")
      .eq("provider_device_id", deviceId)
      .single()
    
    if (deviceError || !device) {
      console.error("[Geotab Webhook] Device not found:", deviceId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }
    
    // Process Geotab entity type
    switch (entityType) {
      case "LogRecord":
      case "hos_log":
        await processHOSLog(data, device, supabase)
        break
        
      case "StatusData":
      case "gps_location":
        await processLocation(data, device, supabase)
        break
        
      case "ExceptionEvent":
      case "hos_violation":
        await processViolation(data, device, supabase)
        break
        
      default:
        console.log(`[Geotab Webhook] Unhandled entity type: ${entityType}`)
    }
    
    return NextResponse.json({ success: true, processed: entityType })
  } catch (error: any) {
    console.error("[Geotab Webhook] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

async function processHOSLog(data: any, device: any, supabase: any) {
  const logData = data.entity || data
  
  const log = {
    driver_id: logData.driver?.id || logData.driverId,
    log_type: mapGeotabStatus(logData.dutyStatus || logData.status),
    start_time: logData.dateTime || logData.startTime,
    end_time: logData.endDateTime || logData.endTime || null,
    location_start: logData.startLocation
      ? {
          latitude: logData.startLocation.latitude,
          longitude: logData.startLocation.longitude,
        }
      : null,
    location_end: logData.endLocation
      ? {
          latitude: logData.endLocation.latitude,
          longitude: logData.endLocation.longitude,
        }
      : null,
    odometer_start: logData.startOdometer || logData.odometerStart,
    odometer_end: logData.endOdometer || logData.odometerEnd,
    location_address: logData.location || logData.locationName,
    certified: logData.certified || false,
  }
  
  // Insert into eld_logs
  const { error } = await supabase.from("eld_logs").insert({
    company_id: device.company_id,
    driver_id: log.driver_id,
    truck_id: device.truck_id,
    eld_device_id: device.id,
    log_type: log.log_type,
    start_time: log.start_time,
    end_time: log.end_time,
    location_start: log.location_start,
    location_end: log.location_end,
    odometer_start: log.odometer_start,
    odometer_end: log.odometer_end,
    location_address: log.location_address,
    certified: log.certified,
  })
  
  if (error) {
    console.error("[Geotab Webhook] Error inserting log:", error)
  }
}

async function processLocation(data: any, device: any, supabase: any) {
  const locationData = data.entity || data
  
  const location = {
    truck_id: device.truck_id,
    latitude: locationData.latitude || locationData.lat,
    longitude: locationData.longitude || locationData.lng,
    speed: locationData.speed || null,
    heading: locationData.heading || locationData.bearing || null,
    timestamp: locationData.dateTime || locationData.timestamp || new Date().toISOString(),
  }
  
  // Insert into eld_locations
  const { error } = await supabase.from("eld_locations").insert({
    company_id: device.company_id,
    truck_id: location.truck_id,
    eld_device_id: device.id,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed,
    heading: location.heading,
    timestamp: location.timestamp,
  })
  
  if (error) {
    console.error("[Geotab Webhook] Error inserting location:", error)
  }
}

async function processViolation(data: any, device: any, supabase: any) {
  const violationData = data.entity || data
  
  const event = {
    company_id: device.company_id,
    truck_id: device.truck_id,
    eld_device_id: device.id,
    driver_id: violationData.driver?.id || violationData.driverId,
    event_type: "hos_violation",
    severity: violationData.severity || "critical",
    title: violationData.exceptionType || violationData.violation_type || "HOS Violation",
    description: violationData.description || violationData.message,
    event_time: violationData.dateTime || violationData.timestamp || new Date().toISOString(),
    resolved: false,
  }
  
  // Insert into eld_events
  const { error } = await supabase.from("eld_events").insert(event)
  
  if (error) {
    console.error("[Geotab Webhook] Error inserting violation:", error)
  }
}

function mapGeotabStatus(status: string): string {
  const statusMap: Record<string, string> = {
    driving: "driving",
    on_duty: "on_duty",
    off_duty: "off_duty",
    sleeper: "sleeper_berth",
    sleeper_berth: "sleeper_berth",
  }
  
  return statusMap[status?.toLowerCase()] || "off_duty"
}



