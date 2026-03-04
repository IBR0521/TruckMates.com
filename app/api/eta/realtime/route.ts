import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateRouteETA } from "@/app/actions/realtime-eta"

/**
 * API endpoint to update route ETA
 * Should be called every 60 seconds for active routes
 * POST /api/eta/realtime/route
 * SEC-002 FIX: Added authentication and company_id ownership check
 */
export async function POST(request: NextRequest) {
  // SEC-002: Add authentication check
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in to access this resource." },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { route_id } = body

    if (!route_id) {
      return NextResponse.json(
        { error: "route_id is required" },
        { status: 400 }
      )
    }

    // SEC-002: Verify user owns the route (company_id check)
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { error: "User company not found" },
        { status: 403 }
      )
    }

    const { data: routeData } = await supabase
      .from("routes")
      .select("company_id")
      .eq("id", route_id)
      .eq("company_id", userData.company_id)
      .single()

    if (!routeData) {
      return NextResponse.json(
        { error: "Route not found or access denied" },
        { status: 403 }
      )
    }

    const result = await updateRouteETA(route_id)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update ETA" },
      { status: 500 }
    )
  }
}



