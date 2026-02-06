import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

/**
 * Mobile API: Approve settlement
 * POST /api/mobile/settlements/approve
 * 
 * Body:
 * {
 *   settlement_id: string
 *   approval_method: 'mobile_app' | 'email' | 'sms'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, userId, error: authError } = await getAuthContext()

    if (authError || !companyId || !userId) {
      return NextResponse.json({ error: authError || "Not authenticated" }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const { settlement_id, approval_method = "mobile_app" } = body

    if (!settlement_id) {
      return NextResponse.json({ error: "settlement_id is required" }, { status: 400 })
    }

    // Get driver ID from user
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    // Verify settlement belongs to this driver
    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select("id, driver_id, status, driver_approved")
      .eq("id", settlement_id)
      .eq("company_id", companyId)
      .eq("driver_id", driver.id)
      .single()

    if (settlementError || !settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
    }

    if (settlement.driver_approved) {
      return NextResponse.json({ error: "Settlement already approved" }, { status: 400 })
    }

    if (settlement.status === "cancelled") {
      return NextResponse.json({ error: "Cannot approve cancelled settlement" }, { status: 400 })
    }

    // Update settlement with approval
    const { data: updatedSettlement, error: updateError } = await supabase
      .from("settlements")
      .update({
        driver_approved: true,
        driver_approved_at: new Date().toISOString(),
        driver_approval_method: approval_method,
      })
      .eq("id", settlement_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Send notification to company (optional)
    try {
      const { sendSMS } = await import("@/app/actions/sms")
      // Get company admin users to notify
      const { data: admins } = await supabase
        .from("users")
        .select("phone")
        .eq("company_id", companyId)
        .eq("role", "manager")
        .limit(5)

      // Send SMS to first admin (if phone exists)
      if (admins && admins.length > 0 && admins[0].phone) {
        await sendSMS({
          to: admins[0].phone,
          message: `Driver ${driver.id} approved settlement ${settlement_id.substring(0, 8)}. Net pay: $${updatedSettlement.net_pay}`,
        }).catch((err) => console.error("SMS notification error:", err))
      }
    } catch (notificationError) {
      // Don't fail approval if notification fails
      console.error("Notification error (non-blocking):", notificationError)
    }

    return NextResponse.json({
      success: true,
      data: updatedSettlement,
      message: "Settlement approved successfully",
    })
  } catch (error: any) {
    console.error("Approve settlement error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}


