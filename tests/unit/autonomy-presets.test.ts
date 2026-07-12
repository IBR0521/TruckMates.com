import { describe, it, expect } from "vitest"
import { levelForPreset, isAutonomyPreset, AUTONOMY_PRESETS } from "@/lib/ai/agent/autonomy-presets"

/**
 * One-click autopilot presets. The safety-critical property: under "assisted", anything touching
 * money / a customer / an outbound message stays at "approval" (a human signs off), while safe
 * operational automations run themselves.
 */
describe("autonomy presets (one-click autopilot)", () => {
  it("manual puts everything on notify (watch, never act)", () => {
    expect(levelForPreset("load_status_auto_update", "manual")).toBe("notify")
    expect(levelForPreset("invoice_auto_generation", "manual")).toBe("notify")
  })

  it("assisted runs safe operational automations autonomously", () => {
    expect(levelForPreset("load_status_auto_update", "assisted")).toBe("autonomous")
    expect(levelForPreset("detention_clock", "assisted")).toBe("autonomous")
    expect(levelForPreset("document_expiry_alert", "assisted")).toBe("autonomous")
  })

  it("assisted holds money / customer / messaging automations at approval", () => {
    for (const t of ["invoice_auto_generation", "payment_followup", "credit_hold", "driver_assignment", "backhaul_matching", "churn_risk"]) {
      expect(levelForPreset(t, "assisted")).toBe("approval")
    }
  })

  it("autopilot sets everything autonomous (runtime money/messaging gate still applies)", () => {
    expect(levelForPreset("load_status_auto_update", "autopilot")).toBe("autonomous")
    expect(levelForPreset("invoice_auto_generation", "autopilot")).toBe("autonomous")
    expect(levelForPreset("credit_hold", "autopilot")).toBe("autonomous")
  })

  it("validates preset names", () => {
    expect(AUTONOMY_PRESETS).toEqual(["manual", "assisted", "autopilot"])
    expect(isAutonomyPreset("assisted")).toBe(true)
    expect(isAutonomyPreset("full-send")).toBe(false)
    expect(isAutonomyPreset(null)).toBe(false)
  })
})
