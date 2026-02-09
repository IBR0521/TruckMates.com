import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

/**
 * KeepTruckin Webhook Endpoint
 * Receives real-time HOS logs, locations, and events from KeepTruckin ELD devices
 */

// Verify KeepTruckin webhook signature
function verifyKeepTruckinSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(body)
  const expectedSignature = hmac.digest("hex")
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-kt-signature")
    
    // Get webhook secret from environment or device config
    const webhookSecret = process.env.KEEPTRUCKIN_WEBHOOK_SECRET || ""
    
    // Verify signature if secret is configured
    if (webhookSecret && !verifyKeepTruckinSignature(body, signature, webhookSecret)) {
      console.error("[KeepTruckin Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    
    const data = JSON.parse(body)
    const supabase = await createClient()
    
    // Get device by provider_device_id
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, company_id, truck_id, provider_device_id")
      .eq("provider", "keeptruckin")
      .eq("provider_device_id", data.device_id || data.device_serial)
      .single()
    
    if (deviceError || !device) {
      console.error("[KeepTruckin Webhook] Device not found:", data.device_id)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }
    
    // Process webhook event type
    const eventType = data.event_type || data.type
    
    switch (eventType) {
      case "log_updated":
      case "hos_log":
        await processHOSLog(data, device, supabase)
        break
        
      case "location_updated":
      case "gps_location":
        await processLocation(data, device, supabase)
        break
        
      case "violation_detected":
      case "hos_violation":
        await processViolation(data, device, supabase)
        break
        
      default:
        console.log(`[KeepTruckin Webhook] Unhandled event type: ${eventType}`)
    }
    
    return NextResponse.json({ success: true, processed: eventType })
  } catch (error: any) {
    console.error("[KeepTruckin Webhook] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

async function processHOSLog(data: any, device: any, supabase: any) {
  // Map KeepTruckin log format to TruckMates format
  const log = {
    driver_id: data.driver_id, // Will need driver mapping
    log_type: mapKeepTruckinStatus(data.status),
    start_time: data.start_time || data.start,
    end_time: data.end_time || data.end || null,
    location_start: data.location_start
      ? {
          latitude: data.location_start.lat || data.location_start.latitude,
          longitude: data.location_start.lng || data.location_start.longitude,
        }
      : null,
    location_end: data.location_end
      ? {
          latitude: data.location_end.lat || data.location_end.latitude,
          longitude: data.location_end.lng || data.location_end.longitude,
        }
      : null,
    odometer_start: data.odometer_start || data.odometer_reading_start,
    odometer_end: data.odometer_end || data.odometer_reading_end,
    location_address: data.location || data.location_name,
    certified: data.certified || false,
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
    console.error("[KeepTruckin Webhook] Error inserting log:", error)
  }
}

async function processLocation(data: any, device: any, supabase: any) {
  const location = {
    truck_id: device.truck_id,
    latitude: data.latitude || data.lat,
    longitude: data.longitude || data.lng,
    speed: data.speed || null,
    heading: data.heading || data.bearing || null,
    timestamp: data.timestamp || data.time || new Date().toISOString(),
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
    console.error("[KeepTruckin Webhook] Error inserting location:", error)
  }
}

async function processViolation(data: any, device: any, supabase: any) {
  const event = {
    company_id: device.company_id,
    truck_id: device.truck_id,
    eld_device_id: device.id,
    driver_id: data.driver_id,
    event_type: "hos_violation",
    severity: data.severity || "critical",
    title: data.violation_type || "HOS Violation",
    description: data.description || data.message,
    event_time: data.timestamp || data.time || new Date().toISOString(),
    resolved: false,
  }
  
  // Insert into eld_events
  const { error } = await supabase.from("eld_events").insert(event)
  
  if (error) {
    console.error("[KeepTruckin Webhook] Error inserting violation:", error)
  }
}

function mapKeepTruckinStatus(status: string): string {
  const statusMap: Record<string, string> = {
    driving: "driving",
    on_duty: "on_duty",
    off_duty: "off_duty",
    sleeper: "sleeper_berth",
    sleeper_berth: "sleeper_berth",
  }
  
  return statusMap[status?.toLowerCase()] || "off_duty"
}



