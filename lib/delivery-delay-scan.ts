/** Loads past estimated delivery still active on the road. */
export const DELIVERY_DELAY_ACTIVE_STATUSES = ["scheduled", "in_transit"] as const

export type DelayedLoadRow = {
  id: string
  company_id: string
  shipment_number: string | null
  origin: string | null
  destination: string | null
  status: string | null
  estimated_delivery: string | null
  driver_id: string | null
}

export function isLoadPastEstimatedDelivery(
  estimatedDelivery: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!estimatedDelivery) return false
  const eta = new Date(estimatedDelivery)
  if (Number.isNaN(eta.getTime())) return false
  return eta.getTime() < now.getTime()
}

export function filterDelayedLoads(rows: DelayedLoadRow[], now: Date = new Date()): DelayedLoadRow[] {
  return rows.filter(
    (row) =>
      DELIVERY_DELAY_ACTIVE_STATUSES.includes(
        String(row.status || "").toLowerCase() as (typeof DELIVERY_DELAY_ACTIVE_STATUSES)[number],
      ) && isLoadPastEstimatedDelivery(row.estimated_delivery, now),
  )
}

export function deliveryDelayHoursLate(
  estimatedDelivery: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!estimatedDelivery) return 0
  const eta = new Date(estimatedDelivery)
  if (Number.isNaN(eta.getTime())) return 0
  return Math.max(0, Math.round((now.getTime() - eta.getTime()) / (1000 * 60 * 60)))
}
