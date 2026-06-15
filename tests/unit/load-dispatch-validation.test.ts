import { describe, expect, it } from "vitest"
import {
  canPromoteToScheduledOnAssign,
  getDispatchApprovalError,
  isLoadStatusTransitionAllowed,
  shouldAttemptAutoDispatchOnReady,
} from "../../lib/load-dispatch-validation"

describe("lib/load-dispatch-validation.ts", () => {
  it("allows promotion from draft, pending, and confirmed", () => {
    expect(canPromoteToScheduledOnAssign("draft")).toBe(true)
    expect(canPromoteToScheduledOnAssign("pending")).toBe(true)
    expect(canPromoteToScheduledOnAssign("confirmed")).toBe(true)
    expect(canPromoteToScheduledOnAssign("scheduled")).toBe(false)
  })

  it("enforces strict transitions when allow_status_skip is false", () => {
    const result = isLoadStatusTransitionAllowed("pending", "in_transit", false)
    expect(result.allowed).toBe(false)
    expect(result.error).toMatch(/Invalid status transition/)
  })

  it("allows status skip for non-terminal loads when enabled", () => {
    const result = isLoadStatusTransitionAllowed("pending", "in_transit", true)
    expect(result.allowed).toBe(true)
    expect(result.error).toBeNull()
  })

  it("blocks changes from completed even when skip is enabled", () => {
    const result = isLoadStatusTransitionAllowed("completed", "pending", true)
    expect(result.allowed).toBe(false)
  })

  it("requires confirmed status before dispatch when approval is enabled", () => {
    expect(getDispatchApprovalError("pending", "scheduled", true)).toMatch(/confirmed/i)
    expect(getDispatchApprovalError("confirmed", "scheduled", true)).toBeNull()
  })

  it("auto-dispatch on ready only for confirmed loads with assignments", () => {
    expect(
      shouldAttemptAutoDispatchOnReady(
        { auto_dispatch_on_ready: true },
        { status: "confirmed", driver_id: "d1", truck_id: "t1" },
        { status: true },
      ),
    ).toBe(true)
    expect(
      shouldAttemptAutoDispatchOnReady(
        { auto_dispatch_on_ready: true },
        { status: "pending", driver_id: "d1", truck_id: "t1" },
        { status: true },
      ),
    ).toBe(false)
  })
})
