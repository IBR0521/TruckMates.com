import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMobileAuthContext } from "@/lib/auth/mobile"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"

/**
 * Receive HOS (Hours of Service) log entries from mobile app
 * POST /api/eld/mobile/logs
 * 
 * Body:
 * {
 *   device_id: string
 *   logs: Array<{
 *     log_date: string (YYYY-MM-DD)
 *     log_type: 'driving' | 'on_duty' | 'off_duty' | 'sleeper_berth'
 *     start_time: string (ISO timestamp)
 *     end_time?: string (ISO timestamp, null if ongoing)
 *     duration_minutes?: number
 *     location_start?: { lat: number, lng: number, address?: string }
 *     location_end?: { lat: number, lng: number, address?: string }
 *     odometer_start?: number
 *     odometer_end?: number
 *     miles_driven?: number
 *     engine_hours?: number
 *     violations?: Array<string>
 *     driver_id?: string
 *   }>
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

    const supabase = createAdminClient()
    const body = await request.json()
    const { device_id, logs } = body

    // Validate input
    if (!device_id || !logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: "device_id and logs array are required" },
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

    // Resolve driver IDs so ELD logs always store internal drivers.id.
    // Mobile app may send auth user id; platform dashboards read by drivers.id.
    const candidateDriverIds = Array.from(
      new Set(
        logs
          .map((log: any) => String(log?.driver_id || user?.id || "").trim())
          .filter((id: string) => id.length > 0)
      )
    )

    const mapByDriverId = new Map<string, string>()
    const mapByUserId = new Map<string, string>()
    if (candidateDriverIds.length > 0) {
      const { data: byDriverId } = await supabase
        .from("drivers")
        .select("id, user_id")
        .eq("company_id", companyId)
        .in("id", candidateDriverIds)

      const { data: byUserId } = await supabase
        .from("drivers")
        .select("id, user_id")
        .eq("company_id", companyId)
        .in("user_id", candidateDriverIds)

      ;(byDriverId || []).forEach((row: { id: string; user_id: string | null }) => {
        mapByDriverId.set(String(row.id), String(row.id))
        if (row.user_id) mapByUserId.set(String(row.user_id), String(row.id))
      })
      ;(byUserId || []).forEach((row: { id: string; user_id: string | null }) => {
        mapByDriverId.set(String(row.id), String(row.id))
        if (row.user_id) mapByUserId.set(String(row.user_id), String(row.id))
      })
    }

    // If no drivers row exists yet, create it so eld_logs.driver_id always resolves (FK → drivers.id).
    let ensuredDriverId: string | null = null
    if (user?.id) {
      ensuredDriverId = await ensureDriverIdForUser(supabase, companyId, user.id)
      if (ensuredDriverId) {
        mapByDriverId.set(ensuredDriverId, ensuredDriverId)
        mapByUserId.set(String(user.id), ensuredDriverId)
      }
    }

    // Transform and validate logs
    const logsToInsert = logs
      .filter((log: any) => log.log_type && log.start_time) // Filter invalid logs
      .map((log: any) => {
        // Parse log_date or use today
        const logDate = log.log_date || log.date || new Date().toISOString().split("T")[0]
        
        return {
          company_id: companyId,
          eld_device_id: device_id,
          driver_id:
            (() => {
              const raw = String(log.driver_id || user?.id || "").trim()
              if (!raw) return ensuredDriverId
              return (
                mapByDriverId.get(raw) || mapByUserId.get(raw) || ensuredDriverId || null
              )
            })(),
          truck_id: device.truck_id || log.truck_id || null,
          log_date: logDate,
          log_type: log.log_type || log.status, // 'driving', 'on_duty', 'off_duty', 'sleeper_berth'
          start_time: log.start_time || log.startTime,
          end_time: log.end_time || log.endTime || null,
          duration_minutes: log.duration_minutes || log.durationMinutes || null,
          location_start: log.location_start || log.startLocation || null,
          location_end: log.location_end || log.endLocation || null,
          odometer_start: log.odometer_start || log.odometerStart || null,
          odometer_end: log.odometer_end || log.odometerEnd || null,
          miles_driven: log.miles_driven || log.milesDriven || null,
          engine_hours: log.engine_hours || log.engineHours || null,
          violations: log.violations || null,
          raw_data: log.raw_data || log,
        }
      })

    const withDriver = logsToInsert.filter((row) => row.driver_id)
    if (withDriver.length === 0) {
      return NextResponse.json(
        { error: "Could not resolve driver for logs. Ensure your account is a driver in this company." },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabase.from("eld_logs").insert(withDriver)

    if (insertError) {
      console.error("Error inserting logs:", insertError)
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
      inserted: withDriver.length,
      message: `Successfully synced ${withDriver.length} log(s)`,
    })
  } catch (error: unknown) {
    console.error("Log sync error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

