import { NextRequest, NextResponse } from "next/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMobileAuthContext } from "@/lib/auth/mobile"

/**
 * Register mobile app as ELD device
 * POST /api/eld/mobile/register
 * 
 * Body:
 * {
 *   device_name: string (e.g., "John's iPhone")
 *   device_serial_number: string (unique device ID)
 *   truck_id?: string (optional)
 *   app_version?: string
 *   device_info?: object (phone model, OS version, etc.)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, user, error: authError } = await getMobileAuthContext(request)
    
    if (authError || !companyId) {
      return NextResponse.json(
        { error: authError || "Not authenticated" },
        { status: 401 }
      )
    }

    // Driver-only access: non-driver roles cannot use ELD mobile registration.
    const normalizedRole = String(user?.role || "").trim().toLowerCase()
    if (normalizedRole !== "driver") {
      return NextResponse.json(
        { error: "Access denied. ELD app is available for Driver accounts only." },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const {
      device_name,
      device_serial_number,
      truck_id,
      app_version,
      device_info,
    } = body

    // Validate required fields
    if (!device_name || !device_serial_number) {
      return NextResponse.json(
        { error: "Device name and serial number are required" },
        { status: 400 }
      )
    }

    // Create or update ELD device record for mobile app
    const deviceData = {
      company_id: companyId,
      device_name,
      device_serial_number, // Must be unique
      provider: "truckmates_mobile", // Special provider identifier for mobile app
      provider_device_id: device_serial_number, // Use serial as device ID
      truck_id: truck_id || null,
      status: "active",
      firmware_version: app_version || null,
      installation_date: new Date().toISOString().split("T")[0],
      notes: device_info ? JSON.stringify(device_info) : null,
      last_sync_at: new Date().toISOString(),
      // API credentials not needed for mobile app (uses auth token)
      api_key: null,
      api_secret: null,
    }

    // Check if device with this serial already exists and belongs to a different company
    const { data: existingDevice } = await supabase
      .from("eld_devices")
      .select("id, company_id")
      .eq("device_serial_number", device_serial_number)
      .maybeSingle()
    
    // SECURITY: Prevent device serial hijacking - reject if exists with different company
    if (existingDevice && existingDevice.company_id !== companyId) {
      return NextResponse.json(
        { error: "Device serial number is already registered to another company" },
        { status: 403 }
      )
    }
    
    // Write device without requiring DB-level unique constraint on device_serial_number.
    // If a row exists for this company+serial, update it; otherwise insert a new row.
    let device: any = null
    let error: any = null
    if (existingDevice?.id && existingDevice.company_id === companyId) {
      const result = await supabase
        .from("eld_devices")
        .update(deviceData)
        .eq("id", existingDevice.id)
        .eq("company_id", companyId)
        .select()
        .single()
      device = result.data
      error = result.error
    } else {
      const result = await supabase
        .from("eld_devices")
        .insert(deviceData)
        .select()
        .single()
      device = result.data
      error = result.error
    }

    if (error) {
      console.error("Error registering ELD device:", error)
      return NextResponse.json(
        { error: sanitizeError(error, { fallback: "Failed to register ELD device" }) },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      device_id: device.id,
      device: {
        id: device.id,
        device_name: device.device_name,
        device_serial_number: device.device_serial_number,
        status: device.status,
      },
      message: "Device registered successfully",
    })
  } catch (error: unknown) {
    console.error("Register device error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

