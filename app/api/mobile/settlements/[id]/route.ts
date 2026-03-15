import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Mobile API: Get single settlement details
 * GET /api/mobile/settlements/[id]
 * 
 * BUG-025 FIX: Changed from POST to GET for proper REST semantics and HTTP caching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, userId, error: authError } = await getCachedAuthContext()

    if (authError || !companyId || !userId) {
      return NextResponse.json({ error: authError || "Not authenticated" }, { status: 401 })
    }

    // Next.js 15: params is now a Promise and must be awaited
    const { id: settlementId } = await params
    const supabase = await createClient()

    if (!settlementId) {
      return NextResponse.json({ error: "Settlement ID is required" }, { status: 400 })
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

    // Get settlement details
    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select(`
        *,
        pay_rule:pay_rule_id (
          id,
          pay_type,
          base_rate_per_mile,
          base_percentage,
          base_flat_rate
        )
      `)
      .eq("id", settlementId)
      .eq("company_id", companyId)
      .eq("driver_id", driver.id)
      .single()

    if (settlementError || !settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: settlement,
    })
  } catch (error: any) {
    console.error("Get settlement error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

