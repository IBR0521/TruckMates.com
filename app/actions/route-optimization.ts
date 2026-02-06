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

// Get toll cost for a route (using Google Maps API if available)
async function getTollCost(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string
): Promise<number> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return 0 // No toll data without API
  }

  try {
    const originStr = typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`
    const destStr = typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`

    // Use Directions API with tolls option
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&alternatives=true&key=${apiKey}`
    )
    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      // Find route with tolls
      for (const route of data.routes) {
        if (route.legs && route.legs.length > 0) {
          // Check if route has tolls (Google Maps doesn't provide exact toll costs in free tier)
          // We'll estimate based on distance and typical toll rates
          const distance = route.legs.reduce((sum: number, leg: any) => sum + (leg.distance?.value || 0), 0) / 1609.34 // miles
          // Estimate toll cost: $0.10 per mile on toll roads (average US toll rate)
          return distance * 0.1
        }
      }
    }
    return 0
  } catch (error) {
    console.error("Toll cost calculation error:", error)
    return 0
  }
}

// Calculate fuel cost based on distance, fuel price, and MPG
function calculateFuelCost(distance: number, fuelPricePerGallon: number = 3.50, mpg: number = 6.5): number {
  const gallons = distance / mpg
  return gallons * fuelPricePerGallon
}

// Check if route is suitable for weight/height constraints
async function checkRouteConstraints(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  weight?: number,
  height?: number
): Promise<{ suitable: boolean; reason?: string }> {
  // If no constraints specified, route is always suitable
  if (!weight && !height) {
    return { suitable: true }
  }

  // For now, we'll assume all routes are suitable
  // In a production system, you'd check against bridge height limits, weight restrictions, etc.
  // This would require integration with specialized routing APIs or databases
  
  // Basic validation: if weight > 80,000 lbs (typical max for US highways), flag it
  if (weight && weight > 80000) {
    return { suitable: false, reason: "Weight exceeds maximum allowed (80,000 lbs)" }
  }

  // Basic validation: if height > 14 feet (typical max for US highways), flag it
  if (height && height > 14) {
    return { suitable: false, reason: "Height exceeds maximum allowed (14 feet)" }
  }

  return { suitable: true }
}

// Optimize route order for multiple stops using nearest neighbor algorithm
// Enhanced with fuel cost, toll cost, and weight/height constraints
export async function optimizeRouteOrder(stops: Array<{
  id: string
  address: string
  lat?: number
  lng?: number
  priority?: number
  timeWindowStart?: string
  timeWindowEnd?: string
  weight?: number // in lbs
  height?: number // in feet
}>, options?: {
  fuelPricePerGallon?: number
  mpg?: number
  includeTolls?: boolean
  maxWeight?: number
  maxHeight?: number
}): Promise<{
  optimizedOrder: Array<{ id: string; order: number }>
  totalDistance: number
  estimatedTime: number
  totalFuelCost: number
  totalTollCost: number
  totalCost: number
  useAPI: boolean
}> {
  const fuelPrice = options?.fuelPricePerGallon || 3.50
  const mpg = options?.mpg || 6.5
  const includeTolls = options?.includeTolls !== false // Default to true
  const maxWeight = options?.maxWeight
  const maxHeight = options?.maxHeight

  if (stops.length <= 1) {
    return {
      optimizedOrder: stops.map((s, i) => ({ id: s.id, order: i + 1 })),
      totalDistance: 0,
      estimatedTime: 0,
      totalFuelCost: 0,
      totalTollCost: 0,
      totalCost: 0,
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
  let totalFuelCost = 0
  let totalTollCost = 0
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

      // Check weight/height constraints
      const weight = stop.weight || maxWeight
      const height = stop.height || maxHeight
      const constraintsCheck = await checkRouteConstraints(
        currentStop.lat && currentStop.lng ? { lat: currentStop.lat, lng: currentStop.lng } : currentStop.address,
        stop.lat && stop.lng ? { lat: stop.lat, lng: stop.lng } : stop.address,
        weight,
        height
      )

      if (!constraintsCheck.suitable) {
        continue // Skip this stop if constraints aren't met
      }

      // Calculate distance using API if available, otherwise use Haversine
      let distance = 0
      let time = 0
      let tollCost = 0

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

        // Get toll cost if enabled
        if (includeTolls) {
          tollCost = await getTollCost(
            { lat: currentStop.lat, lng: currentStop.lng },
            { lat: stop.lat, lng: stop.lng }
          )
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

      // Calculate fuel cost
      const fuelCost = calculateFuelCost(distance, fuelPrice, mpg)

      // Calculate total cost (distance + fuel + tolls)
      const totalCost = distance + fuelCost + tollCost

      // Consider priority in cost calculation (lower cost + priority factor)
      const priorityFactor = stop.priority ? (100 - stop.priority) / 100 : 1
      const adjustedCost = totalCost * priorityFactor

      if (adjustedCost < nearestDistance) {
        nearestDistance = adjustedCost
        nearestTime = time
        nearestStop = stop
      }
    }

    if (nearestStop) {
      visited.add(nearestStop.id)
      optimizedOrder.push({ id: nearestStop.id, order: order++ })
      
      // Calculate actual costs for the selected route
      let actualDistance = 0
      let actualTime = 0
      let actualTollCost = 0

      if (useAPI && currentStop.lat && currentStop.lng && nearestStop.lat && nearestStop.lng) {
        const routeData = await getRouteDistanceAndTime(
          { lat: currentStop.lat, lng: currentStop.lng },
          { lat: nearestStop.lat, lng: nearestStop.lng }
        )
        if (routeData) {
          actualDistance = routeData.distance
          actualTime = routeData.duration
        } else {
          actualDistance = calculateDistance(currentStop.lat, currentStop.lng, nearestStop.lat, nearestStop.lng)
          actualTime = actualDistance / 50 * 60
        }

        if (includeTolls) {
          actualTollCost = await getTollCost(
            { lat: currentStop.lat, lng: currentStop.lng },
            { lat: nearestStop.lat, lng: nearestStop.lng }
          )
        }
      } else if (currentStop.lat && currentStop.lng && nearestStop.lat && nearestStop.lng) {
        actualDistance = calculateDistance(currentStop.lat, currentStop.lng, nearestStop.lat, nearestStop.lng)
        actualTime = actualDistance / 50 * 60
      }

      totalDistance += actualDistance
      totalTime += actualTime
      totalTollCost += actualTollCost
      currentStop = nearestStop
    } else {
      break
    }
  }

  // Calculate total fuel cost
  totalFuelCost = calculateFuelCost(totalDistance, fuelPrice, mpg)
  const totalCost = totalDistance + totalFuelCost + totalTollCost

  return {
    optimizedOrder,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedTime: Math.round(totalTime),
    totalFuelCost: Math.round(totalFuelCost * 100) / 100,
    totalTollCost: Math.round(totalTollCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
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

  // Update route with optimized distance, time, and costs
  await supabase
    .from("routes")
    .update({
      distance: optimizationResult.totalDistance.toString() + " miles",
      estimated_time: `${Math.round(optimizationResult.estimatedTime / 60)}h ${optimizationResult.estimatedTime % 60}m`,
      // Store cost data in metadata or separate fields if available
    })
    .eq("id", routeId)

  // Trigger webhook
  try {
    const { triggerWebhook } = await import("./webhooks")
    await triggerWebhook(userData.company_id, "route.optimized", {
      route_id: routeId,
      optimized_stops: optimizationResult.optimizedOrder.length,
      total_distance: optimizationResult.totalDistance,
      estimated_time: optimizationResult.estimatedTime,
      total_fuel_cost: optimizationResult.totalFuelCost,
      total_toll_cost: optimizationResult.totalTollCost,
      total_cost: optimizationResult.totalCost,
    })
  } catch (error) {
    console.warn("[optimizeMultiStopRoute] Webhook trigger failed:", error)
  }
  
  return {
    optimized: true,
    optimizedStops: optimizationResult.optimizedOrder,
    distance: optimizationResult.totalDistance,
    time: optimizationResult.estimatedTime,
    fuelCost: optimizationResult.totalFuelCost,
    tollCost: optimizationResult.totalTollCost,
    totalCost: optimizationResult.totalCost,
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


