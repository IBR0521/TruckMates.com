import { createAdminClient } from "@/lib/supabase/admin"
import { getToolByName, tierMeetsMinimum, toolConfirmationRequired } from "@/lib/ai/tools/registry"
import { getInvoiceIdForLoadOrInvoice, revalidateToolReferences } from "@/lib/ai/tools/handlers"
import { validateToolInputSchema } from "@/lib/ai/tools/validate-input"
import type { AiToolContext, AppRole } from "@/lib/ai/tools/types"
import type { PlanTier } from "@/lib/plan-limits"
import { hasFeatureAccess } from "@/lib/plan-limits"

async function getFirstAffected(
  toolName: string,
  input: Record<string, unknown>,
  companyId: string,
): Promise<{ type: string; id: string } | null> {
  if (toolName === "create_load") return { type: "load", id: "(new)" }
  const loadId = String(input.load_id || input.source_load_id || "")
  if (loadId) return { type: "load", id: loadId }
  if (toolName === "mark_invoice_paid" && input.invoice_id) return { type: "invoice", id: String(input.invoice_id) }
  if (toolName === "send_invoice") {
    const r = await getInvoiceIdForLoadOrInvoice({
      companyId,
      loadId: typeof input.load_id === "string" ? input.load_id : undefined,
      invoiceId: typeof input.invoice_id === "string" ? input.invoice_id : undefined,
    })
    if ("invoiceId" in r) return { type: "invoice", id: r.invoiceId }
  }
  const driverId = String(input.driver_id || "")
  if (driverId) return { type: "driver", id: driverId }
  const truckId = String(input.truck_id || "")
  if (truckId) return { type: "truck", id: truckId }
  const mId = String(input.maintenance_id || "")
  if (mId) return { type: "maintenance", id: mId }
  return null
}

type AuditStatus =
  | "pending_confirmation"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "auto_executed"
  | "blocked"

async function insertAuditRow(params: {
  companyId: string
  userId: string
  conversationId: string
  messageId: string | null
  toolName: string
  toolInput: Record<string, unknown>
  status: AuditStatus
  requiredConfirmation: boolean
  errorMessage?: string | null
  toolOutput?: unknown
  affected: { type: string; id: string } | null
  executedAt: boolean
  confirmedAt: boolean
}): Promise<string> {
  const admin = createAdminClient()
  const payload = {
    company_id: params.companyId,
    user_id: params.userId,
    conversation_id: params.conversationId,
    message_id: params.messageId,
    tool_name: params.toolName,
    tool_input: params.toolInput,
    tool_output: params.toolOutput === undefined ? null : params.toolOutput,
    status: params.status,
    required_confirmation: params.requiredConfirmation,
    confirmed_at: params.confirmedAt ? new Date().toISOString() : null,
    executed_at: params.executedAt ? new Date().toISOString() : null,
    error_message: params.errorMessage ?? null,
    affected_resource_type: params.affected?.type ?? null,
    affected_resource_id: params.affected?.id ?? null,
  }
  const { data, error } = await admin.from("ai_action_audit").insert(payload).select("id").single()
  if (error || !data) {
    throw new Error(error?.message || "Failed to write ai_action_audit")
  }
  return String((data as { id: string }).id)
}

async function updateAuditRow(auditId: string, patch: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient()
  await admin.from("ai_action_audit").update(patch).eq("id", auditId)
}

