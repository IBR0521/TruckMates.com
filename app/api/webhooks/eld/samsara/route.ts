import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { detectIdleTime } from "@/app/actions/idle-time-tracking"
import crypto from "crypto"
import type { AdminSupabaseClient } from "@/lib/supabase/admin"

/** Cap sequential idle RPCs per webhook response (inserts still proceed for every point). */
const MAX_IDLE_DETECTIONS_PER_REQUEST = 48

type ELDDevice = {
  id: string
  company_id: string
  truck_id: string | null
}

type SamsaraLog = {
  startTime?: string
  start_time?: string
  start?: string
  driver?: { id?: string }
  driverId?: string
  dutyStatus?: string
  status?: string
  endTime?: string
  end_time?: string
  startLocation?: { latitude?: number; longitude?: number }
  endLocation?: { latitude?: number; longitude?: number }
  startOdometer?: number
  odometer_start?: number
  endOdometer?: number
  odometer_end?: number
  location?: string
  locationName?: string
  certified?: boolean
}

type SamsaraLocation = {
  latitude?: number
  lat?: number
  longitude?: number
  lng?: number
  speed?: number
  heading?: number
  bearing?: number
  timestamp?: string
  time?: string
}

type SamsaraWebhookDataRoot = {
  locations?: SamsaraLocation[]
  gpsLocations?: SamsaraLocation[]
}

type SamsaraWebhookData = SamsaraLocation & SamsaraWebhookDataRoot & {
  vehicle?: { id?: string }
  vehicle_id?: string
  eventType?: string
  type?: string
  name?: string
  logs?: SamsaraLog[]
  hosLogs?: SamsaraLog[]
  location?: SamsaraLocation
  gpsLocation?: SamsaraLocation
  driver?: { id?: string }
  driverId?: string
  severity?: string
  violationType?: string
  violation_type?: string
  description?: string
  message?: string
}

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

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

function expandSamsaraLocationPayloads(data: SamsaraWebhookData): SamsaraLocation[] {
  const root = data as SamsaraWebhookData & SamsaraWebhookDataRoot
  if (Array.isArray(root.locations) && root.locations.length > 0) return root.locations
  if (Array.isArray(root.gpsLocations) && root.gpsLocations.length > 0) return root.gpsLocations
  const nested = data.location || data.gpsLocation
  if (nested && typeof nested === "object") return [nested]
  return [data]
}

function idleDetectionTimestamp(location: SamsaraLocation): string | null {
  const raw = location.timestamp ?? location.time
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (!s) return null
  const parsed = Date.parse(s)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

async function invokeIdleDetectionAfterLocation(opts: {
  truckId: string | null | undefined
  latitude: unknown
  longitude: unknown
  timestampIso?: string | null
  speed: unknown
  driverId?: string | null
  idleBudget: { remaining: number }
  providerLabel: string
}) {
  const truckId = String(opts.truckId ?? "").trim()
  const latNum = typeof opts.latitude === "number" ? opts.latitude : Number(opts.latitude)
  const lngNum = typeof opts.longitude === "number" ? opts.longitude : Number(opts.longitude)
  if (!truckId || !opts.timestampIso || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return
  }
  if (opts.idleBudget.remaining <= 0) {
    return
  }

  opts.idleBudget.remaining -= 1

  const speedParsed =
    opts.speed !== null && opts.speed !== undefined ? Number(opts.speed) : NaN

  await detectIdleTime(
    truckId,
    latNum,
    lngNum,
    opts.timestampIso,
    Number.isFinite(speedParsed) ? speedParsed : undefined,
    undefined,
    opts.driverId ? String(opts.driverId) : undefined,
  ).catch((err: unknown) => console.error(opts.providerLabel, "detectIdleTime failed", err))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-samsara-signature")
    
    // Get webhook secret from environment
    const webhookSecret = process.env.SAMSARA_WEBHOOK_SECRET || ""
    
    // SECURITY: Fail-closed - require secret to be configured
    if (!webhookSecret) {
      console.error("[Samsara Webhook] SAMSARA_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Verify signature
    if (!verifySamsaraSignature(body, signature, webhookSecret)) {
      console.error("[Samsara Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    
    const data: SamsaraWebhookData = JSON.parse(body)
    // SECURITY: Use admin client for webhooks (no user session)
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const supabase = createAdminClient()
    
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
    const typedDevice: ELDDevice = device
    
    // Process webhook event type
    const eventType = data.eventType || data.type || data.name
    
    switch (eventType) {
      case "hos_logs":
      case "hosLogs":
        await processHOSLogs(data, typedDevice, supabase)
        break
        
      case "gps_location":
      case "gpsLocation":
        await processLocation(data, typedDevice, supabase)
        break
        
      case "hos_violation":
      case "hosViolation":
        await processViolation(data, typedDevice, supabase)
        break
        
      default:
        console.log(`[Samsara Webhook] Unhandled event type: ${eventType}`)
    }
    
    return NextResponse.json({ success: true, processed: eventType })
  } catch (error: unknown) {
    console.error("[Samsara Webhook] Error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

async function processHOSLogs(data: SamsaraWebhookData, device: ELDDevice, supabase: AdminSupabaseClient) {
  const logs: SamsaraLog[] = Array.isArray(data.logs)
    ? data.logs
    : Array.isArray(data.hosLogs)
      ? data.hosLogs
      : [data as unknown as SamsaraLog]
  
  for (const logData of logs) {
    // Derive log_date from start_time (required field)
    const startTime = logData.startTime || logData.start_time || logData.start
    const logDate = startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    
    const log = {
      driver_id: logData.driver?.id || logData.driverId,
      log_type: mapSamsaraStatus(logData.dutyStatus || logData.status || "off_duty"),
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
      log_date: logDate, // Required field - derive from start_time
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

async function processLocation(
  data: SamsaraWebhookData,
  device: ELDDevice,
  supabase: AdminSupabaseClient
) {
  const payloads = expandSamsaraLocationPayloads(data).sort((a, b) => {
    const ta = Date.parse(String(a.timestamp ?? a.time ?? "")) || 0
    const tb = Date.parse(String(b.timestamp ?? b.time ?? "")) || 0
    return ta - tb
  })

  const idleBudget = { remaining: MAX_IDLE_DETECTIONS_PER_REQUEST }

  for (const rawLocation of payloads) {
    const location = rawLocation
    const locationData = {
      truck_id: device.truck_id,
      latitude: location.latitude ?? location.lat,
      longitude: location.longitude ?? location.lng,
      speed: location.speed ?? null,
      heading: location.heading ?? location.bearing ?? null,
      timestamp: location.timestamp ?? location.time ?? new Date().toISOString(),
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

    await invokeIdleDetectionAfterLocation({
      truckId: locationData.truck_id,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestampIso: idleDetectionTimestamp(location),
      speed: location.speed ?? locationData.speed,
      driverId: data.driver?.id || data.driverId || null,
      idleBudget,
      providerLabel: "[Samsara]",
    })
  }

  if (payloads.length > MAX_IDLE_DETECTIONS_PER_REQUEST) {
    console.warn(
      `[Samsara Webhook] detectIdleTime capped at ${MAX_IDLE_DETECTIONS_PER_REQUEST} sequential call(s); extra location(s) ingested without idle scan`,
    )
  }
}

async function processViolation(
  data: SamsaraWebhookData,
  device: ELDDevice,
  supabase: AdminSupabaseClient
) {
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



