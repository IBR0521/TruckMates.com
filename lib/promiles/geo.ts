/** Earth radius in miles */
const R_MI = 3958.7613

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R_MI * c
}

/** Decimate to at most `max` points (keep endpoints). */
export function decimatePoints<T extends { lat: number; lng: number }>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  if (max < 2) return points.slice(0, 1)
  const step = (points.length - 1) / (max - 1)
  const out: T[] = []
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step)
    out.push(points[Math.min(idx, points.length - 1)])
  }
  return out
}
