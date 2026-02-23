import { NextResponse } from "next/server"

/**
 * API route to get Google Maps API key for client-side use
 * This safely exposes the API key to the client
 * Checks both GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 */
export async function GET() {
  // Check both environment variable names
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { 
        error: "Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file and restart the server.",
        availableEnvVars: {
          GOOGLE_MAPS_API_KEY: !!process.env.GOOGLE_MAPS_API_KEY,
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ apiKey })
}







