import { decimatePoints, haversineMiles } from "./geo"
import { getStateCodeFromLatLng } from "@/lib/geo/state-from-latlng"

export type StateMileRow = { state_code: string; miles: number }

/**
 * Estimate miles per state by walking the polyline, segmenting by midpoint state.
 * Uses Google Geocoding (state only) at segment midpoints — cached; decimated for cost control.
 */
export async function estimateStateMilesFromLatLngPath(
  path: Array<{ lat: number; lng: number }>,
  googleMapsApiKey: string,
  options?: { maxPoints?: number }
): Promise<{ rows: StateMileRow[]; totalMiles: number; error?: string }> {
  if (!path || path.length < 2) {
    return { rows: [], totalMiles: 0, error: "Path too short" }
  }

  const maxPoints = options?.maxPoints ?? 120
  const pts = decimatePoints(path, Math.min(maxPoints, path.length))

  const byState = new Map<string, number>()
  let totalMiles = 0

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const segMi = haversineMiles(a, b)
    if (!Number.isFinite(segMi) || segMi <= 0) continue
    totalMiles += segMi

    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
    const { state_code, error } = await getStateCodeFromLatLng(mid.lat, mid.lng, googleMapsApiKey)
    if (!state_code) {
      console.warn("[ProMiles] segment state unknown:", error, mid)
      continue
    }
    byState.set(state_code, (byState.get(state_code) || 0) + segMi)
  }

  const rows: StateMileRow[] = Array.from(byState.entries())
    .map(([state_code, miles]) => ({ state_code, miles: Math.round(miles * 10) / 10 }))
    .sort((x, y) => y.miles - x.miles)

  return { rows, totalMiles: Math.round(totalMiles * 10) / 10 }
}
