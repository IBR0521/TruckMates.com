import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

/**
 * Mobile API: Get driver settlements
 * GET /api/mobile/settlements
 * 
 * Returns pending and recent settlements for the authenticated driver
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, userId, error: authError } = await getAuthContext()

    if (authError || !companyId || !userId) {
      return NextResponse.json({ error: authError || "Not authenticated" }, { status: 401 })
    }

    const supabase = await createClient()

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

    // Get settlements for this driver
    const { data: settlements, error: settlementsError } = await supabase
      .from("settlements")
      .select(`
        id,
        period_start,
        period_end,
        gross_pay,
        total_deductions,
        net_pay,
        status,
        driver_approved,
        driver_approved_at,
        pdf_url,
        calculation_details,
        created_at
      `)
      .eq("company_id", companyId)
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (settlementsError) {
      return NextResponse.json({ error: settlementsError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: settlements || [],
    })
  } catch (error: any) {
    console.error("Get settlements error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

/**
 * Mobile API: Get single settlement details
 * GET /api/mobile/settlements/[id]
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, userId, error: authError } = await getAuthContext()

    if (authError || !companyId || !userId) {
      return NextResponse.json({ error: authError || "Not authenticated" }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const { settlement_id } = body

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
      .eq("id", settlement_id)
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



