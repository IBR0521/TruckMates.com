"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { calculateDistanceMatrix } from "@/app/actions/integrations-google-maps"

// Calculate mileage between two addresses using Google Distance Matrix (cached + truck mode via integrations)
// SEC-003 FIX: Added authentication check
export async function calculateMileage(origin: string, destination: string): Promise<{ miles: number | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { miles: null, error: "Unauthorized. Please log in to use this feature." }
  }

  try {
    const dm = await calculateDistanceMatrix([origin.trim()], [destination.trim()])
    if (dm.error || !dm.data?.rows?.[0]?.elements?.[0]) {
      return { miles: null, error: dm.error || "Could not calculate distance" }
    }
    const element = dm.data.rows[0].elements[0]
    if (element.status !== "OK") {
      return { miles: null, error: `Route calculation failed: ${element.status}` }
    }
    const meters = element.distance_meters ?? 0
    const miles = Math.round(meters / 1609.34)
    return { miles, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to calculate mileage"
    return { miles: null, error: message }
  }
}

