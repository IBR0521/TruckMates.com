"use server"

import { revalidatePath } from "next/cache"

/**
 * ProMiles-equivalent: truck routing (HERE) + planning-time state miles + EIA diesel + HERE toll costs.
 * Google Maps remains used for geocoding and fallback driving directions polyline.
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { geocodeAddress, getRouteDirections } from "@/app/actions/integrations-google-maps"
import { decodeGoogleEncodedPolyline } from "@/lib/promiles/polyline-google"
import { getHereTruckRoute } from "@/lib/promiles/here-truck-route"
import { estimateStateMilesFromLatLngPath } from "@/lib/promiles/state-mileage"
import {
  buildDieselPricesForStates,
  estimateFuelCostUsd,
  fetchLatestUsDieselPrice,
} from "@/lib/promiles/eia-diesel"
import { EIA_US_DIESEL_DUOAREA } from "@/lib/promiles/padd-state-map"
import { stripStaleEnvKeyWarnings } from "@/lib/promiles/strip-trip-env-warnings"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"

export type TripPlanningEstimate = {
  computed_at: string
  routing_provider: "here" | "google_fallback"
  origin: { lat: number; lng: number; label: string }
  destination: { lat: number; lng: number; label: string }
  /** When routing used multiple delivery stops in order (origin → stop 1 → … → last). */
  multi_stop?: {
    delivery_stop_count: number
    /** Total points in chain (origin + all delivery stops) */
    chain_point_count: number
  }
  distance_miles: number
  duration_seconds?: number
  state_miles: Array<{ state_code: string; miles: number }>
  fuel: {
    mpg_assumed: number
    estimated_gallons: number
    estimated_cost_usd: number | null
    diesel_note?: string
    price_by_state?: Record<string, { pricePerGallon: number; seriesId: string }>
  }
  tolls: {
    estimated_usd: number | null
    note?: string
  }
  warnings: string[]
}

function milesFromMeters(m: number) {
  return Math.round((m / 1609.34) * 10) / 10
}

/**
 * Full trip planning estimate (dispatcher: origin → destination, truck params).
 */
