/**
 * Client-side geofence hit tests (mirrors logic in app/actions/geofencing.ts).
 * Used by the telemetry geofence cron — PostGIS RPC is not used here to keep batch jobs simple.
 *
 * Accuracy note: sparse telemetry can miss short transits through a zone.
 */

export type GeofencePolygonCoordinate =
  | { lat: number; lng: number }
  | { latitude: number; longitude: number }
  | [number, number]

export type GeofenceShape = {
  zone_type: string
  center_latitude?: number | null
  center_longitude?: number | null
  radius_meters?: number | null
  polygon_coordinates?: GeofencePolygonCoordinate[] | null
  north_bound?: number | null
  south_bound?: number | null
  east_bound?: number | null
  west_bound?: number | null
}

export function pointInsideGeofence(lat: number, lng: number, geofence: GeofenceShape): boolean {
  if (geofence.zone_type === "circle") {
    const clat = geofence.center_latitude
    const clng = geofence.center_longitude
    const r = geofence.radius_meters
    if (clat == null || clng == null || r == null) return false
    const R = 6371000
    const dLat = ((lat - clat) * Math.PI) / 180
    const dLon = ((lng - clng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((clat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    return distance <= r
  }

  if (geofence.zone_type === "rectangle") {
    const nb = geofence.north_bound
    const sb = geofence.south_bound
    const eb = geofence.east_bound
    const wb = geofence.west_bound
    if (nb == null || sb == null || eb == null || wb == null) return false
    return lat >= sb && lat <= nb && lng >= wb && lng <= eb
  }

  if (geofence.zone_type === "polygon") {
    const poly = geofence.polygon_coordinates
    if (!poly || !Array.isArray(poly) || poly.length < 3) return false
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const coordI = poly[i]
      const coordJ = poly[j]
      const xi =
        typeof coordI === "object" && "lng" in coordI
          ? coordI.lng
          : Array.isArray(coordI)
            ? coordI[1]
            : coordI.longitude
      const yi =
        typeof coordI === "object" && "lat" in coordI
          ? coordI.lat
          : Array.isArray(coordI)
            ? coordI[0]
            : coordI.latitude
      const xj =
        typeof coordJ === "object" && "lng" in coordJ
          ? coordJ.lng
          : Array.isArray(coordJ)
            ? coordJ[1]
            : coordJ.longitude
      const yj =
        typeof coordJ === "object" && "lat" in coordJ
          ? coordJ.lat
          : Array.isArray(coordJ)
            ? coordJ[0]
            : coordJ.latitude
      const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  return false
}
