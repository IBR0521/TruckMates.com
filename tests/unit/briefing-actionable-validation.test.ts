import { describe, expect, it } from "vitest"
import {
  sanitizeBriefingSuggestedTools,
  validateBriefingSuggestedTool,
  type BriefingEntityAllowlist,
} from "../../lib/ai/briefing-suggested-tool-validation"
import type { MorningBriefing } from "../../lib/ai/briefing-types"

const loadId = "11111111-1111-4111-8111-111111111111"
const driverId = "22222222-2222-4222-8222-222222222222"

function emptyAllowlist(overrides: Partial<BriefingEntityAllowlist> = {}): BriefingEntityAllowlist {
  return {
    loadIds: new Set<string>(),
    driverIds: new Set<string>(),
    truckIds: new Set<string>(),
    invoiceIds: new Set<string>(),
    maintenanceIds: new Set<string>(),
    customerIds: new Set<string>(),
    ...overrides,
  }
}

describe("lib/ai/briefing-actionable validation", () => {
  it("accepts assign_driver_to_load when ids are in allowlist", () => {
    const allowlist = emptyAllowlist({
      loadIds: new Set([loadId]),
      driverIds: new Set([driverId]),
    })
    const ok = validateBriefingSuggestedTool(
      { tool_name: "assign_driver_to_load", tool_input: { load_id: loadId, driver_id: driverId } },
      allowlist,
    )
    expect(ok?.tool_name).toBe("assign_driver_to_load")
  })

  it("discards hallucinated load_id", () => {
    const allowlist = emptyAllowlist({ driverIds: new Set([driverId]) })
    const ok = validateBriefingSuggestedTool(
      {
        tool_name: "assign_driver_to_load",
        tool_input: { load_id: "99999999-9999-4999-8999-999999999999", driver_id: driverId },
      },
      allowlist,
    )
    expect(ok).toBeNull()
  })

  it("discards read-only analysis tools", () => {
    const allowlist = emptyAllowlist({ loadIds: new Set([loadId]) })
    const ok = validateBriefingSuggestedTool(
      { tool_name: "get_load_profitability_analysis", tool_input: { load_id: loadId } },
      allowlist,
    )
    expect(ok).toBeNull()
  })

  it("accepts update_load_status in_transit when load_id is allowlisted", () => {
    const ok = validateBriefingSuggestedTool(
      { tool_name: "update_load_status", tool_input: { load_id: loadId, new_status: "in_transit" } },
      emptyAllowlist({ loadIds: new Set([loadId]) }),
    )
    expect(ok?.tool_name).toBe("update_load_status")
  })

  it("sanitizeBriefingSuggestedTools strips invalid entries in place", () => {
    const briefing: MorningBriefing = {
      summary: "test",
      critical_alerts: [],
      today_outlook: {
        loads_scheduled: 0,
        loads_in_transit: 0,
        drivers_available: 0,
        drivers_on_duty: 0,
        expected_revenue_today: 0,
        notable_events: [],
      },
      financial_highlights: {
        unpaid_invoices_count: 0,
        unpaid_invoices_total: 0,
        invoices_due_this_week: 0,
        overdue_invoices_count: 0,
        expected_revenue_this_week: 0,
      },
      compliance_warnings: [],
      recommendations: [
        {
          priority: 1,
          title: "Assign driver",
          reasoning: "r",
          estimated_impact: "i",
          suggested_tool: {
            tool_name: "assign_driver_to_load",
            tool_input: { load_id: loadId, driver_id: driverId },
          },
        },
        {
          priority: 2,
          title: "Bad tool",
          reasoning: "r",
          estimated_impact: "i",
          suggested_tool: { tool_name: "not_a_real_tool", tool_input: {} },
        },
      ],
    }
    const stats = sanitizeBriefingSuggestedTools(briefing, emptyAllowlist({ loadIds: new Set([loadId]), driverIds: new Set([driverId]) }))
    expect(stats.validated).toBe(1)
    expect(stats.discarded).toBe(1)
    expect(briefing.recommendations[0].suggested_tool?.tool_name).toBe("assign_driver_to_load")
    expect(briefing.recommendations[1].suggested_tool).toBeNull()
  })
})
