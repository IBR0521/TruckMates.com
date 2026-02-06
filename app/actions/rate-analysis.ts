"use server"

/**
 * Smart Rate Suggestions
 * Integrates with DAT iQ or Truckstop Rate Analysis API
 * Falls back to internal rate database from historical loads
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { geocodeAddress } from "./integrations-google-maps"

export interface MarketRateSuggestion {
  average_rate: number
  rate_range: {
    min: number
    max: number
    median: number
  }
  confidence: 'high' | 'medium' | 'low'
  historical_trend: 'up' | 'down' | 'stable'
  profitability_score: number // 0-100, your rate vs market
  sample_size: number
  last_updated: string
  source: 'dat_iq' | 'truckstop' | 'internal' | 'estimated'
}

/**
 * Get market rate suggestion for a lane
 * Tries DAT iQ/Truckstop first, falls back to internal database
 */
export async function getMarketRateSuggestion(
  origin: string,
  destination: string,
  equipmentType: string = 'dry_van',
  yourRate?: number
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Try external rate API first (if configured)
    const externalRate = await getExternalRateSuggestion(origin, destination, equipmentType)
    
    if (externalRate && !externalRate.error) {
      const suggestion = externalRate.data!
      
      // Calculate profitability if your rate provided
      if (yourRate !== undefined) {
        suggestion.profitability_score = calculateProfitabilityScore(yourRate, suggestion.average_rate)
      }
      
      return { data: suggestion, error: null }
    }

    // Fallback to internal rate database
    const internalRate = await getInternalRateSuggestion(origin, destination, equipmentType)
    
    if (internalRate && !internalRate.error) {
      const suggestion = internalRate.data!
      
      if (yourRate !== undefined) {
        suggestion.profitability_score = calculateProfitabilityScore(yourRate, suggestion.average_rate)
      }
      
      return { data: suggestion, error: null }
    }

    // Last resort: estimated rate based on distance
    const estimatedRate = await getEstimatedRate(origin, destination, equipmentType)
    
    if (estimatedRate && !estimatedRate.error) {
      const suggestion = estimatedRate.data!
      
      if (yourRate !== undefined) {
        suggestion.profitability_score = calculateProfitabilityScore(yourRate, suggestion.average_rate)
      }
      
      return { data: suggestion, error: null }
    }

    return { error: "Unable to get rate suggestion", data: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get rate suggestion", data: null }
  }
}

/**
 * Get rate from external API (DAT iQ or Truckstop)
 */
async function getExternalRateSuggestion(
  origin: string,
  destination: string,
  equipmentType: string
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  // Check if DAT iQ is configured
  const datIqApiKey = process.env.DAT_IQ_API_KEY
  const truckstopApiKey = process.env.TRUCKSTOP_API_KEY

  if (datIqApiKey) {
    try {
      return await getDATiQRate(origin, destination, equipmentType, datIqApiKey)
    } catch (error) {
      console.error("DAT iQ API error:", error)
    }
  }

  if (truckstopApiKey) {
    try {
      return await getTruckstopRate(origin, destination, equipmentType, truckstopApiKey)
    } catch (error) {
      console.error("Truckstop API error:", error)
    }
  }

  return { error: "No external rate API configured", data: null }
}

/**
 * DAT iQ Rate API integration
 */
