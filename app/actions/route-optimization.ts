"use server"

/**
 * Route Optimization Service
 * 
 * This service provides route optimization capabilities including:
 * - Multi-stop route optimization
 * - Distance and time calculations
 * - Traffic-aware routing (when API available)
 * - Route sequencing for efficiency
 */

import { createClient } from "@/lib/supabase/server"

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

// Get coordinates from address using Google Maps Geocoding API
async function getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    )
    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }
    return null
  } catch (error) {
    console.error("Geocoding error:", error)
    return null
  }
}

// Get distance and duration using Google Maps Distance Matrix API
async function getRouteDistanceAndTime(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string
): Promise<{ distance: number; duration: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    const originStr = typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`
    const destStr = typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originStr)}&destinations=${encodeURIComponent(destStr)}&units=imperial&key=${apiKey}`
    )
    const data = await response.json()

    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0]
      if (element.status === "OK") {
        return {
          distance: element.distance.value / 1609.34, // Convert meters to miles
          duration: element.duration.value / 60, // Convert seconds to minutes
        }
      }
    }
    return null
  } catch (error) {
    console.error("Distance Matrix API error:", error)
    return null
  }
}

// Optimize route order for multiple stops using nearest neighbor algorithm
export async function optimizeRouteOrder(stops: Array<{
  id: string
  address: string
  lat?: number
  lng?: number
  priority?: number
  timeWindowStart?: string
  timeWindowEnd?: string
}>): Promise<{
  optimizedOrder: Array<{ id: string; order: number }>
  totalDistance: number
  estimatedTime: number
  useAPI: boolean
}> {
  if (stops.length <= 1) {
    return {
      optimizedOrder: stops.map((s, i) => ({ id: s.id, order: i + 1 })),
      totalDistance: 0,
      estimatedTime: 0,
      useAPI: false,
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const useAPI = !!apiKey

  // First, get coordinates for all stops that don't have them
  const stopsWithCoords = await Promise.all(
    stops.map(async (stop) => {
      if (stop.lat && stop.lng) {
        return stop
      }
      const coords = await getCoordinates(stop.address)
      if (coords) {
        return { ...stop, lat: coords.lat, lng: coords.lng }
      }
      return stop
    })
  )

  // Start from the first stop (or origin)
  const visited = new Set<string>()
  const optimizedOrder: Array<{ id: string; order: number }> = []
  let currentStop = stopsWithCoords[0]
  let totalDistance = 0
  let totalTime = 0
  let order = 1

  visited.add(currentStop.id)
  optimizedOrder.push({ id: currentStop.id, order: order++ })

  // Nearest neighbor algorithm with API distance calculation when available
  while (visited.size < stopsWithCoords.length) {
    let nearestStop: typeof stopsWithCoords[0] | null = null
    let nearestDistance = Infinity
    let nearestTime = 0

    for (const stop of stopsWithCoords) {
      if (visited.has(stop.id)) continue

      // Calculate distance using API if available, otherwise use Haversine
      let distance = 0
      let time = 0

      if (useAPI && currentStop.lat && currentStop.lng && stop.lat && stop.lng) {
        // Use Google Maps Distance Matrix API for accurate routing
        const routeData = await getRouteDistanceAndTime(
          { lat: currentStop.lat, lng: currentStop.lng },
          { lat: stop.lat, lng: stop.lng }
        )
        if (routeData) {
          distance = routeData.distance
          time = routeData.duration
        } else {
          // Fallback to Haversine if API fails
          distance = calculateDistance(currentStop.lat, currentStop.lng, stop.lat, stop.lng)
          time = distance / 50 * 60 // Estimate time at 50 mph
        }
      } else if (currentStop.lat && currentStop.lng && stop.lat && stop.lng) {
        // Use Haversine formula for straight-line distance
        distance = calculateDistance(currentStop.lat, currentStop.lng, stop.lat, stop.lng)
        time = distance / 50 * 60 // Estimate time at 50 mph
      } else {
        // If no coordinates, estimate based on priority or use default
        distance = stop.priority ? 1000 / stop.priority : 100
        time = distance / 50 * 60
      }

      // Consider priority in distance calculation (lower distance + priority factor)
      const priorityFactor = stop.priority ? (100 - stop.priority) / 100 : 1
      const adjustedDistance = distance * priorityFactor

      if (adjustedDistance < nearestDistance) {
        nearestDistance = adjustedDistance
        nearestTime = time
        nearestStop = stop
      }
    }

    if (nearestStop) {
      visited.add(nearestStop.id)
      optimizedOrder.push({ id: nearestStop.id, order: order++ })
      totalDistance += nearestDistance
      totalTime += nearestTime
      currentStop = nearestStop
    } else {
      break
    }
  }

  return {
    optimizedOrder,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedTime: Math.round(totalTime),
    useAPI,
  }
}

// Calculate route distance and time between two addresses
export async function calculateRouteDistance(
  origin: string,
  destination: string
): Promise<{
  distance: number // in miles
  duration: number // in minutes
  error?: string
  useAPI: boolean
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    // Fallback: return estimated values
    return {
      distance: 100, // Estimated miles
      duration: 120, // Estimated minutes
      error: "Google Maps API key not configured. Using estimated values. Set GOOGLE_MAPS_API_KEY in environment variables for accurate calculations.",
      useAPI: false,
    }
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`
    )
    const data = await response.json()

    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0]
      if (element.status === "OK") {
        return {
          distance: element.distance.value / 1609.34, // Convert meters to miles
          duration: element.duration.value / 60, // Convert seconds to minutes
          useAPI: true,
        }
      } else {
        return {
          distance: 0,
          duration: 0,
          error: `Google Maps API error: ${element.status}`,
          useAPI: true,
        }
      }
    }

    return {
      distance: 0,
      duration: 0,
      error: "Invalid response from Google Maps API",
      useAPI: true,
    }
  } catch (error: any) {
    return {
      distance: 0,
      duration: 0,
      error: error.message || "Failed to calculate route distance",
      useAPI: false,
    }
  }
}

// Optimize multi-stop route with traffic awareness
export async function optimizeMultiStopRoute(routeId: string): Promise<{
  optimized: boolean
  optimizedStops?: Array<{ id: string; order: number }>
  distance?: number
  time?: number
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { optimized: false, error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { optimized: false, error: "No company found" }
  }

  // Get route with stops
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("*")
    .eq("id", routeId)
    .eq("company_id", userData.company_id)
    .single()

  if (routeError || !route) {
    return { optimized: false, error: "Route not found" }
  }

  // Get route stops
  const { data: stops } = await supabase
    .from("route_stops")
    .select("*")
    .eq("route_id", routeId)
    .order("stop_number", { ascending: true })

  if (!stops || stops.length <= 1) {
    return { optimized: false, error: "Not enough stops to optimize" }
  }

  // Convert stops to optimization format
  const stopsForOptimization = stops.map((stop) => ({
    id: stop.id,
    address: stop.address || "",
    lat: stop.coordinates?.lat,
    lng: stop.coordinates?.lng,
    priority: stop.priority === "high" ? 3 : stop.priority === "medium" ? 2 : 1,
    timeWindowStart: stop.time_window_1_open,
    timeWindowEnd: stop.time_window_1_close,
  }))

  // Optimize route order
  const optimizationResult = await optimizeRouteOrder(stopsForOptimization)

  // Update route stops with optimized order
  for (const optimizedStop of optimizationResult.optimizedOrder) {
    await supabase
      .from("route_stops")
      .update({ stop_number: optimizedStop.order })
      .eq("id", optimizedStop.id)
  }

  // Update route with optimized distance and time
  await supabase
    .from("routes")
    .update({
      distance: optimizationResult.totalDistance.toString() + " miles",
      estimated_time: `${Math.round(optimizationResult.estimatedTime / 60)}h ${optimizationResult.estimatedTime % 60}m`,
    })
    .eq("id", routeId)

  return {
    optimized: true,
    optimizedStops: optimizationResult.optimizedOrder,
    distance: optimizationResult.totalDistance,
    time: optimizationResult.estimatedTime,
  }
}

// Get route suggestions based on load locations
export async function getRouteSuggestions(loadIds: string[]): Promise<{
  suggestions: Array<{
    routeId: string
    routeName: string
    distance: number
    efficiency: number
  }>
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { suggestions: [], error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { suggestions: [], error: "No company found" }
  }

  // Get loads data
  const { data: loads } = await supabase
    .from("loads")
    .select("id, origin, destination, status")
    .in("id", loadIds)
    .eq("company_id", userData.company_id)
    .eq("status", "pending")

  if (!loads || loads.length === 0) {
    return { suggestions: [], error: "No pending loads found" }
  }

  // Get existing routes
  const { data: routes } = await supabase
    .from("routes")
    .select("*")
    .eq("company_id", userData.company_id)

  const suggestions: Array<{
    routeId: string
    routeName: string
    distance: number
    efficiency: number
  }> = []

  // Find routes that match load origins/destinations
  for (const route of routes || []) {
    for (const load of loads) {
      const originMatch = route.origin?.toLowerCase().includes(load.origin?.toLowerCase() || "") ||
        load.origin?.toLowerCase().includes(route.origin?.toLowerCase() || "")
      const destMatch = route.destination?.toLowerCase().includes(load.destination?.toLowerCase() || "") ||
        load.destination?.toLowerCase().includes(route.destination?.toLowerCase() || "")

      if (originMatch || destMatch) {
        const distance = parseFloat(route.distance?.replace(/[^0-9.]/g, "") || "0")
        suggestions.push({
          routeId: route.id,
          routeName: route.name || `${route.origin} → ${route.destination}`,
          distance,
          efficiency: originMatch && destMatch ? 100 : 50,
        })
      }
    }
  }

  // Sort by efficiency
  suggestions.sort((a, b) => b.efficiency - a.efficiency)

  return { suggestions }
}


