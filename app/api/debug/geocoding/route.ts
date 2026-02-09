import { NextResponse } from "next/server"
import { geocodeAddress } from "@/app/actions/integrations-google-maps"

/**
 * Debug endpoint to test geocoding
 * Usage: GET /api/debug/geocoding?address=123 Main St, New York, NY 10001
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address") || "1600 Amphitheatre Parkway, Mountain View, CA"

    // Check if API key is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: "GOOGLE_MAPS_API_KEY is not set in environment variables",
        apiKeyConfigured: false,
      }, { status: 500 })
    }

    // Try to geocode
    const result = await geocodeAddress(address)

    return NextResponse.json({
      success: !!result.data,
      error: result.error,
      address,
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
      result: result.data ? {
        lat: result.data.lat,
        lng: result.data.lng,
        formatted_address: result.data.formatted_address,
      } : null,
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || "Unknown error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }, { status: 500 })
  }
}



