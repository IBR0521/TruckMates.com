import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

/**
 * Receive events/violations from mobile app
 * POST /api/eld/mobile/events
 * 
 * Body:
 * {
 *   device_id: string
 *   events: Array<{
 *     event_type: 'hos_violation' | 'speeding' | 'hard_brake' | 'hard_accel' | 'device_malfunction' | 'other'
 *     severity?: 'info' | 'warning' | 'critical'
 *     title: string
 *     description?: string
 *     event_time: string (ISO timestamp)
 *     location?: { lat: number, lng: number, address?: string }
 *     metadata?: object
 *     driver_id?: string
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
    const { device_id, events } = body

    // Validate input
    if (!device_id || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "device_id and events array are required" },
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

    // Transform and validate events
    const eventsToInsert = events
      .filter((event: any) => event.event_type && event.title) // Filter invalid events
      .map((event: any) => ({
        company_id: companyId,
        eld_device_id: device_id,
        driver_id: event.driver_id || null,
        truck_id: device.truck_id || event.truck_id || null,
        event_type: event.event_type || event.type, // 'hos_violation', 'speeding', etc.
        severity: event.severity || "warning",
        title: event.title || event.name || "Event",
        description: event.description || event.message || null,
        event_time: event.event_time || event.timestamp || new Date().toISOString(),
        location: event.location || null,
        resolved: false,
        metadata: event.metadata || event.additional_data || null,
      }))

    if (eventsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid events to insert" },
        { status: 400 }
      )
    }

    // Insert events
    const { error: insertError } = await supabase
      .from("eld_events")
      .insert(eventsToInsert)

    if (insertError) {
      console.error("Error inserting events:", insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Update device last_sync_at
    await supabase
      .from("eld_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device_id)

    return NextResponse.json({
      success: true,
      inserted: eventsToInsert.length,
      message: `Successfully synced ${eventsToInsert.length} event(s)`,
    })
  } catch (error: any) {
    console.error("Event sync error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

