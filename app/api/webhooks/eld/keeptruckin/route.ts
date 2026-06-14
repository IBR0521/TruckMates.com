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

type KeepTruckinWebhookData = {
  locations?: KeepTruckinWebhookData[]
  device_id?: string
  device_serial?: string
  event_type?: string
  type?: string
  start_time?: string
  start?: string
  end_time?: string
  end?: string
  driver_id?: string
  status?: string
  location_start?: { lat?: number; latitude?: number; lng?: number; longitude?: number }
  location_end?: { lat?: number; latitude?: number; lng?: number; longitude?: number }
  odometer_start?: number
  odometer_reading_start?: number
  odometer_end?: number
  odometer_reading_end?: number
  location?: string
  location_name?: string
  certified?: boolean
  latitude?: number
  lat?: number
  longitude?: number
  lng?: number
  speed?: number
  heading?: number
  bearing?: number
  timestamp?: string
  time?: string
  severity?: string
  violation_type?: string
  description?: string
  message?: string
}

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
  
  // Check buffer lengths first to prevent TypeError
  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  
  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

function expandKeepTruckinLocationPayloads(data: KeepTruckinWebhookData): KeepTruckinWebhookData[] {
  if (Array.isArray(data.locations) && data.locations.length > 0) return data.locations
  return [data]
}

function mergeKeepTruckinLocationRow(
  envelope: KeepTruckinWebhookData,
  row: KeepTruckinWebhookData,
): KeepTruckinWebhookData {
  return { ...envelope, ...row }
}

function idleDetectionTimestampFromRow(row: KeepTruckinWebhookData): string | null {
  const raw = row.timestamp ?? row.time
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (!s) return null
  const parsed = Date.parse(s)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

async function invokeIdleDetectionKeepTruckin(opts: {
  truckId: string | null | undefined
  row: KeepTruckinWebhookData
  idleBudget: { remaining: number }
}) {
  const truckId = String(opts.truckId ?? "").trim()
  const latNum = typeof opts.row.latitude === "number" ? opts.row.latitude : Number(opts.row.latitude ?? opts.row.lat)
  const lngNum =
    typeof opts.row.longitude === "number" ? opts.row.longitude : Number(opts.row.longitude ?? opts.row.lng)
  const ts = idleDetectionTimestampFromRow(opts.row)
  if (!truckId || !ts || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return
  }
  if (opts.idleBudget.remaining <= 0) return
  opts.idleBudget.remaining -= 1

  const speedRaw = opts.row.speed
  const speedParsed = speedRaw !== null && speedRaw !== undefined ? Number(speedRaw) : NaN

  await detectIdleTime(
    truckId,
    latNum,
    lngNum,
    ts,
    Number.isFinite(speedParsed) ? speedParsed : undefined,
    undefined,
    opts.row.driver_id ? String(opts.row.driver_id) : undefined,
  ).catch((err: unknown) => console.error("[KeepTruckin] detectIdleTime failed", err))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-kt-signature")
    
    // Get webhook secret from environment
    const webhookSecret = process.env.KEEPTRUCKIN_WEBHOOK_SECRET || ""
    
    // SECURITY: Fail-closed - require secret to be configured
    if (!webhookSecret) {
      console.error("[KeepTruckin Webhook] KEEPTRUCKIN_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Verify signature
    if (!verifyKeepTruckinSignature(body, signature, webhookSecret)) {
      console.error("[KeepTruckin Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    
    const data: KeepTruckinWebhookData = JSON.parse(body)
    // SECURITY: Use admin client for webhooks (no user session)
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const supabase = createAdminClient()
    
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
    const typedDevice: ELDDevice = device
    
    // Process webhook event type
    const eventType = data.event_type || data.type
    
    switch (eventType) {
      case "log_updated":
      case "hos_log":
        await processHOSLog(data, typedDevice, supabase)
        break
        
      case "location_updated":
      case "gps_location":
        await processLocation(data, typedDevice, supabase)
        break
        
      case "violation_detected":
      case "hos_violation":
        await processViolation(data, typedDevice, supabase)
        break
        
      default:
        console.log(`[KeepTruckin Webhook] Unhandled event type: ${eventType}`)
    }
    
    return NextResponse.json({ success: true, processed: eventType })
  } catch (error: unknown) {
    console.error("[KeepTruckin Webhook] Error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

async function processHOSLog(
  data: KeepTruckinWebhookData,
  device: ELDDevice,
  supabase: AdminSupabaseClient
) {
  // Map KeepTruckin log format to TruckMates format
  // Derive log_date from start_time (required field)
  const startTime = data.start_time || data.start
  const logDate = startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  
  const log = {
    driver_id: data.driver_id, // Will need driver mapping
    log_type: mapKeepTruckinStatus(data.status || "off_duty"),
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
    console.error("[KeepTruckin Webhook] Error inserting log:", error)
  }
}

async function processLocation(
  data: KeepTruckinWebhookData,
  device: ELDDevice,
  supabase: AdminSupabaseClient
) {
  const rows = expandKeepTruckinLocationPayloads(data)
    .map((row) => mergeKeepTruckinLocationRow(data, row))
    .sort((a, b) => {
      const ta = Date.parse(String(a.timestamp ?? a.time ?? "")) || 0
      const tb = Date.parse(String(b.timestamp ?? b.time ?? "")) || 0
      return ta - tb
    })

  const idleBudget = { remaining: MAX_IDLE_DETECTIONS_PER_REQUEST }

  for (const row of rows) {
    const location = {
      truck_id: device.truck_id,
      latitude: row.latitude ?? row.lat,
      longitude: row.longitude ?? row.lng,
      speed: row.speed ?? null,
      heading: row.heading ?? row.bearing ?? null,
      timestamp: row.timestamp ?? row.time ?? new Date().toISOString(),
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

    await invokeIdleDetectionKeepTruckin({
      truckId: location.truck_id,
      row,
      idleBudget,
    })
  }

  if (rows.length > MAX_IDLE_DETECTIONS_PER_REQUEST) {
    console.warn(
      `[KeepTruckin Webhook] detectIdleTime capped at ${MAX_IDLE_DETECTIONS_PER_REQUEST} sequential call(s); extra location(s) ingested without idle scan`,
    )
  }
}

async function processViolation(
  data: KeepTruckinWebhookData,
  device: ELDDevice,
  supabase: AdminSupabaseClient
) {
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



