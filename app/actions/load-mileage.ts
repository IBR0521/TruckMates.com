"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

// Calculate mileage between two addresses using Google Maps Distance Matrix API
// SEC-003 FIX: Added authentication check
export async function calculateMileage(origin: string, destination: string): Promise<{ miles: number | null; error: string | null }> {
  // SEC-003: Add authentication check
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { miles: null, error: "Unauthorized. Please log in to use this feature." }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!apiKey) {
    return { miles: null, error: "Google Maps API key not configured" }
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`
    )
    const data = await response.json()

    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0]
      if (element.status === "OK") {
        const miles = Math.round(element.distance.value / 1609.34) // Convert meters to miles
        return { miles, error: null }
      } else {
        return { miles: null, error: `Route calculation failed: ${element.status}` }
      }
    }
    return { miles: null, error: "Invalid response from Google Maps API" }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to calculate mileage"
    return { miles: null, error: message }
  }
}