export async function executeToolForChat(params: {
  toolName: string
  toolInput: Record<string, unknown>
  toolUseId: string
  conversationId: string
  messageId: string | null
  companyId: string
  userId: string
  userRole: AppRole
  companyTier: PlanTier
  skipConfirmation?: boolean
  destructiveSlotsRemaining: number
}): Promise<{
  status: "pending_confirmation" | "executed" | "auto_executed" | "failed" | "blocked"
  auditId: string
  preview?: { summary: string; affected: Array<{ type: string; id: string; label: string }> }
  result?: unknown
  error?: string
}> {
  const ctx: AiToolContext = {
    companyId: params.companyId,
    userId: params.userId,
    userRole: params.userRole,
  }

  const affectedGuess = await getFirstAffected(params.toolName, params.toolInput, params.companyId)

  const tool = getToolByName(params.toolName)
  if (!tool) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      status: "blocked",
      requiredConfirmation: true,
      errorMessage: "Unknown tool.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "blocked", auditId: id, error: "Unknown tool." }
  }

  if (!tool.allowed_roles.includes(params.userRole)) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      status: "blocked",
      requiredConfirmation: toolConfirmationRequired(tool, params.toolInput),
      errorMessage: "Role not allowed for this tool.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "blocked", auditId: id, error: "Your role cannot run this action." }
  }

  if (!tierMeetsMinimum(params.companyTier, tool.minimum_plan_tier)) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      status: "blocked",
      requiredConfirmation: toolConfirmationRequired(tool, params.toolInput),
      errorMessage: "Plan tier too low.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return {
      status: "blocked",
      auditId: id,
      error: `Upgrade to Professional or higher to run "${params.toolName}".`,
    }
  }

  if (!hasFeatureAccess(params.companyTier, "ai_advanced_actions")) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      status: "blocked",
      requiredConfirmation: toolConfirmationRequired(tool, params.toolInput),
      errorMessage: "ai_advanced_actions not enabled for tier.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return {
      status: "blocked",
      auditId: id,
      error: "AI actions require Professional or Fleet (ai_advanced_actions).",
    }
  }

  const validated = validateToolInputSchema(params.toolInput, tool.input_schema)
  if (!validated.ok) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: params.toolInput,
      status: "failed",
      requiredConfirmation: toolConfirmationRequired(tool, params.toolInput),
      errorMessage: validated.error,
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "failed", auditId: id, error: validated.error }
  }

  if (tool.name === "send_invoice") {
    const inv = typeof validated.value.invoice_id === "string" ? validated.value.invoice_id.trim() : ""
    const ld = typeof validated.value.load_id === "string" ? validated.value.load_id.trim() : ""
    if (!inv && !ld) {
      const id = await insertAuditRow({
        companyId: params.companyId,
        userId: params.userId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        toolName: params.toolName,
        toolInput: validated.value,
        status: "failed",
        requiredConfirmation: true,
        errorMessage: "Provide invoice_id or load_id.",
        affected: affectedGuess,
        executedAt: false,
        confirmedAt: false,
      })
      return { status: "failed", auditId: id, error: "Provide invoice_id or load_id." }
    }
  }

  const needsConfirmation = toolConfirmationRequired(tool, validated.value)

  if (needsConfirmation && params.skipConfirmation) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: "blocked",
      requiredConfirmation: true,
      errorMessage: "Confirmation bypass rejected for this tool.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "blocked", auditId: id, error: "This tool cannot auto-run without confirmation." }
  }

  if (needsConfirmation && params.destructiveSlotsRemaining <= 0) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: "blocked",
      requiredConfirmation: true,
      errorMessage: "Exceeded maximum destructive tool calls for this turn (3).",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return {
      status: "blocked",
      auditId: id,
      error: "Too many destructive actions in one message (max 3). Split your request.",
    }
  }

  if (tool.force_confirmation && params.skipConfirmation) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: "blocked",
      requiredConfirmation: true,
      errorMessage: "Financial tools cannot skip confirmation.",
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "blocked", auditId: id, error: "Financial tools always require confirmation." }
  }

  if (needsConfirmation && !params.skipConfirmation) {
    const preview = await tool.preview(validated.value, ctx)
    const persistedInput = preview.draftInput ?? validated.value
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: persistedInput,
      status: "pending_confirmation",
      requiredConfirmation: true,
      affected: preview.affected[0] ? { type: preview.affected[0].type, id: preview.affected[0].id } : affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return {
      status: "pending_confirmation",
      auditId: id,
      preview: { summary: preview.summary, affected: preview.affected },
    }
  }

  const rev = await revalidateToolReferences(tool.name, validated.value, ctx)
  if (!rev.ok) {
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: "failed",
      requiredConfirmation: needsConfirmation,
      errorMessage: rev.error,
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "failed", auditId: id, error: rev.error }
  }

  try {
    const execRes = await tool.execute(validated.value, ctx)
    if (!execRes.ok) {
      const id = await insertAuditRow({
        companyId: params.companyId,
        userId: params.userId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        toolName: params.toolName,
        toolInput: validated.value,
        status: "failed",
        requiredConfirmation: needsConfirmation,
        errorMessage: execRes.error,
        affected: affectedGuess,
        executedAt: false,
        confirmedAt: false,
      })
      return { status: "failed", auditId: id, error: execRes.error }
    }

    const auto = !needsConfirmation
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: auto ? "auto_executed" : "executed",
      requiredConfirmation: needsConfirmation,
      toolOutput: execRes.data,
      affected: affectedGuess,
      executedAt: true,
      confirmedAt: !needsConfirmation,
    })

    return {
      status: auto ? "auto_executed" : "executed",
      auditId: id,
      result: execRes.data,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Tool execution error"
    const id = await insertAuditRow({
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      toolName: params.toolName,
      toolInput: validated.value,
      status: "failed",
      requiredConfirmation: needsConfirmation,
      errorMessage: msg,
      affected: affectedGuess,
      executedAt: false,
      confirmedAt: false,
    })
    return { status: "failed", auditId: id, error: msg }
  }
}

