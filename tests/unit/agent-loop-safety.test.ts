import { describe, expect, it } from "vitest"
import {
  REQUIRES_HUMAN_APPROVAL,
  TRIGGER_TO_ACTION_TYPE,
  requiresHumanApprovalForAutonomous,
  resolveActionTypeForTrigger,
} from "@/lib/ai/agent/action-routing"

describe("resolveActionTypeForTrigger", () => {
  it("maps each wired trigger to exactly one executor handler", () => {
    expect(resolveActionTypeForTrigger("idle_time_alert")).toBe("idle_time_alert")
    expect(resolveActionTypeForTrigger("credit_hold")).toBe("credit_hold")
    expect(resolveActionTypeForTrigger("hos_violation_prevention")).toBe("hos_violation_prevention")
  })

  it("returns null for unmapped triggers (no model override possible)", () => {
    expect(resolveActionTypeForTrigger("backhaul_matching")).toBeNull()
    expect(resolveActionTypeForTrigger("churn_risk")).toBeNull()
    expect(resolveActionTypeForTrigger("credit_hold_spoof")).toBeNull()
  })

  it("covers every entry in TRIGGER_TO_ACTION_TYPE", () => {
    for (const [trigger, actionType] of Object.entries(TRIGGER_TO_ACTION_TYPE)) {
      expect(resolveActionTypeForTrigger(trigger)).toBe(actionType)
    }
  })
})

describe("requiresHumanApprovalForAutonomous", () => {
  it("requires approval for messaging and money handlers", () => {
    for (const actionType of [
      "payment_followup",
      "hos_violation_prevention",
      "idle_time_alert",
      "credit_hold",
      "invoice_auto_generation",
    ]) {
      expect(requiresHumanApprovalForAutonomous(actionType)).toBe(true)
      expect(REQUIRES_HUMAN_APPROVAL.has(actionType)).toBe(true)
    }
  })

  it("allows autonomous execution for safe notification handlers", () => {
    expect(requiresHumanApprovalForAutonomous("notification")).toBe(false)
    expect(requiresHumanApprovalForAutonomous("document_expiry_alert")).toBe(false)
    expect(requiresHumanApprovalForAutonomous("detention_clock")).toBe(false)
  })
})
