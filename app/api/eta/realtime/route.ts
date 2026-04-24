import { NextRequest, NextResponse } from "next/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
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
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle()

    if (userDataError) {
      return NextResponse.json(
        { error: sanitizeError(userDataError, { fallback: "Failed to verify user company" }) },
        { status: 500 }
      )
    }

    if (!userData?.company_id) {
      return NextResponse.json(
        { error: "User company not found" },
        { status: 403 }
      )
    }

    const { data: routeData, error: routeDataError } = await supabase
      .from("routes")
      .select("company_id")
      .eq("id", route_id)
      .eq("company_id", userData.company_id)
      .maybeSingle()

    if (routeDataError) {
      return NextResponse.json(
        { error: sanitizeError(routeDataError, { fallback: "Failed to verify route ownership" }) },
        { status: 500 }
      )
    }

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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "Failed to update ETA") },
      { status: 500 }
    )
  }
}