async function getDATiQRate(
  origin: string,
  destination: string,
  equipmentType: string,
  apiKey: string
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  try {
    // Geocode addresses to get coordinates
    const originGeo = await geocodeAddress(origin)
    const destGeo = await geocodeAddress(destination)

    if (originGeo.error || !originGeo.data || destGeo.error || !destGeo.data) {
      return { error: "Failed to geocode addresses", data: null }
    }

    // DAT iQ API endpoint (example - adjust based on actual API)
    const url = `https://api.dat.com/v1/rates/spot?` +
      `origin_lat=${originGeo.data.lat}&origin_lng=${originGeo.data.lng}&` +
      `dest_lat=${destGeo.data.lat}&dest_lng=${destGeo.data.lng}&` +
      `equipment_type=${equipmentType}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    })

    if (!response.ok) {
      return { error: `DAT iQ API error: ${response.statusText}`, data: null }
    }

    const data = await response.json()

    // Parse DAT iQ response (adjust based on actual response format)
    return {
      data: {
        average_rate: data.average_rate || data.rate || 0,
        rate_range: {
          min: data.min_rate || data.rate_range?.min || 0,
          max: data.max_rate || data.rate_range?.max || 0,
          median: data.median_rate || data.rate || 0
        },
        confidence: data.confidence || 'medium',
        historical_trend: data.trend || 'stable',
        profitability_score: 50, // Will be calculated later
        sample_size: data.sample_size || 0,
        last_updated: new Date().toISOString(),
        source: 'dat_iq'
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "DAT iQ API failed", data: null }
  }
}

/**
 * Truckstop Rate API integration
 */
async function getTruckstopRate(
  origin: string,
  destination: string,
  equipmentType: string,
  apiKey: string
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  try {
    // Similar implementation for Truckstop API
    // Adjust based on actual Truckstop API documentation
    const url = `https://api.truckstop.com/v1/rates?` +
      `origin=${encodeURIComponent(origin)}&` +
      `destination=${encodeURIComponent(destination)}&` +
      `equipment=${equipmentType}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    })

    if (!response.ok) {
      return { error: `Truckstop API error: ${response.statusText}`, data: null }
    }

    const data = await response.json()

    return {
      data: {
        average_rate: data.average_rate || 0,
        rate_range: {
          min: data.min_rate || 0,
          max: data.max_rate || 0,
          median: data.median_rate || 0
        },
        confidence: 'high',
        historical_trend: 'stable',
        profitability_score: 50,
        sample_size: data.sample_size || 0,
        last_updated: new Date().toISOString(),
        source: 'truckstop'
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Truckstop API failed", data: null }
  }
}

/**
 * Get rate from internal database (historical loads)
 */
async function getInternalRateSuggestion(
  origin: string,
  destination: string,
  equipmentType: string
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get historical loads for similar lanes (last 90 days)
    const { data: historicalLoads, error } = await supabase
      .from("loads")
      .select("rate, origin, destination, created_at")
      .eq("company_id", company_id)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .not("rate", "is", null)
      .gt("rate", 0)
      .limit(100)

    if (error) {
      return { error: error.message, data: null }
    }

    if (!historicalLoads || historicalLoads.length === 0) {
      return { error: "No historical data available", data: null }
    }

    // Filter loads by similar origin/destination (simplified matching)
    const similarLoads = historicalLoads.filter(load => {
      const originMatch = load.origin?.toLowerCase().includes(origin.toLowerCase().split(',')[0]) ||
                         origin.toLowerCase().includes(load.origin?.toLowerCase().split(',')[0] || '')
      const destMatch = load.destination?.toLowerCase().includes(destination.toLowerCase().split(',')[0]) ||
                       destination.toLowerCase().includes(load.destination?.toLowerCase().split(',')[0] || '')
      return originMatch && destMatch
    })

    if (similarLoads.length === 0) {
      return { error: "No similar lanes found", data: null }
    }

    // Calculate statistics
    const rates = similarLoads.map(l => l.rate).filter((r): r is number => r !== null && r > 0)
    const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length
    const sortedRates = [...rates].sort((a, b) => a - b)
    const medianRate = sortedRates[Math.floor(sortedRates.length / 2)]
    const minRate = Math.min(...rates)
    const maxRate = Math.max(...rates)

    // Determine trend (compare last 30 days vs previous 30 days)
    const recentLoads = similarLoads.filter(l => 
      new Date(l.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    const olderLoads = similarLoads.filter(l => 
      new Date(l.created_at) <= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) &&
      new Date(l.created_at) > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    )

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (recentLoads.length > 0 && olderLoads.length > 0) {
      const recentAvg = recentLoads.reduce((sum, l) => sum + (l.rate || 0), 0) / recentLoads.length
      const olderAvg = olderLoads.reduce((sum, l) => sum + (l.rate || 0), 0) / olderLoads.length
      const change = ((recentAvg - olderAvg) / olderAvg) * 100
      
      if (change > 5) trend = 'up'
      else if (change < -5) trend = 'down'
    }

    // Determine confidence based on sample size
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (similarLoads.length >= 20) confidence = 'high'
    else if (similarLoads.length >= 10) confidence = 'medium'

    return {
      data: {
        average_rate: Math.round(averageRate),
        rate_range: {
          min: Math.round(minRate),
          max: Math.round(maxRate),
          median: Math.round(medianRate)
        },
        confidence,
        historical_trend: trend,
        profitability_score: 50, // Will be calculated later
        sample_size: similarLoads.length,
        last_updated: new Date().toISOString(),
        source: 'internal'
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get internal rate", data: null }
  }
}

/**
 * Get estimated rate based on distance (fallback)
 */
async function getEstimatedRate(
  origin: string,
  destination: string,
  equipmentType: string
): Promise<{ data: MarketRateSuggestion | null; error: string | null }> {
  try {
    // Get route distance
    const { getRouteDirections } = await import("./integrations-google-maps")
    const directions = await getRouteDirections(origin, destination)

    if (directions.error || !directions.data) {
      return { error: "Failed to calculate distance", data: null }
    }

    const distanceMiles = (directions.data.distance_meters || 0) / 1609.34

    // Estimate rate: $1.50-$2.50 per mile (varies by equipment)
    const ratePerMile = equipmentType === 'flatbed' ? 2.0 : 
                       equipmentType === 'reefer' ? 2.2 : 1.8
    const estimatedRate = Math.round(distanceMiles * ratePerMile)

    return {
      data: {
        average_rate: estimatedRate,
        rate_range: {
          min: Math.round(estimatedRate * 0.8),
          max: Math.round(estimatedRate * 1.2),
          median: estimatedRate
        },
        confidence: 'low',
        historical_trend: 'stable',
        profitability_score: 50,
        sample_size: 0,
        last_updated: new Date().toISOString(),
        source: 'estimated'
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to estimate rate", data: null }
  }
}

/**
 * Calculate profitability score (0-100)
 */
function calculateProfitabilityScore(yourRate: number, marketRate: number): number {
  if (marketRate === 0) return 50

  const ratio = yourRate / marketRate
  
  // Score based on how your rate compares to market
  if (ratio >= 1.2) return 100 // 20%+ above market
  if (ratio >= 1.1) return 90  // 10-20% above market
  if (ratio >= 1.0) return 80  // At or slightly above market
  if (ratio >= 0.9) return 60  // 10% below market
  if (ratio >= 0.8) return 40  // 20% below market
  return 20 // More than 20% below market
}


