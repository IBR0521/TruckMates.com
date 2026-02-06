import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

/**
 * Samsara Webhook Endpoint
 * Receives real-time HOS logs, locations, and events from Samsara ELD devices
 */

// Verify Samsara webhook signature
function verifySamsaraSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(body)
  const expectedSignature = `sha256=${hmac.digest("hex")}`
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-samsara-signature")
    
    // Get webhook secret from environment
    const webhookSecret = process.env.SAMSARA_WEBHOOK_SECRET || ""
    
    // Verify signature if secret is configured
    if (webhookSecret && !verifySamsaraSignature(body, signature, webhookSecret)) {
      console.error("[Samsara Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    
    const data = JSON.parse(body)
    const supabase = await createClient()
    
    // Samsara webhooks include vehicle_id
    const vehicleId = data.vehicle?.id || data.vehicle_id
    
    // Get device by provider_device_id (Samsara uses vehicle ID)
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, company_id, truck_id, provider_device_id")
      .eq("provider", "samsara")
      .eq("provider_device_id", vehicleId)
      .single()
    
    if (deviceError || !device) {
      console.error("[Samsara Webhook] Device not found:", vehicleId)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }
    
    // Process webhook event type
    const eventType = data.eventType || data.type || data.name
    
    switch (eventType) {
      case "hos_logs":
      case "hosLogs":
        await processHOSLogs(data, device, supabase)
        break
        
      case "gps_location":
      case "gpsLocation":
        await processLocation(data, device, supabase)
        break
        
      case "hos_violation":
      case "hosViolation":
        await processViolation(data, device, supabase)
        break
        
      default:
        console.log(`[Samsara Webhook] Unhandled event type: ${eventType}`)
    }
    
    return NextResponse.json({ success: true, processed: eventType })
  } catch (error: any) {
    console.error("[Samsara Webhook] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

async function processHOSLogs(data: any, device: any, supabase: any) {
  const logs = data.logs || data.hosLogs || [data]
  
  for (const logData of logs) {
    const log = {
      driver_id: logData.driver?.id || logData.driverId,
      log_type: mapSamsaraStatus(logData.dutyStatus || logData.status),
      start_time: logData.startTime || logData.start_time,
      end_time: logData.endTime || logData.end_time || null,
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
      odometer_start: logData.startOdometer || logData.odometer_start,
      odometer_end: logData.endOdometer || logData.odometer_end,
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
      console.error("[Samsara Webhook] Error inserting log:", error)
    }
  }
}

async function processLocation(data: any, device: any, supabase: any) {
  const location = data.location || data.gpsLocation || data
  
  const locationData = {
    truck_id: device.truck_id,
    latitude: location.latitude || location.lat,
    longitude: location.longitude || location.lng,
    speed: location.speed || null,
    heading: location.heading || location.bearing || null,
    timestamp: location.timestamp || location.time || new Date().toISOString(),
  }
  
  // Insert into eld_locations
  const { error } = await supabase.from("eld_locations").insert({
    company_id: device.company_id,
    truck_id: locationData.truck_id,
    eld_device_id: device.id,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    speed: locationData.speed,
    heading: locationData.heading,
    timestamp: locationData.timestamp,
  })
  
  if (error) {
    console.error("[Samsara Webhook] Error inserting location:", error)
  }
}

async function processViolation(data: any, device: any, supabase: any) {
  const event = {
    company_id: device.company_id,
    truck_id: device.truck_id,
    eld_device_id: device.id,
    driver_id: data.driver?.id || data.driverId,
    event_type: "hos_violation",
    severity: data.severity || "critical",
    title: data.violationType || data.violation_type || "HOS Violation",
    description: data.description || data.message,
    event_time: data.timestamp || data.time || new Date().toISOString(),
    resolved: false,
  }
  
  // Insert into eld_events
  const { error } = await supabase.from("eld_events").insert(event)
  
  if (error) {
    console.error("[Samsara Webhook] Error inserting violation:", error)
  }
}

function mapSamsaraStatus(status: string): string {
  const statusMap: Record<string, string> = {
    driving: "driving",
    on_duty: "on_duty",
    off_duty: "off_duty",
    sleeper: "sleeper_berth",
    sleeper_berth: "sleeper_berth",
  }
  
  return statusMap[status?.toLowerCase()] || "off_duty"
}


