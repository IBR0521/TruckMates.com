import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimitRedis, retryAfterFromReset } from "@/lib/rate-limit-redis"

/**
 * API route to get Google Maps API key for client-side use
 * SECURITY: Now requires authentication to prevent API key exposure
 * Checks both GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 */
export async function GET() {
  // Require authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  const mapsRl = await rateLimitRedis(`maps_key:${user.id}`, { limit: 30, window: 60 })
  if (!mapsRl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": retryAfterFromReset(mapsRl.reset) } },
    )
  }

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







