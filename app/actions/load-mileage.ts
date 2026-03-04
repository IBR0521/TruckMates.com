"use server"

import { createClient } from "@/lib/supabase/server"

// Calculate mileage between two addresses using Google Maps Distance Matrix API
// SEC-003 FIX: Added authentication check
export async function calculateMileage(origin: string, destination: string): Promise<{ miles: number | null; error: string | null }> {
  // SEC-003: Add authentication check
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
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
  } catch (error: any) {
    console.error("Mileage calculation error:", error)
    return { miles: null, error: error.message || "Failed to calculate mileage" }
  }
}

