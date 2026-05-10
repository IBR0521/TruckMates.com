import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { errorMessage } from "@/lib/error-message"
import { detectIdleTime } from "@/app/actions/idle-time-tracking"

/** Cap sequential idle RPCs per webhook request (inserts still proceed for every point). */
const MAX_IDLE_DETECTIONS_PER_REQUEST = 48

type InsertClient = {
  from: (table: "eld_logs" | "eld_locations" | "eld_violations" | "eld_events") => {
    insert: (values: unknown) => PromiseLike<{ error: unknown }>
  }
}

type ELDDevice = {
  id: string
  company_id: string
  truck_id: string | null
}

type GeotabEntity = {
  locations?: GeotabEntity[]
  type?: string
  device?: { id?: string }
  driver?: { id?: string }
  driverId?: string
  dutyStatus?: string
  status?: string
  dateTime?: string
  startTime?: string
  start?: string
  endDateTime?: string
  endTime?: string
  startLocation?: { latitude?: number; longitude?: number }
  endLocation?: { latitude?: number; longitude?: number }
  startOdometer?: number
  odometerStart?: number
  endOdometer?: number
  odometerEnd?: number
  location?: string
  locationName?: string
  certified?: boolean
  latitude?: number
  lat?: number
  longitude?: number
  lng?: number
  speed?: number
  heading?: number
  bearing?: number
  timestamp?: string
  severity?: string
  exceptionType?: string
  violation_type?: string
  description?: string
  message?: string
}

type GeotabWebhookData = GeotabEntity & {
  entityType?: string
  type?: string
  entity?: GeotabEntity
  deviceId?: string
  device?: { id?: string }
}

/**
 * Geotab Webhook Endpoint
 * Receives real-time HOS logs, locations, and events from Geotab ELD devices
 * Geotab uses a different webhook format (DataChange events)
 */

function verifyGeotabSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false

  const trimmed = signatureHeader.trim()
  const signatureValue = trimmed.toLowerCase().startsWith("sha256=")
    ? trimmed.slice(7).trim()
    : trimmed

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")

  const sigBuffer = Buffer.from(signatureValue, "utf8")
  const expectedBuffer = Buffer.from(expectedHex, "utf8")
  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

function expandGeotabLocationEntities(root: GeotabWebhookData): GeotabEntity[] {
  const primary = root.entity ?? root
  if (Array.isArray(primary.locations) && primary.locations.length > 0) return primary.locations
  return [primary]
}

function mergeGeotabEntity(parent: GeotabEntity, child: GeotabEntity): GeotabEntity {
  return {
    ...parent,
    ...child,
    locations: undefined,
    device: child.device ?? parent.device,
    driver: child.driver ?? parent.driver,
    driverId: child.driverId ?? parent.driverId,
  }
}

