import { NextResponse } from "next/server"

/**
 * Debug endpoint to check Google Maps API key configuration
 * This helps diagnose API key issues
 */
export async function GET() {
  const hasGoogleMapsKey = !!process.env.GOOGLE_MAPS_API_KEY
  const hasNextPublicKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return NextResponse.json({
    configured: !!apiKey,
    hasGoogleMapsKey,
    hasNextPublicKey,
    keyLength: apiKey ? apiKey.length : 0,
    keyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : null,
    message: apiKey 
      ? "API key is configured correctly" 
      : "API key is missing. Add GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local"
  })
}


