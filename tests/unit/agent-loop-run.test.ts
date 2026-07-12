import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Gating tests for runAgentEvaluation — the safety enforcement that decides whether an AI
 * automation only logs, notifies, queues an approval, or auto-executes. The pure routing maps are
 * covered in agent-loop-safety.test.ts; this file exercises the loop's branch behaviour with all
 * IO mocked.
 */

const h = vi.hoisted(() => ({
  callClaude: vi.fn(),
  executeAgentAction: vi.fn(),
  getAutomationConfig: vi.fn(),
  createPendingApproval: vi.fn(),
  logAutomationEvent: vi.fn(),
  sendPush: vi.fn(),
  checkFeatureAccess: vi.fn(),
}))

vi.mock("@/lib/ai/client", () => ({ callClaude: h.callClaude }))
vi.mock("@/lib/ai/agent/executor", () => ({ executeAgentAction: h.executeAgentAction }))
vi.mock("@/lib/ai/agent/settings", () => ({
  getAutomationConfig: h.getAutomationConfig,
  createPendingApproval: h.createPendingApproval,
  logAutomationEvent: h.logAutomationEvent,
}))
vi.mock("@/app/actions/push-notifications", () => ({ sendPushToCompanyRoles: h.sendPush }))
vi.mock("@/lib/plan-enforcement", () => ({ checkFeatureAccess: h.checkFeatureAccess }))
vi.mock("@/lib/ai/context", () => ({
  getComplianceContext: vi.fn(async () => ""),
  getDriverContext: vi.fn(async () => ""),
  getFinancialContext: vi.fn(async () => ""),
  getFleetContext: vi.fn(async () => ""),
  getLoadContext: vi.fn(async () => ""),
  getMaintenanceContext: vi.fn(async () => ""),
}))
vi.mock("@/lib/ai/model-router", () => ({ chooseAgentDecisionModel: () => "sonnet" }))
vi.mock("@/lib/ai/prompts/system", () => ({ LOGISTICS_SYSTEM_PROMPT: "system-prompt" }))
vi.mock("@/lib/ai/explainability", () => ({
  categorizeSafetyCompliance: () => null,
  EXPLAINABILITY_PROMPT_VERSION_AGENT: 1,
  insertExplainabilityRecord: vi.fn(async () => {}),
  sha256: () => "hash",
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    // Chainable stub for findRecentDuplicateEvent; resolves to "no duplicate".
    const chain: Record<string, unknown> = {}
    for (const m of ["from", "select", "eq", "gte", "order"]) chain[m] = () => chain
    chain.limit = () => Promise.resolve({ data: [], error: null })
    return chain
  },
}))

import { runAgentEvaluation } from "@/lib/ai/agent/loop"

function config(level: string, confidenceThreshold = 70, enabled = true) {
  return { data: { enabled, level, confidenceThreshold, config: {} }, error: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getAutomationConfig.mockResolvedValue(config("autonomous"))
  h.callClaude.mockResolvedValue({
    data: { shouldAct: true, confidence: 95, reasoning: "act", actionPayload: {} },
    error: null,
    model: "sonnet",
  })
  h.executeAgentAction.mockResolvedValue({ success: true, result: "ok", error: null })
  h.createPendingApproval.mockResolvedValue({ data: { id: "approval-1" }, error: null })
  h.logAutomationEvent.mockResolvedValue(undefined)
  h.sendPush.mockResolvedValue(undefined)
  h.checkFeatureAccess.mockResolvedValue({ allowed: true })
})

const run = (trigger: string, triggerData: Record<string, unknown> = {}) =>
  runAgentEvaluation({ companyId: "c1", trigger, triggerData, contextTypes: [] })

describe("runAgentEvaluation gating", () => {
  it("does not act or call the model when the automation is disabled", async () => {
    h.getAutomationConfig.mockResolvedValue(config("autonomous", 70, false))
    const r = await run("document_expiry_alert")
    expect(r.executed).toBe(false)
    expect(h.callClaude).not.toHaveBeenCalled()
    expect(h.executeAgentAction).not.toHaveBeenCalled()
  })

  it("does not act when confidence is below the configured threshold", async () => {
    h.getAutomationConfig.mockResolvedValue(config("autonomous", 90))
    h.callClaude.mockResolvedValue({
      data: { shouldAct: true, confidence: 50, reasoning: "weak", actionPayload: {} },
      error: null,
      model: "sonnet",
    })
    const r = await run("document_expiry_alert")
    expect(r.decision.shouldAct).toBe(false)
    expect(h.executeAgentAction).not.toHaveBeenCalled()
  })

  it("notify level pushes but never executes", async () => {
    h.getAutomationConfig.mockResolvedValue(config("notify"))
    const r = await run("document_expiry_alert")
    expect(r.executed).toBe(false)
    expect(h.sendPush).toHaveBeenCalled()
    expect(h.executeAgentAction).not.toHaveBeenCalled()
  })

  it("approval level queues a pending approval and does not execute", async () => {
    h.getAutomationConfig.mockResolvedValue(config("approval"))
    const r = await run("driver_assignment")
    expect(r.executed).toBe(false)
    expect(r.pendingApprovalId).toBe("approval-1")
    expect(h.createPendingApproval).toHaveBeenCalled()
    expect(h.executeAgentAction).not.toHaveBeenCalled()
  })

  it("autonomous + money/messaging action is forced to approval, never auto-executed", async () => {
    // payment_followup is in REQUIRES_HUMAN_APPROVAL.
    const r = await run("payment_followup")
    expect(h.executeAgentAction).not.toHaveBeenCalled()
    expect(h.createPendingApproval).toHaveBeenCalled()
    expect(r.executed).toBe(false)
  })

  it("autonomous + safe action executes when the plan allows it", async () => {
    const r = await run("document_expiry_alert")
    expect(h.checkFeatureAccess).toHaveBeenCalled()
    expect(h.executeAgentAction).toHaveBeenCalledTimes(1)
    expect(r.executed).toBe(true)
  })

  it("autonomous downgrades to approval when the plan lacks the autonomous-agent feature", async () => {
    h.checkFeatureAccess.mockResolvedValue({ allowed: false })
    const r = await run("document_expiry_alert")
    expect(h.executeAgentAction).not.toHaveBeenCalled()
    expect(h.createPendingApproval).toHaveBeenCalled()
    expect(r.executed).toBe(false)
  })
})