export async function getTripPlanningEstimate(input: {
  origin: string
  destination: string
  /** Assumed fuel economy for cost estimate (defaults 6.5) */
  mpg?: number
  truck?: {
    grossWeightLbs?: number
    axleCount?: number
  }
}): Promise<{ data: TripPlanningEstimate | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await getCurrentCompanyFeatureAccess("route_optimization")
  if (!gate.allowed) {
    return { data: null, error: gate.error || "Route optimization is not available on your current plan." }
  }

  const warnings: string[] = []
  const mpg = input.mpg && input.mpg > 0 ? input.mpg : 6.5

  const o = await geocodeAddress(input.origin.trim())
  const d = await geocodeAddress(input.destination.trim())
  if (o.error || !o.data) return { data: null, error: o.error || "Origin geocoding failed" }
  if (d.error || !d.data) return { data: null, error: d.error || "Destination geocoding failed" }

  const origin = { lat: o.data.lat, lng: o.data.lng, label: o.data.formatted_address }
  const destination = { lat: d.data.lat, lng: d.data.lng, label: d.data.formatted_address }

  const hereKey = process.env.HERE_API_KEY || ""
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || ""
  const eiaKey = process.env.EIA_API_KEY || ""

  let routing_provider: "here" | "google_fallback" = "google_fallback"
  let path: Array<{ lat: number; lng: number }> = []
  let distanceMeters = 0
  let durationSeconds = 0
  let hereTollUsd: number | null = null

  const grossKg =
    input.truck?.grossWeightLbs && input.truck.grossWeightLbs > 0
      ? input.truck.grossWeightLbs * 0.453592
      : undefined

  if (hereKey) {
    const here = await getHereTruckRoute({
      apiKey: hereKey,
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      grossWeightKg: grossKg,
      axleCount: input.truck?.axleCount,
    })
    if (here.data && here.data.path.length >= 2) {
      routing_provider = "here"
      path = here.data.path
      distanceMeters = here.data.distanceMeters
      durationSeconds = here.data.durationSeconds
      hereTollUsd = here.data.tollUsd
    } else {
      warnings.push(`HERE truck routing unavailable (${here.error || "unknown"}); using Google directions polyline.`)
    }
  } else {
    warnings.push("HERE_API_KEY not set — using Google Directions for polyline (not true truck mode).")
  }

  if (path.length < 2) {
    const g = await getRouteDirections(
      `${origin.lat},${origin.lng}`,
      `${destination.lat},${destination.lng}`
    )
    if (g.error || !g.data?.polyline) {
      return { data: null, error: g.error || "Could not build route polyline" }
    }
    path = decodeGoogleEncodedPolyline(g.data.polyline)
    distanceMeters = g.data.distance_meters || 0
    durationSeconds = g.data.duration_seconds || 0
    routing_provider = "google_fallback"
  }

  // Toll USD comes from the same HERE `getHereTruckRoute` response (`return=tolls`). No second HERE request —
  // when polyline falls back to Google, tolls are not available unless you fix HERE routing.

  if (!googleKey) {
    return { data: null, error: "GOOGLE_MAPS_API_KEY required for state mileage (geocoding)." }
  }

  const stateEst = await estimateStateMilesFromLatLngPath(path, googleKey, { maxPoints: 100 })
  if (stateEst.error) warnings.push(stateEst.error)

  const distance_miles =
    distanceMeters > 0 ? milesFromMeters(distanceMeters) : stateEst.totalMiles > 0 ? stateEst.totalMiles : 0

  let dieselNote: string | undefined
  let priceByState: TripPlanningEstimate["fuel"]["price_by_state"]
  let fuelCost: number | null = null
  let estimated_gallons = distance_miles > 0 ? Math.round((distance_miles / mpg) * 10) / 10 : 0

  if (eiaKey && stateEst.rows.length > 0) {
    const built = await buildDieselPricesForStates(eiaKey, stateEst.rows)
    if (built.error) {
      warnings.push(`EIA diesel pricing: ${built.error}`)
      const us = await fetchLatestUsDieselPrice(eiaKey)
      if (us.price != null) {
        fuelCost = Math.round(((distance_miles / mpg) * us.price) * 100) / 100
        dieselNote = `US weekly average diesel $${us.price}/gal (EIA v2 ${EIA_US_DIESEL_DUOAREA} / EPD2D)`
      }
    } else {
      priceByState = built.byState
      fuelCost = estimateFuelCostUsd({ stateMiles: stateEst.rows, priceByState: built.byState, mpg })
      dieselNote = "EIA weekly retail diesel by PADD region (planning estimate)"
    }
  } else {
    warnings.push("EIA_API_KEY not set — fuel cost not estimated from government averages.")
  }

  const tollUsd = hereTollUsd
  let tollNote: string | undefined
  if (hereKey && tollUsd == null) {
    tollNote =
      routing_provider === "google_fallback"
        ? "Toll estimate uses HERE Routing only — not shown when the polyline falls back to Google (fix HERE truck routing for tolls)."
        : "HERE did not return toll line items for this response (toll-free route or toll data unavailable for this corridor)."
  }

  const estimate: TripPlanningEstimate = {
    computed_at: new Date().toISOString(),
    routing_provider,
    origin,
    destination,
    distance_miles,
    duration_seconds: durationSeconds || undefined,
    state_miles: stateEst.rows,
    fuel: {
      mpg_assumed: mpg,
      estimated_gallons,
      estimated_cost_usd: fuelCost,
      diesel_note: dieselNote,
      price_by_state: priceByState,
    },
    tolls: {
      estimated_usd: tollUsd,
      note: tollNote,
    },
    warnings,
  }

  return { data: estimate, error: null }
}

/**
 * Persist planning estimate on a load (JSONB). Reconcile with GPS / IFTA later in workflows.
 */
export async function saveTripPlanningEstimateOnLoad(loadId: string, estimate: TripPlanningEstimate) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const gate = await getCurrentCompanyFeatureAccess("route_optimization")
  if (!gate.allowed) {
    return { error: gate.error || "Route optimization is not available on your current plan.", data: null }
  }

  const { error } = await supabase
    .from("loads")
    .update({
      // Don’t persist env-key “not set” warnings — they go stale after keys are added in Vercel/.env
      trip_planning_estimate: stripStaleEnvKeyWarnings(estimate) as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }
  revalidatePath(`/dashboard/loads/${loadId}`)
  revalidatePath("/dashboard/loads")
  return { data: { success: true }, error: null }
}
