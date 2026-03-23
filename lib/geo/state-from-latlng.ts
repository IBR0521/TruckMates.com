/**
 * Reverse-geocode lat/lng → US state code using Google Geocoding API.
 * Server-only; uses same pattern as IFTA state crossing (cached per ~100m cell).
 */
const cache = new Map<string, { state_code: string; timestamp: number }>()
const TTL_MS = 24 * 60 * 60 * 1000 // 24h
const PRECISION = 0.05 // ~5km — good enough for state boundaries

function cacheKey(lat: number, lng: number) {
  return `${Math.round(lat / PRECISION)}_${Math.round(lng / PRECISION)}`
}

export async function getStateCodeFromLatLng(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ state_code: string | null; error: string | null }> {
  const key = cacheKey(lat, lng)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.timestamp < TTL_MS) {
    return { state_code: hit.state_code, error: null }
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=administrative_area_level_1`
    const response = await fetch(url, { headers: { Accept: "application/json" } })
    if (!response.ok) {
      return { state_code: null, error: "Geocoding request failed" }
    }
    const data = await response.json()
    if (data.status !== "OK" || !data.results?.length) {
      return { state_code: null, error: data.status || "No geocode result" }
    }
    const result = data.results[0]
    for (const component of result.address_components || []) {
      if (component.types?.includes("administrative_area_level_1")) {
        const code = component.short_name as string
        cache.set(key, { state_code: code, timestamp: Date.now() })
        return { state_code: code, error: null }
      }
    }
    return { state_code: null, error: "State not found" }
  } catch (e: any) {
    return { state_code: null, error: e?.message || "Geocoding error" }
  }
}
