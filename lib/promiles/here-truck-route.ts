import { decode } from "@here/flexpolyline"
import { errorMessage } from "@/lib/error-message"
import { getCachedApiResult, setCachedApiResult } from "@/lib/api-protection"
import { generateCacheKey } from "@/lib/api-cache-utils"

/** Same corridor + truck params → reuse HERE response (official routes change slowly). */
const HERE_TRUCK_ROUTE_CACHE_TTL_SEC = 86_400

function roundCoord(n: number) {
  return Math.round(n * 1e5) / 1e5
}

export type HereTruckRouteResult = {
  provider: "here"
  distanceMeters: number
  durationSeconds: number
  /** Decoded path [lat, lng][] */
  path: Array<{ lat: number; lng: number }>
  rawPolyline: string
  /**
   * Sum of minimum USD fare per toll facility (HERE may list transponder vs cash — we take cheapest USD).
   * `0` = toll-free; `null` = toll block not present in response (e.g. old request without `return=tolls`).
   */
  tollUsd: number | null
}

/**
 * Sum tolls from HERE Routing v8 response. Per toll system, use minimum USD fare among payment methods.
 * @see https://www.here.com/learn/blog/toll-cost-routing
 */
export function sumTollUsdFromHereRoutesResponse(json: unknown): number | null {
  const routes = (json as { routes?: unknown })?.routes
  if (!Array.isArray(routes) || routes.length === 0) return null
  return sumTollUsdFromHereRoute(routes[0] as Record<string, unknown>)
}

function sumTollUsdFromHereRoute(route: Record<string, unknown>): number | null {
  const sections = route?.sections
  if (!Array.isArray(sections)) return null

  let sawTollsField = false
  let total = 0

  for (const sec of sections) {
    if (sec && typeof sec === "object" && "tolls" in (sec as object)) {
      sawTollsField = true
    }
    const tolls = (sec as { tolls?: unknown })?.tolls
    if (!Array.isArray(tolls)) continue

    for (const toll of tolls) {
      const fares = (toll as { fares?: unknown })?.fares
      if (!Array.isArray(fares)) continue

      let minUsd = Infinity
      for (const fare of fares) {
        const price = (fare as { price?: { type?: string; currency?: string; value?: number } })?.price
        if (price?.type === "value" && typeof price.value === "number" && Number.isFinite(price.value)) {
          const cur = price.currency || "USD"
          if (cur === "USD") {
            minUsd = Math.min(minUsd, price.value)
          }
        }
      }
      if (minUsd !== Infinity) total += minUsd
    }
  }

  // If HERE omits `tolls` on sections but the route exists, treat as $0 (toll-free / not applicable).
  if (!sawTollsField) {
    return sections.length > 0 ? 0 : null
  }
  return Math.round(total * 100) / 100
}

/**
 * HERE Routing v8 — truck mode + toll costs (`return=tolls`).
 * @see https://developer.here.com/documentation/routing-api/dev_guide/topics/request-a-truck-route.html
 */
export async function getHereTruckRoute(params: {
  apiKey: string
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  /** Intermediate stops (HERE `via=`) between origin and destination — truck visits in order */
  via?: Array<{ lat: number; lng: number }>
  grossWeightKg?: number
  axleCount?: number
}): Promise<{ data: HereTruckRouteResult | null; error: string | null }> {
  const { apiKey, origin, destination } = params

  const cacheKey = generateCacheKey("here_truck_route_v1", {
    olat: roundCoord(origin.lat),
    olng: roundCoord(origin.lng),
    dlat: roundCoord(destination.lat),
    dlng: roundCoord(destination.lng),
    via: (params.via ?? []).map((v) => ({ lat: roundCoord(v.lat), lng: roundCoord(v.lng) })),
    gw: params.grossWeightKg && params.grossWeightKg > 0 ? Math.round(params.grossWeightKg) : null,
    ax: params.axleCount && params.axleCount > 0 ? Math.round(params.axleCount) : null,
  })
  const cached = await getCachedApiResult<HereTruckRouteResult>(cacheKey, HERE_TRUCK_ROUTE_CACHE_TTL_SEC)
  if (cached && Array.isArray(cached.path) && cached.path.length >= 2) {
    return { data: cached, error: null }
  }

  const url = new URL("https://router.hereapi.com/v8/routes")
  url.searchParams.set("transportMode", "truck")
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`)
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`)
  if (params.via && params.via.length > 0) {
    for (const v of params.via) {
      url.searchParams.append("via", `${v.lat},${v.lng}`)
    }
  }
  url.searchParams.set("return", "polyline,summary,actions,tolls")
  url.searchParams.set("apikey", apiKey)

  if (params.grossWeightKg && params.grossWeightKg > 0) {
    url.searchParams.set("truck[grossWeight]", String(Math.round(params.grossWeightKg)))
  }
  if (params.axleCount && params.axleCount > 0) {
    url.searchParams.set("truck[axleCount]", String(Math.round(params.axleCount)))
  }

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } })
    if (!res.ok) {
      return { data: null, error: `HERE HTTP ${res.status}` }
    }
    const json = (await res.json()) as Record<string, unknown>
    if (!json.routes || !Array.isArray(json.routes) || json.routes.length === 0) {
      return { data: null, error: (json.error as { message?: string } | undefined)?.message || "No HERE routes returned" }
    }

    const route = json.routes[0] as Record<string, unknown>
    const sections = (route.sections as Array<Record<string, unknown>>) || []
    const points: Array<{ lat: number; lng: number }> = []
    let distanceMeters = 0
    let durationSeconds = 0
    let firstPoly = ""

    for (const sec of sections) {
      if (sec.summary && typeof sec.summary === "object") {
        const s = sec.summary as { length?: number; duration?: number }
        if (s.length != null) distanceMeters += Number(s.length) || 0
        if (s.duration != null) durationSeconds += Number(s.duration) || 0
      }
      const p = sec.polyline
      if (typeof p === "string" && p.length > 0) {
        if (!firstPoly) firstPoly = p
        const decoded = decode(p)
        const poly = decoded.polyline as number[][]
        for (const pair of poly) {
          if (pair.length >= 2) {
            points.push({ lat: pair[0], lng: pair[1] })
          }
        }
      }
    }

    const tollUsd = sumTollUsdFromHereRoutesResponse(json)

    if (points.length < 2) {
      return { data: null, error: "HERE returned empty polyline" }
    }

    const result: HereTruckRouteResult = {
      provider: "here",
      distanceMeters,
      durationSeconds,
      path: points,
      rawPolyline: firstPoly,
      tollUsd,
    }
    await setCachedApiResult(cacheKey, result, HERE_TRUCK_ROUTE_CACHE_TTL_SEC)

    return {
      data: result,
      error: null,
    }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? errorMessage(e) : "HERE routing failed" }
  }
}