function idleDetectionTimestampGeotab(row: GeotabEntity): string | null {
  const raw = row.dateTime ?? row.timestamp
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (!s) return null
  const parsed = Date.parse(s)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

async function invokeIdleDetectionGeotab(opts: {
  truckId: string | null | undefined
  row: GeotabEntity
  idleBudget: { remaining: number }
}) {
  const truckId = String(opts.truckId ?? "").trim()
  const latNum = typeof opts.row.latitude === "number" ? opts.row.latitude : Number(opts.row.latitude ?? opts.row.lat)
  const lngNum =
    typeof opts.row.longitude === "number"
      ? opts.row.longitude
      : Number(opts.row.longitude ?? opts.row.lng)
  const ts = idleDetectionTimestampGeotab(opts.row)
  if (!truckId || !ts || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) return
  if (opts.idleBudget.remaining <= 0) return
  opts.idleBudget.remaining -= 1

  const spd = opts.row.speed
  const speedParsed = spd !== null && spd !== undefined ? Number(spd) : NaN
  const driverId = opts.row.driver?.id || opts.row.driverId

  await detectIdleTime(
    truckId,
    latNum,
    lngNum,
    ts,
    Number.isFinite(speedParsed) ? speedParsed : undefined,
    undefined,
    driverId ? String(driverId) : undefined,
  ).catch((err: unknown) => console.error("[Geotab] detectIdleTime failed", err))
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify Geotab webhook signature
    const webhookSecret = process.env.GEOTAB_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("[Geotab Webhook] GEOTAB_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const signature = request.headers.get("x-geotab-signature")

    // Get raw body for HMAC verification
    const rawBody = await request.text()

    if (!verifyGeotabSignature(rawBody, signature, webhookSecret)) {
      console.error("[Geotab Webhook] Invalid or missing signature")
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    const body: GeotabWebhookData = JSON.parse(rawBody)

    // SECURITY: Use admin client for webhooks (no user session)
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const supabase = createAdminClient()
    
    // Geotab webhooks include entityType and entity
    const entityType = body.entityType || body.type || body.entity?.type
    
    // Get device by provider_device_id (Geotab uses device serial)
    const deviceId = body.entity?.device?.id || body.deviceId || body.device?.id
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
    const typedDevice: ELDDevice = device
    
    // Process Geotab entity type
    switch (entityType) {
      case "LogRecord":
      case "hos_log":
        await processHOSLog(body, typedDevice, supabase)
        break
        
      case "StatusData":
      case "gps_location":
        await processLocation(body, typedDevice, supabase)
        break
        
      case "ExceptionEvent":
      case "hos_violation":
        await processViolation(body, typedDevice, supabase)
        break
        
      default:
        console.log(`[Geotab Webhook] Unhandled entity type: ${entityType}`)
    }
    
    return NextResponse.json({ success: true, processed: entityType })
  } catch (error: unknown) {
    console.error("[Geotab Webhook] Error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

async function processHOSLog(data: GeotabWebhookData, device: ELDDevice, supabase: InsertClient) {
  const logData = data.entity || data
  
  // Derive log_date from start_time (required field)
  const startTime = logData.dateTime || logData.startTime || logData.start
  const logDate = startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  
  const log = {
    driver_id: logData.driver?.id || logData.driverId,
    log_type: mapGeotabStatus(logData.dutyStatus || logData.status || "OFF_DUTY"),
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
    console.error("[Geotab Webhook] Error inserting log:", error)
  }
}

async function processLocation(
  data: GeotabWebhookData,
  device: ELDDevice,
  supabase: InsertClient
) {
  const baseEntity = data.entity || data

  const rows = expandGeotabLocationEntities(data)
    .map((row) => mergeGeotabEntity(baseEntity, row))
    .sort((a, b) => {
      const ta = Date.parse(String(a.dateTime ?? a.timestamp ?? "")) || 0
      const tb = Date.parse(String(b.dateTime ?? b.timestamp ?? "")) || 0
      return ta - tb
    })

  const idleBudget = { remaining: MAX_IDLE_DETECTIONS_PER_REQUEST }

  for (const merged of rows) {
    const location = {
      truck_id: device.truck_id,
      latitude: merged.latitude ?? merged.lat,
      longitude: merged.longitude ?? merged.lng,
      speed: merged.speed ?? null,
      heading: merged.heading ?? merged.bearing ?? null,
      timestamp: merged.dateTime ?? merged.timestamp ?? new Date().toISOString(),
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

    await invokeIdleDetectionGeotab({
      truckId: location.truck_id,
      row: merged,
      idleBudget,
    })
  }

  if (rows.length > MAX_IDLE_DETECTIONS_PER_REQUEST) {
    console.warn(
      `[Geotab Webhook] detectIdleTime capped at ${MAX_IDLE_DETECTIONS_PER_REQUEST} sequential call(s); extra location(s) ingested without idle scan`,
    )
  }
}

async function processViolation(
  data: GeotabWebhookData,
  device: ELDDevice,
  supabase: InsertClient
) {
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



