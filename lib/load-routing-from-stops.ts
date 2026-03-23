/**
 * Build a geocodable address for trip planning when the load has multiple delivery points
 * and `loads.destination` is a placeholder like "Multiple Locations".
 */
export type DeliveryPointLike = {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  delivery_number?: number | null
}

/** Single-line address for geocoding (street + city, ST zip). */
export function formatDeliveryPointAddress(point: DeliveryPointLike): string {
  const line1 = (point.address || "").trim()
  const line2 = [point.city, point.state, point.zip].filter(Boolean).join(" ").trim()
  if (line1 && line2) return `${line1}, ${line2}`
  return line1 || line2 || ""
}

/** All delivery stops in stop # order (for full-chain trip planning). */
export function getOrderedDeliveryStopAddresses(points: DeliveryPointLike[] | null | undefined): string[] {
  if (!points?.length) return []
  const sorted = [...points].sort(
    (a, b) => (a.delivery_number ?? 0) - (b.delivery_number ?? 0),
  )
  return sorted.map(formatDeliveryPointAddress).filter(Boolean)
}

/** Prefer last stop by delivery_number (final drop); fallback to last array order. */
export function getLastStopRoutingAddress(points: DeliveryPointLike[] | null | undefined): string {
  const ordered = getOrderedDeliveryStopAddresses(points)
  return ordered.length > 0 ? ordered[ordered.length - 1] : ""
}
