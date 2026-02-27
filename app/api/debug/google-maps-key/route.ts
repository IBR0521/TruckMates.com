import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Debug endpoint to check Google Maps API key configuration
 * SECURITY: Requires authentication to prevent information disclosure
 * This helps diagnose API key issues
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



