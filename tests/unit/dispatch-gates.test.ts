import { describe, expect, it } from "vitest"
import { getDispatchGateErrors, isDispatchStatus, isDispatchTransition } from "../../lib/dispatch-gates"

describe("lib/dispatch-gates.ts", () => {
  it("identifies dispatch statuses", () => {
    expect(isDispatchStatus("scheduled")).toBe(true)
    expect(isDispatchStatus("in_transit")).toBe(true)
    expect(isDispatchStatus("pending")).toBe(false)
  })

  it("requires BOL when setting enabled", () => {
    const errors = getDispatchGateErrors({
      loadId: "load-1",
      nextStatus: "scheduled",
      settings: { require_bol_before_dispatch: true },
      hasBol: false,
      attachedDocumentTypes: [],
    })
    expect(errors).toContain("A Bill of Lading (BOL) is required before dispatching this load.")
  })

  it("passes when BOL exists", () => {
    const errors = getDispatchGateErrors({
      loadId: "load-1",
      nextStatus: "scheduled",
      settings: { require_bol_before_dispatch: true },
      hasBol: true,
      attachedDocumentTypes: [],
    })
    expect(errors).toEqual([])
  })

  it("requires configured document types", () => {
    const errors = getDispatchGateErrors({
      loadId: "load-1",
      nextStatus: "in_transit",
      settings: {
        require_documents_before_dispatch: true,
        required_documents: ["rate_confirmation", "pod"],
      },
      hasBol: true,
      attachedDocumentTypes: ["rate_confirmation"],
    })
    expect(errors[0]).toMatch(/pod/)
  })

  it("ignores gates for non-dispatch statuses", () => {
    const errors = getDispatchGateErrors({
      loadId: "load-1",
      nextStatus: "pending",
      settings: { require_bol_before_dispatch: true },
      hasBol: false,
      attachedDocumentTypes: [],
    })
    expect(errors).toEqual([])
  })

  it("identifies dispatch transitions", () => {
    expect(isDispatchTransition("pending", "scheduled")).toBe(true)
    expect(isDispatchTransition("confirmed", "in_transit")).toBe(true)
    expect(isDispatchTransition("scheduled", "in_transit")).toBe(true)
    expect(isDispatchTransition("scheduled", "scheduled")).toBe(false)
    expect(isDispatchTransition("in_transit", "in_transit")).toBe(false)
    expect(isDispatchTransition("scheduled", "delivered")).toBe(false)
  })

  it("skips BOL gate when already scheduled and status unchanged", () => {
    const errors = getDispatchGateErrors({
      loadId: "load-1",
      currentStatus: "scheduled",
      nextStatus: "scheduled",
      settings: { require_bol_before_dispatch: true },
      hasBol: false,
      attachedDocumentTypes: [],
    })
    expect(errors).toEqual([])
  })
})
