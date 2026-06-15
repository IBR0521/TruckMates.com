import { describe, expect, it } from "vitest"
import {
  isCheckCallNotifyEventEnabled,
  resolveCheckCallCompletedEvents,
} from "../../lib/check-call-notify-events"
import { resolveEffectiveAutoAssignSettings } from "../../lib/operations-auto-assign-settings"

describe("lib/check-call-notify-events.ts", () => {
  it("requires master customer toggle for sub-events", () => {
    expect(
      isCheckCallNotifyEventEnabled(
        { check_call_notify_customer: false, check_call_notify_on_trip_start: true },
        "trip_start",
      ),
    ).toBe(false)
    expect(
      isCheckCallNotifyEventEnabled(
        { check_call_notify_customer: true, check_call_notify_on_trip_start: true },
        "trip_start",
      ),
    ).toBe(true)
  })

  it("maps pickup completion to shipper and pickup events", () => {
    const events = resolveCheckCallCompletedEvents("pickup")
    expect(events).toContain("at_shipper")
    expect(events).toContain("pickup_completed")
  })

  it("maps scheduled calls to enroute", () => {
    expect(resolveCheckCallCompletedEvents("scheduled")).toEqual(["enroute"])
  })
})

describe("lib/operations-auto-assign-settings.ts", () => {
  it("manual dispatch assignment method disables auto-assign priority", () => {
    const effective = resolveEffectiveAutoAssignSettings({
      driver_assignment_method: "manual",
      auto_assign_driver: true,
      assignment_priority: "proximity",
    })
    expect(effective.assignment_priority).toBe("manual")
  })

  it("uses dispatch max_assignment_distance when load max is unset", () => {
    const effective = resolveEffectiveAutoAssignSettings({
      driver_assignment_method: "auto",
      consider_driver_proximity: true,
      max_assignment_distance: 75,
    })
    expect(effective.max_distance_for_auto_assign).toBe(75)
  })

  it("disables distance filter when proximity is off", () => {
    const effective = resolveEffectiveAutoAssignSettings({
      driver_assignment_method: "auto",
      consider_driver_proximity: false,
      max_distance_for_auto_assign: 50,
    })
    expect(effective.max_distance_for_auto_assign).toBe(0)
  })
})
