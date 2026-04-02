import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMobileAuthContext } from "@/lib/auth/mobile"

/**
 * Receive DVIR (Driver Vehicle Inspection Report) entries from mobile app
 * POST /api/eld/mobile/dvirs
 * 
 * Body:
 * {
 *   device_id: string
 *   dvirs: Array<{
 *     truck_id?: string (optional, will use device's truck_id if not provided)
 *     driver_id?: string (optional, will use device's driver_id if not provided)
 *     inspection_type: 'pre_trip' | 'post_trip' | 'on_road'
 *     inspection_date: string (YYYY-MM-DD)
 *     inspection_time?: string (HH:mm)
 *     location?: string (lat, lng or address)
 *     odometer_reading?: number
 *     status: 'pending' | 'passed' | 'failed' | 'defects_corrected'
 *     defects_found: boolean
 *     safe_to_operate: boolean
 *     defects?: Array<{
 *       component: string
 *       description: string
 *       severity: 'minor' | 'major' | 'critical'
 *       corrected?: boolean
 *     }>
 *     notes?: string
 *     corrective_action?: string
 *     driver_signature?: string
 *     driver_signature_date?: string (ISO timestamp)
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, error: authError } = await getMobileAuthContext(request)
    
    if (authError || !companyId) {
      return NextResponse.json(
        { error: authError || "Not authenticated" },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { device_id, dvirs } = body

    // Validate input
    if (!device_id || !dvirs || !Array.isArray(dvirs)) {
      return NextResponse.json(
        { error: "device_id and dvirs array are required" },
        { status: 400 }
      )
    }

    // Verify device belongs to user's company
    const { data: device, error: deviceError } = await supabase
      .from("eld_devices")
      .select("id, truck_id, driver_id, company_id")
      .eq("id", device_id)
      .eq("company_id", companyId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found or access denied" },
        { status: 404 }
      )
    }

    // Transform and validate DVIRs
    const dvirsToInsert = dvirs
      .filter((dvir: any) => dvir.inspection_type && dvir.inspection_date) // Filter invalid DVIRs
      .map((dvir: any) => {
        // Use device's truck_id and driver_id if not provided in DVIR
        const truckId = dvir.truck_id || device.truck_id
        const driverId = dvir.driver_id || device.driver_id

        // Parse inspection_date
        const inspectionDate = dvir.inspection_date || new Date().toISOString().split("T")[0]
        
        // Parse inspection_time (HH:mm format)
        const inspectionTime = dvir.inspection_time || null

        // Parse location (can be "lat, lng" or address string)
        const location = dvir.location || null

        // Parse defects (convert to JSONB format)
        let defectsJson = null
        if (dvir.defects && Array.isArray(dvir.defects) && dvir.defects.length > 0) {
          defectsJson = dvir.defects.map((defect: any) => ({
            component: defect.component || "Unknown",
            description: defect.description || "",
            severity: defect.severity || "minor",
            corrected: defect.corrected || false,
          }))
        }

        // Parse driver_signature_date
        let driverSignatureDate = null
        if (dvir.driver_signature_date) {
          try {
            driverSignatureDate = new Date(dvir.driver_signature_date).toISOString()
          } catch (e) {
            // Invalid date, use current time
            driverSignatureDate = new Date().toISOString()
          }
        } else if (dvir.driver_signature) {
          // If signature exists but no date, use current time
          driverSignatureDate = new Date().toISOString()
        }

        return {
          company_id: companyId,
          driver_id: driverId,
          truck_id: truckId,
          inspection_type: dvir.inspection_type || "pre_trip",
          inspection_date: inspectionDate,
          inspection_time: inspectionTime,
          location: location,
          mileage: dvir.mileage || null,
          odometer_reading: dvir.odometer_reading || null,
          status: dvir.status || (dvir.defects_found ? "failed" : "passed"),
          defects_found: dvir.defects_found || false,
          safe_to_operate: dvir.safe_to_operate !== undefined ? dvir.safe_to_operate : true,
          defects: defectsJson,
          notes: dvir.notes || null,
          corrective_action: dvir.corrective_action || null,
          driver_signature: dvir.driver_signature || null,
          driver_signature_date: driverSignatureDate,
        }
      })
      .filter((dvir: any) => dvir.driver_id && dvir.truck_id) // Only include DVIRs with valid driver and truck

    if (dvirsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid DVIRs to insert. Ensure device has driver_id and truck_id assigned." },
        { status: 400 }
      )
    }

    // Insert DVIRs
    const { data: insertedDVIRs, error: insertError } = await supabase
      .from("dvir")
      .insert(dvirsToInsert)
      .select()

    if (insertError) {
      console.error("Error inserting DVIRs:", insertError)
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
      inserted: insertedDVIRs?.length || 0,
      message: `Successfully synced ${insertedDVIRs?.length || 0} DVIR(s)`,
    })
  } catch (error: unknown) {
    console.error("DVIR sync error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}



