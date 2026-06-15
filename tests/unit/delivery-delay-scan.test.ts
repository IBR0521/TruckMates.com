import { describe, expect, it } from "vitest"
import {
  deliveryDelayHoursLate,
  filterDelayedLoads,
  isLoadPastEstimatedDelivery,
  type DelayedLoadRow,
} from "../../lib/delivery-delay-scan"

const baseRow = (overrides: Partial<DelayedLoadRow> = {}): DelayedLoadRow => ({
  id: "load-1",
  company_id: "co-1",
  shipment_number: "LD-100",
  origin: "Dallas, TX",
  destination: "Houston, TX",
  status: "in_transit",
  estimated_delivery: "2026-06-10T12:00:00.000Z",
  driver_id: "drv-1",
  ...overrides,
})

describe("lib/delivery-delay-scan.ts", () => {
  it("detects loads past estimated delivery", () => {
    const now = new Date("2026-06-13T12:00:00.000Z")
    expect(isLoadPastEstimatedDelivery("2026-06-10T12:00:00.000Z", now)).toBe(true)
    expect(isLoadPastEstimatedDelivery("2026-06-14T12:00:00.000Z", now)).toBe(false)
    expect(isLoadPastEstimatedDelivery(null, now)).toBe(false)
  })

  it("filters only active delayed loads", () => {
    const now = new Date("2026-06-13T12:00:00.000Z")
    const rows = [
      baseRow(),
      baseRow({ id: "load-2", status: "delivered" }),
      baseRow({ id: "load-3", estimated_delivery: "2026-06-14T12:00:00.000Z" }),
      baseRow({ id: "load-4", status: "scheduled" }),
    ]
    const delayed = filterDelayedLoads(rows, now)
    expect(delayed.map((r) => r.id)).toEqual(["load-1", "load-4"])
  })

  it("computes hours late rounded to whole hours", () => {
    const now = new Date("2026-06-13T15:30:00.000Z")
    expect(deliveryDelayHoursLate("2026-06-13T12:00:00.000Z", now)).toBe(4)
    expect(deliveryDelayHoursLate("2026-06-14T12:00:00.000Z", now)).toBe(0)
  })
})
