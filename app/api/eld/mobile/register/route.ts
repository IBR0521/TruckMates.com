import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

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
    const { companyId, error: authError } = await getAuthContext()
    
    if (authError || !companyId) {
      return NextResponse.json(
        { error: authError || "Not authenticated" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
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

    // Upsert device (update if exists with same serial, create if new)
    const { data: device, error } = await supabase
      .from("eld_devices")
      .upsert(deviceData, {
        onConflict: "device_serial_number",
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error registering ELD device:", error)
      return NextResponse.json(
        { error: error.message },
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
  } catch (error: any) {
    console.error("Register device error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

