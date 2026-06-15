import { describe, expect, it } from "vitest"
import { formatLoadWeight } from "../../lib/format-weight"
import {
  isDispatchNotifyEventEnabled,
  isFirstDispatchTransition,
} from "../../lib/dispatch-notify-settings"

describe("lib/format-weight.ts", () => {
  it("formats lbs from weight field", () => {
    expect(formatLoadWeight({ weight: "45000" }, "lbs")).toBe("45,000 lbs")
  })

  it("formats kg from weight_kg", () => {
    expect(formatLoadWeight({ weight_kg: 20412 }, "kg")).toBe("20,412 kg")
  })

  it("converts to lbs when only kg is stored", () => {
    expect(formatLoadWeight({ weight_kg: 453.592 }, "lbs")).toBe("1,000 lbs")
  })
})

describe("lib/dispatch-notify-settings.ts", () => {
  it("detects first dispatch transition", () => {
    expect(isFirstDispatchTransition("confirmed", "scheduled")).toBe(true)
    expect(isFirstDispatchTransition("scheduled", "in_transit")).toBe(false)
    expect(isFirstDispatchTransition("pending", "delivered")).toBe(false)
  })

  it("defaults dispatch notifications on except route deviation", () => {
    expect(isDispatchNotifyEventEnabled({}, "dispatch")).toBe(true)
    expect(isDispatchNotifyEventEnabled({}, "route_deviation")).toBe(false)
    expect(isDispatchNotifyEventEnabled({ notify_on_route_deviation: true }, "route_deviation")).toBe(true)
  })
})
