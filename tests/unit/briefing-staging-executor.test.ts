import { beforeEach, describe, expect, it, vi } from "vitest"

const insertAuditCalls: Array<Record<string, unknown>> = []

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        insertAuditCalls.push(row)
        return {
          select: () => ({
            single: async () => ({ data: { id: `audit-${insertAuditCalls.length}` }, error: null }),
          }),
        }
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

vi.mock("@/lib/ai/agent/settings", () => ({
  getCompanyAutomationSettings: async () => ({
    data: [{ automationType: "__company_pause_override__", level: "autonomous" }],
  }),
}))

vi.mock("@/lib/ai/tools/handlers", () => ({
  revalidateToolReferences: async () => ({ ok: true as const }),
  getInvoiceIdForLoadOrInvoice: async () => ({ invoiceId: "22222222-2222-4222-8222-222222222222" }),
}))

vi.mock("@/lib/plan-limits", () => ({
  hasFeatureAccess: () => true,
  PLAN_TIER_ORDER: ["owner_operator", "starter", "professional", "fleet", "enterprise"],
}))

const loadId = "11111111-1111-4111-8111-111111111111"
const invoiceId = "22222222-2222-4222-8222-222222222222"

const fakeTools = {
  update_load_status: {
    name: "update_load_status",
    description: "test",
    input_schema: {
      type: "object" as const,
      properties: { load_id: { type: "string" }, new_status: { type: "string" } },
      required: ["load_id", "new_status"],
    },
    requires_confirmation: false,
    allowed_roles: ["operations_manager"],
    minimum_plan_tier: "professional" as const,
    preview: async () => ({
      summary: "Mark load delivered",
      affected: [{ type: "load", id: loadId, label: loadId }],
    }),
    execute: async () => ({ ok: true as const, data: { status: "delivered" } }),
  },
  send_invoice: {
    name: "send_invoice",
    description: "test",
    input_schema: {
      type: "object" as const,
      properties: { invoice_id: { type: "string" }, load_id: { type: "string" } },
      required: [],
    },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: ["operations_manager"],
    minimum_plan_tier: "professional" as const,
    preview: async () => ({
      summary: "Send invoice email",
      affected: [{ type: "invoice", id: invoiceId, label: invoiceId }],
    }),
    execute: async () => ({ ok: true as const, data: { sent: true } }),
  },
  mark_invoice_paid: {
    name: "mark_invoice_paid",
    description: "test",
    input_schema: {
      type: "object" as const,
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
    },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: ["operations_manager"],
    minimum_plan_tier: "professional" as const,
    preview: async () => ({
      summary: "Mark invoice paid",
      affected: [{ type: "invoice", id: invoiceId, label: invoiceId }],
    }),
    execute: async () => ({ ok: true as const, data: { paid: true } }),
  },
}

vi.mock("@/lib/ai/tools/registry", () => ({
  getToolByName: (name: string) => fakeTools[name as keyof typeof fakeTools],
  tierMeetsMinimum: () => true,
}))

import { executeToolForChat } from "@/lib/ai/tools/executor"

describe("executeToolForChat briefing forceConfirmation", () => {
  beforeEach(() => {
    insertAuditCalls.length = 0
  })

  it("update_load_status delivered + forceConfirmation stays pending_confirmation under autonomous mode", async () => {
    const result = await executeToolForChat({
      toolName: "update_load_status",
      toolInput: { load_id: loadId, new_status: "delivered" },
      toolUseId: "tool-1",
      conversationId: "conv-1",
      messageId: null,
      companyId: "company-1",
      userId: "user-1",
      userRole: "operations_manager",
      companyTier: "professional",
      forceConfirmation: true,
      destructiveSlotsRemaining: 3,
    })

    expect(result.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.executed_at).toBeNull()
  })

  it("update_load_status in_transit without forceConfirmation auto_executes under autonomous mode", async () => {
    const result = await executeToolForChat({
      toolName: "update_load_status",
      toolInput: { load_id: loadId, new_status: "in_transit" },
      toolUseId: "tool-2",
      conversationId: "conv-1",
      messageId: null,
      companyId: "company-1",
      userId: "user-1",
      userRole: "operations_manager",
      companyTier: "professional",
      destructiveSlotsRemaining: 3,
    })

    expect(result.status).toBe("auto_executed")
  })

  it("send_invoice stays pending_confirmation under autonomous mode and never auto_executes", async () => {
    const result = await executeToolForChat({
      toolName: "send_invoice",
      toolInput: { invoice_id: invoiceId },
      toolUseId: "tool-3",
      conversationId: "conv-1",
      messageId: null,
      companyId: "company-1",
      userId: "user-1",
      userRole: "operations_manager",
      companyTier: "professional",
      destructiveSlotsRemaining: 3,
    })

    expect(result.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.required_confirmation).toBe(true)
    expect(insertAuditCalls.at(-1)?.executed_at).toBeNull()
  })

  it("mark_invoice_paid stays pending_confirmation and blocks skipConfirmation under autonomous mode", async () => {
    const blocked = await executeToolForChat({
      toolName: "mark_invoice_paid",
      toolInput: { invoice_id: invoiceId },
      toolUseId: "tool-4",
      conversationId: "conv-1",
      messageId: null,
      companyId: "company-1",
      userId: "user-1",
      userRole: "operations_manager",
      companyTier: "professional",
      skipConfirmation: true,
      destructiveSlotsRemaining: 3,
    })

    expect(blocked.status).toBe("blocked")
    expect(blocked.error).toMatch(/cannot auto-run without confirmation|Financial tools/i)

    const pending = await executeToolForChat({
      toolName: "mark_invoice_paid",
      toolInput: { invoice_id: invoiceId },
      toolUseId: "tool-5",
      conversationId: "conv-1",
      messageId: null,
      companyId: "company-1",
      userId: "user-1",
      userRole: "operations_manager",
      companyTier: "professional",
      destructiveSlotsRemaining: 3,
    })

    expect(pending.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.status).toBe("pending_confirmation")
    expect(insertAuditCalls.at(-1)?.executed_at).toBeNull()
  })
})
