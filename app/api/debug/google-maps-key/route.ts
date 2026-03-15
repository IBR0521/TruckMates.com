import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Debug endpoint to check Google Maps API key configuration.
 * SECURITY: Returns 404 in production (NODE_ENV=production). Dev only.
 */
export async function GET() {
  // SECURITY: Require authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }
  const hasGoogleMapsKey = !!process.env.GOOGLE_MAPS_API_KEY
  const hasNextPublicKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // BUG-041 FIX: Remove keyPrefix to prevent information disclosure
  // Only return boolean configured status, not any key metadata
  // BUG-028 FIX: Guard with NODE_ENV check to prevent in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug endpoints are disabled in production" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    configured: !!apiKey,
    // BUG-041 FIX: Removed keyPrefix, keyLength, hasGoogleMapsKey, hasNextPublicKey
    // These fields leak information about the API key
    message: apiKey 
      ? "API key is configured correctly" 
      : "API key is missing. Add GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local"
  })
}



