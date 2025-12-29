import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

/**
 * Receive GPS location updates from mobile app
 * POST /api/eld/mobile/locations
 * 
 * Body:
 * {
 *   device_id: string (ELD device ID from register endpoint)
 *   locations: Array<{
 *     timestamp: string (ISO timestamp)
 *     latitude: number
 *     longitude: number
 *     address?: string
 *     speed?: number (MPH)
 *     heading?: number (0-360 degrees)
 *     odometer?: number
 *     engine_status?: 'on' | 'off' | 'idle'
 *     driver_id?: string (optional)
 *   }>
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
    const { device_id, locations } = body

    // Validate input
    if (!device_id || !locations || !Array.isArray(locations)) {
      return NextResponse.json(
        { error: "device_id and locations array are required" },
        { status: 400 }
      )
    }

    if (locations.length === 0) {
      return NextResponse.json(
        { error: "locations array cannot be empty" },
        { status: 400 }
      )
    }

    // Verify device belongs to user's company
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, truck_id, company_id")
      .eq("id", device_id)
      .eq("company_id", companyId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found or access denied" },
        { status: 404 }
      )
    }

    // Transform and validate locations
    const locationsToInsert = locations
      .filter((loc: any) => loc.latitude && loc.longitude) // Filter invalid locations
      .map((loc: any) => ({
        company_id: companyId,
        eld_device_id: device_id,
        driver_id: loc.driver_id || null,
        truck_id: device.truck_id || loc.truck_id || null,
        timestamp: loc.timestamp || new Date().toISOString(),
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        address: loc.address || null,
        speed: loc.speed ? Number(loc.speed) : null,
        heading: loc.heading ? Number(loc.heading) : null,
        odometer: loc.odometer ? Number(loc.odometer) : null,
        engine_status: loc.engine_status || "unknown",
      }))

    if (locationsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid locations to insert" },
        { status: 400 }
      )
    }

    // Batch insert locations (limit batch size to avoid timeout)
    const BATCH_SIZE = 100
    let insertedCount = 0

    for (let i = 0; i < locationsToInsert.length; i += BATCH_SIZE) {
      const batch = locationsToInsert.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from("eld_locations")
        .insert(batch)

      if (insertError) {
        console.error("Error inserting location batch:", insertError)
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }
      insertedCount += batch.length
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device_id)

    return NextResponse.json({
      success: true,
      inserted: insertedCount,
      message: `Successfully inserted ${insertedCount} location(s)`,
    })
  } catch (error: any) {
    console.error("Location sync error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

