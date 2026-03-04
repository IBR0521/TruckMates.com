import { NextResponse } from "next/server"

export async function GET() {
  // Get Mapbox API key from environment variables
  // Check both MAPBOX_API_KEY and NEXT_PUBLIC_MAPBOX_API_KEY
  const apiKey = process.env.MAPBOX_API_KEY || process.env.NEXT_PUBLIC_MAPBOX_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "Mapbox API key not configured" },
      { status: 503 }
    )
  }

  return NextResponse.json({ apiKey })
}

