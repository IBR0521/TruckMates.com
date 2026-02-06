/**
 * Polyline encoding/decoding utilities
 * Google Maps uses encoded polylines for route geometry
 */

/**
 * Decode Google Maps encoded polyline
 * Returns array of {lat, lng} points
 */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded) return []

  const points: Array<{ lat: number; lng: number }> = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0

  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5
    })
  }

  return points
}

/**
 * Encode array of points to Google Maps polyline
 */
export function encodePolyline(points: Array<{ lat: number; lng: number }>): string {
  if (points.length === 0) return ""

  let encoded = ""
  let prevLat = 0
  let prevLng = 0

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lng = Math.round(point.lng * 1e5)

    const dLat = lat - prevLat
    const dLng = lng - prevLng

    encoded += encodeValue(dLat)
    encoded += encodeValue(dLng)

    prevLat = lat
    prevLng = lng
  }

  return encoded
}

function encodeValue(value: number): string {
  value = value < 0 ? ~(value << 1) : value << 1
  let encoded = ""

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }

  encoded += String.fromCharCode(value + 63)
  return encoded
}


