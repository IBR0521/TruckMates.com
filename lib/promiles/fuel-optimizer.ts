import { decimatePoints, haversineMiles } from "./geo"

export type FuelStopCandidate = {
  id: string
  name: string
  address: string
  stateCode: string | null
  lat: number
  lng: number
}

export type FuelStopRecommendation = {
  rank: number
  id: string
  name: string
  address: string
  stateCode: string | null
  lat: number
  lng: number
  estimatedPricePerGallon: number
  gallonsNeeded: number
  milesOutOfRoute: number
  fuelSpendUsd: number
  detourCostUsd: number
  scoreUsd: number
}

type HereDiscoverResult = {
  items?: Array<{
    id?: string
    title?: string
    address?: { label?: string; stateCode?: string }
    position?: { lat?: number; lng?: number }
  }>
}

function normalizeStopName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function nearestPathDistanceMiles(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
) {
  let min = Number.POSITIVE_INFINITY
  for (const p of path) {
    const d = haversineMiles(point, p)
    if (d < min) min = d
  }
  return Number.isFinite(min) ? min : 0
}

export async function fetchTruckStopsAlongRoute(params: {
  hereApiKey: string
  path: Array<{ lat: number; lng: number }>
  samplePoints?: number
  perSampleLimit?: number
}): Promise<{ data: FuelStopCandidate[]; error: string | null }> {
  if (!params.path || params.path.length < 2) {
    return { data: [], error: "Route path is too short for fuel stop discovery" }
  }
  const samples = decimatePoints(params.path, Math.min(params.samplePoints ?? 8, params.path.length))
  const perSampleLimit = Math.max(1, Math.min(params.perSampleLimit ?? 5, 8))

  const candidates = new Map<string, FuelStopCandidate>()

  for (const sample of samples) {
    const url = new URL("https://discover.search.hereapi.com/v1/discover")
    url.searchParams.set("q", "truck stop")
    url.searchParams.set("at", `${sample.lat},${sample.lng}`)
    url.searchParams.set("limit", String(perSampleLimit))
    url.searchParams.set("lang", "en-US")
    url.searchParams.set("apikey", params.hereApiKey)

    try {
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } })
      if (!res.ok) continue
      const json = (await res.json()) as HereDiscoverResult
      for (const item of json.items || []) {
        const lat = item.position?.lat
        const lng = item.position?.lng
        if (typeof lat !== "number" || typeof lng !== "number") continue
        const id = item.id || `${normalizeStopName(item.title || "truckstop")}-${lat.toFixed(4)}-${lng.toFixed(4)}`
        if (candidates.has(id)) continue
        candidates.set(id, {
          id,
          name: item.title || "Truck Stop",
          address: item.address?.label || "Address unavailable",
          stateCode: item.address?.stateCode || null,
          lat,
          lng,
        })
      }
    } catch {
      // Best-effort discovery, skip failed sample points.
    }
  }

  return { data: Array.from(candidates.values()), error: null }
}

export function scoreFuelStops(params: {
  path: Array<{ lat: number; lng: number }>
  candidates: FuelStopCandidate[]
  priceByState: Record<string, { pricePerGallon: number }>
  gallonsNeeded: number
  fuelCostPerMile: number
  maxOutOfRouteMiles?: number
  topN?: number
}): FuelStopRecommendation[] {
  const maxOutOfRouteMiles = params.maxOutOfRouteMiles ?? 20
  const topN = params.topN ?? 3
  const gallons = Math.max(0, params.gallonsNeeded)
  const fuelCostPerMile = Math.max(0, params.fuelCostPerMile)

  const scored = params.candidates
    .map((candidate) => {
      const nearest = nearestPathDistanceMiles({ lat: candidate.lat, lng: candidate.lng }, params.path)
      const milesOutOfRoute = Math.round(nearest * 2 * 10) / 10 // Out-and-back detour.
      if (milesOutOfRoute > maxOutOfRouteMiles) return null

      const statePrice =
        (candidate.stateCode ? params.priceByState[candidate.stateCode]?.pricePerGallon : undefined) ??
        params.priceByState["US"]?.pricePerGallon
      if (!statePrice || !Number.isFinite(statePrice) || statePrice <= 0) return null

      const fuelSpendUsd = Math.round(statePrice * gallons * 100) / 100
      const detourCostUsd = Math.round(milesOutOfRoute * fuelCostPerMile * 100) / 100
      const scoreUsd = Math.round((fuelSpendUsd + detourCostUsd) * 100) / 100

      return {
        rank: 0,
        id: candidate.id,
        name: candidate.name,
        address: candidate.address,
        stateCode: candidate.stateCode,
        lat: candidate.lat,
        lng: candidate.lng,
        estimatedPricePerGallon: Math.round(statePrice * 1000) / 1000,
        gallonsNeeded: gallons,
        milesOutOfRoute,
        fuelSpendUsd,
        detourCostUsd,
        scoreUsd,
      } satisfies FuelStopRecommendation
    })
    .filter((x): x is FuelStopRecommendation => Boolean(x))
    .sort((a, b) => a.scoreUsd - b.scoreUsd)
    .slice(0, Math.max(1, topN))
    .map((item, index) => ({ ...item, rank: index + 1 }))

  return scored
}
