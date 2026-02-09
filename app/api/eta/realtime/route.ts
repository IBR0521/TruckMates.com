import { NextRequest, NextResponse } from "next/server"
import { updateRouteETA } from "@/app/actions/realtime-eta"

/**
 * API endpoint to update route ETA
 * Should be called every 60 seconds for active routes
 * POST /api/eta/realtime/route
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { route_id } = body

    if (!route_id) {
      return NextResponse.json(
        { error: "route_id is required" },
        { status: 400 }
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



