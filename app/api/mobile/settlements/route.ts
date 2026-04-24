import { NextRequest, NextResponse } from "next/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Mobile API: Get driver settlements
 * GET /api/mobile/settlements
 * 
 * Returns pending and recent settlements for the authenticated driver
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, userId, error: authError } = await getCachedAuthContext()

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
      return NextResponse.json({ error: sanitizeError(settlementsError, { fallback: "Failed to load settlements" }) }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: settlements || [],
    })
  } catch (error: unknown) {
    console.error("Get settlements error:", error)
    return NextResponse.json({ error: errorMessage(error, "Internal server error") }, { status: 500 })
  }
}

// BUG-025 FIX: Removed POST handler for settlement details
// Settlement details are now handled by GET /api/mobile/settlements/[id]/route.ts
// This provides proper REST semantics and enables HTTP caching