export async function confirmTool(params: {
  auditId: string
  companyId: string
  userId: string
  userRole: AppRole
}): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_action_audit")
    .select("id, company_id, user_id, tool_name, tool_input, status")
    .eq("id", params.auditId)
    .maybeSingle()

  if (error || !data) return { ok: false, error: "Audit row not found." }
  const row = data as {
    company_id: string
    user_id: string
    tool_name: string
    tool_input: Record<string, unknown>
    status: string
  }
  if (row.company_id !== params.companyId || row.user_id !== params.userId) {
    return { ok: false, error: "Not authorized for this audit record." }
  }
  if (row.status !== "pending_confirmation") {
    return { ok: false, error: "This action is not awaiting confirmation." }
  }

  const tool = getToolByName(row.tool_name)
  if (!tool) return { ok: false, error: "Tool no longer exists." }

  const validated = validateToolInputSchema(row.tool_input, tool.input_schema)
  if (!validated.ok) return { ok: false, error: validated.error }

  const ctx: AiToolContext = {
    companyId: params.companyId,
    userId: params.userId,
    userRole: params.userRole,
  }

  const rev = await revalidateToolReferences(tool.name, validated.value, ctx)
  if (!rev.ok) {
    await updateAuditRow(params.auditId, {
      status: "failed",
      error_message: rev.error,
      executed_at: null,
    })
    return { ok: false, error: rev.error }
  }

  try {
    const execRes = await tool.execute(validated.value, ctx)
    if (!execRes.ok) {
      await updateAuditRow(params.auditId, {
        status: "failed",
        error_message: execRes.error,
        executed_at: new Date().toISOString(),
      })
      return { ok: false, error: execRes.error }
    }

    await updateAuditRow(params.auditId, {
      status: "executed",
      confirmed_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      tool_output: execRes.data as never,
      error_message: null,
    })

    return { ok: true, result: execRes.data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Execution failed"
    await updateAuditRow(params.auditId, {
      status: "failed",
      error_message: msg,
      executed_at: new Date().toISOString(),
    })
    return { ok: false, error: msg }
  }
}

export async function rejectTool(auditId: string, params: { companyId: string; userId: string; reason: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_action_audit")
    .select("id, company_id, user_id, status")
    .eq("id", auditId)
    .maybeSingle()

  if (error || !data) return { ok: false, error: "Audit row not found." }
  const row = data as { company_id: string; user_id: string; status: string }
  if (row.company_id !== params.companyId || row.user_id !== params.userId) {
    return { ok: false, error: "Not authorized." }
  }
  if (row.status !== "pending_confirmation") {
    return { ok: false, error: "Not awaiting confirmation." }
  }

  await updateAuditRow(auditId, {
    status: "rejected",
    error_message: params.reason,
    executed_at: null,
  })
  return { ok: true }
}
