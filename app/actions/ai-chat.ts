"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { resolveAiChatPlanContext, type AiChatPlanContext } from "@/lib/ai/plan-context"
import { safeDbError } from "@/lib/utils/error"
import {
  handleChatMessage,
  resumeAssistantAfterToolResolution,
  type AiChatHistoryRow,
  type PersistedToolCall,
  type PersistedToolResult,
} from "@/lib/ai/chat"
import { callClaude } from "@/lib/ai/client"
import { extractPreferenceEntityId, recordActionPreference } from "@/lib/ai/context"
import { confirmTool, rejectTool } from "@/lib/ai/tools/executor"
import { mapLegacyRole } from "@/lib/roles"
import type { AppRole } from "@/lib/ai/tools/types"
import type { PlanTier } from "@/lib/plan-limits"

type ChatRole = "user" | "assistant"

function isChatRole(value: string): value is ChatRole {
  return value === "user" || value === "assistant"
}

export async function assertAiChatAllowed(companyId: string): Promise<
  | ({ ok: true; enableTools: boolean; companyTier: PlanTier; remainingAiCalls: number } & Pick<
      AiChatPlanContext,
      "actionsModeLabel" | "sidebarLockBadge" | "tierLabel"
    >)
  | { ok: false; error: string }
> {
  const plan = await resolveAiChatPlanContext(companyId)
  if (!plan.chatAllowed) {
    return { ok: false, error: "AI assistant is not available on your current plan." }
  }
  return {
    ok: true,
    enableTools: plan.enableTools,
    companyTier: plan.tier,
    remainingAiCalls: plan.remainingAiCalls,
    actionsModeLabel: plan.actionsModeLabel,
    sidebarLockBadge: plan.sidebarLockBadge,
    tierLabel: plan.tierLabel,
  }
}

export async function getAiChatPlanContext(): Promise<{
  data: AiChatPlanContext | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const plan = await resolveAiChatPlanContext(ctx.companyId)
  return { data: plan, error: null }
}

function coerceToolCalls(raw: unknown): PersistedToolCall[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: PersistedToolCall[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const o = entry as Record<string, unknown>
    if (typeof o.id !== "string" || typeof o.name !== "string") continue
    const input =
      o.input && typeof o.input === "object" && !Array.isArray(o.input) ? (o.input as Record<string, unknown>) : {}
    out.push({ id: o.id, name: o.name, input })
  }
  return out.length > 0 ? out : null
}

function coerceToolResults(raw: unknown): PersistedToolResult[] {
  if (!Array.isArray(raw)) return []
  const out: PersistedToolResult[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const o = entry as Record<string, unknown>
    if (typeof o.tool_use_id !== "string" || typeof o.content !== "string") continue
    out.push({
      tool_use_id: o.tool_use_id,
      content: o.content,
      is_error: Boolean(o.is_error),
    })
  }
  return out
}

export async function loadConversationHistory(
  conversationId: string,
  companyId: string,
): Promise<AiChatHistoryRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_chat_messages")
    .select("role, content, tool_calls, tool_results")
    .eq("conversation_id", conversationId)
    .eq("company_id", companyId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })

  if (error) return []

  const rows = (data || []) as Array<{ role: string; content: string; tool_calls?: unknown; tool_results?: unknown }>
  return rows
    .filter((r) => isChatRole(r.role))
    .map((r) => {
      const toolResults = coerceToolResults(r.tool_results)
      return {
        role: r.role as ChatRole,
        content: String(r.content || ""),
        tool_calls: coerceToolCalls(r.tool_calls),
        tool_results: toolResults.length > 0 ? toolResults : null,
      }
    })
}

async function patchAssistantToolResultsByAudit(params: {
  admin: ReturnType<typeof createAdminClient>
  assistantMessageId: string
  auditId: string
  approved: boolean
  result?: unknown
  rejectReason?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await params.admin
    .from("ai_chat_messages")
    .select("tool_results")
    .eq("id", params.assistantMessageId)
    .maybeSingle()

  if (error) return { ok: false, error: safeDbError(error) }

  const list = coerceToolResults((data as { tool_results?: unknown } | null)?.tool_results)
  if (!list.length) return { ok: false, error: "Could not patch tool results." }

  const next = list.map((entry) => {
    try {
      const parsed = JSON.parse(entry.content) as Record<string, unknown>
      if (parsed.pending_user_confirmation === true && String(parsed.audit_id) === params.auditId) {
        if (params.approved) {
          return {
            ...entry,
            content: JSON.stringify({ ok: true, data: params.result }),
            is_error: false,
          }
        }
        return {
          ...entry,
          content: JSON.stringify({
            ok: false,
            rejected: true,
            error: params.rejectReason || "User cancelled.",
          }),
          is_error: true,
        }
      }
    } catch {
      /* keep */
    }
    return entry
  })

  const { error: upErr } = await params.admin.from("ai_chat_messages").update({ tool_results: next }).eq("id", params.assistantMessageId)

  if (upErr) return { ok: false, error: safeDbError(upErr) }
  return { ok: true }
}

async function assertConversationOwner(params: {
  conversationId: string
  companyId: string
  userId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_conversations")
    .select("id, company_id, user_id, archived")
    .eq("id", params.conversationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: safeDbError(error) }
  }
  const row = data as { id?: string; company_id?: string; user_id?: string; archived?: boolean } | null
  if (!row?.id) {
    return { ok: false, error: "Conversation not found." }
  }
  if (row.company_id !== params.companyId || row.user_id !== params.userId) {
    return { ok: false, error: "You do not have access to this conversation." }
  }
  if (row.archived) {
    return { ok: false, error: "This conversation is archived." }
  }
  return { ok: true }
}

export async function getConversations(): Promise<{
  data: Array<{
    id: string
    title: string
    lastMessageAt: string
    messageCount: number
  }> | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_conversations")
    .select("id, title, last_message_at")
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false })
    .limit(20)

  if (error) {
    return { data: null, error: safeDbError(error) }
  }

  const rows = (data || []) as Array<{ id: string; title: string; last_message_at: string }>
  const ids = rows.map((r) => r.id).filter(Boolean)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: countRows, error: countError } = await admin.from("ai_chat_messages").select("conversation_id").in("conversation_id", ids)

    if (countError) {
      return { data: null, error: safeDbError(countError) }
    }
    for (const r of (countRows || []) as Array<{ conversation_id: string }>) {
      const id = String(r.conversation_id || "")
      if (!id) continue
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }

  return {
    error: null,
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      lastMessageAt: r.last_message_at,
      messageCount: counts.get(r.id) || 0,
    })),
  }
}

export async function getConversation(conversationId: string): Promise<{
  data: {
    id: string
    title: string
    messages: Array<{
      id: string
      role: ChatRole
      content: string
      createdAt: string
      toolCalls: PersistedToolCall[] | null
      toolResults: PersistedToolResult[] | null
      pendingToolUseId: string | null
    }>
  } | null
  error: string | null
  meta?: { enableTools: boolean; actionsModeLabel?: string }
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const access = await assertConversationOwner({
    conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { data: conv, error: convError } = await admin.from("ai_conversations").select("id, title").eq("id", conversationId).maybeSingle()

  if (convError) {
    return { data: null, error: safeDbError(convError) }
  }
  const convRow = conv as { id?: string; title?: string } | null
  if (!convRow?.id) {
    return { data: null, error: "Conversation not found." }
  }

  const { data: msgs, error: msgError } = await admin
    .from("ai_chat_messages")
    .select("id, role, content, created_at, tool_calls, tool_results, pending_tool_use_id")
    .eq("conversation_id", conversationId)
    .eq("company_id", ctx.companyId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })

  if (msgError) {
    return { data: null, error: safeDbError(msgError) }
  }

  const messages = ((msgs || []) as Array<{
    id: string
    role: string
    content: string
    created_at: string
    tool_calls?: unknown
    tool_results?: unknown
    pending_tool_use_id?: string | null
  }>)
    .filter((m) => isChatRole(m.role))
    .map((m) => {
      const toolResults = coerceToolResults(m.tool_results)
      return {
        id: m.id,
        role: m.role as ChatRole,
        content: m.content,
        createdAt: m.created_at,
        toolCalls: coerceToolCalls(m.tool_calls),
        toolResults: toolResults.length > 0 ? toolResults : null,
        pendingToolUseId: typeof m.pending_tool_use_id === "string" ? m.pending_tool_use_id : null,
      }
    })

  return {
    error: null,
    meta: { enableTools: gate.enableTools, actionsModeLabel: gate.actionsModeLabel },
    data: {
      id: convRow.id,
      title: String(convRow.title || "New conversation"),
      messages,
    },
  }
}

export async function createConversation(): Promise<{
  data: { id: string } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("ai_conversations")
    .insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      title: "New conversation",
      last_message_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { data: null, error: safeDbError(error) }
  }
  return { data: { id: String((data as { id: string }).id) }, error: null }
}

export async function sendChatMessage(params: {
  conversationId: string
  message: string
  /** When true, request shorter spoken-style replies (voice input). */
  voiceMode?: boolean
}): Promise<{
  data: {
    userMessageId: string
    assistantMessageId: string
    assistantContent: string
    contextUsed: string[]
    pendingConfirmations: Array<{
      auditId: string
      toolName: string
      toolUseId: string
      summary: string
      affected: Array<{ type: string; id: string; label: string }>
    }>
    enableTools: boolean
    actionsModeLabel?: string
  } | null
  error: string | null
  quotaWarning?: boolean
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const text = String(params.message || "").trim()
  if (!text) {
    return { data: null, error: "Message is empty." }
  }

  const access = await assertConversationOwner({
    conversationId: params.conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()

  const conversationHistory = await loadConversationHistory(params.conversationId, ctx.companyId)

  const { data: userInsert, error: userErr } = await admin
    .from("ai_chat_messages")
    .insert({
      conversation_id: params.conversationId,
      company_id: ctx.companyId,
      role: "user",
      content: text,
      context_used: [],
      tokens_used: 0,
      cost_usd: 0,
    })
    .select("id")
    .single()

  if (userErr || !userInsert) {
    return { data: null, error: safeDbError(userErr) }
  }
  const userMessageId = String((userInsert as { id: string }).id)

  const userRole = mapLegacyRole(ctx.user.role) as AppRole

  const ai = await handleChatMessage({
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole,
    companyTier: gate.companyTier,
    conversationId: params.conversationId,
    userMessage: text,
    conversationHistory,
    enableTools: gate.enableTools,
    remainingAiCalls: gate.remainingAiCalls,
    voiceMode: Boolean(params.voiceMode),
  })

  if (ai.error || !ai.data) {
    return { data: null, error: ai.error || "AI failed to respond.", quotaWarning: ai.quotaWarning }
  }

  const tokensUsed = typeof ai.tokensUsed === "number" ? ai.tokensUsed : 0
  const model = typeof ai.model === "string" ? ai.model : null

  const { data: asstInsert, error: asstErr } = await admin
    .from("ai_chat_messages")
    .insert({
      conversation_id: params.conversationId,
      company_id: ctx.companyId,
      role: "assistant",
      content: ai.data.responseText,
      context_used: ai.data.contextUsed,
      tokens_used: tokensUsed,
      cost_usd: 0,
      model,
      tool_calls: ai.data.mergedToolCalls.length > 0 ? ai.data.mergedToolCalls : [],
      tool_results: ai.data.mergedToolResults.length > 0 ? ai.data.mergedToolResults : [],
      pending_tool_use_id: ai.data.firstPendingToolUseId,
    })
    .select("id")
    .single()

  if (asstErr || !asstInsert) {
    return { data: null, error: safeDbError(asstErr), quotaWarning: ai.quotaWarning }
  }

  const assistantMessageId = String((asstInsert as { id: string }).id)

  if (ai.data.auditIdsForMessageLink.length > 0) {
    const { error: auditLinkErr } = await admin
      .from("ai_action_audit")
      .update({ message_id: assistantMessageId })
      .in("id", ai.data.auditIdsForMessageLink)

    if (auditLinkErr) {
      return { data: null, error: safeDbError(auditLinkErr), quotaWarning: ai.quotaWarning }
    }
  }

  const now = new Date().toISOString()
  const { error: convErr } = await admin
    .from("ai_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (convErr) {
    return { data: null, error: safeDbError(convErr), quotaWarning: ai.quotaWarning }
  }

  const priorLen = conversationHistory.filter((r) => r.role === "user").length
  if (priorLen === 0) {
    await generateConversationTitle({ conversationId: params.conversationId })
  }

  return {
    error: null,
    quotaWarning: ai.quotaWarning,
    data: {
      userMessageId,
      assistantMessageId,
      assistantContent: ai.data.responseText,
      contextUsed: ai.data.contextUsed,
      pendingConfirmations: ai.data.pendingConfirmations,
      enableTools: gate.enableTools,
      actionsModeLabel: gate.actionsModeLabel,
    },
  }
}

export async function confirmToolExecution(params: {
  conversationId: string
  auditId: string
  approve: boolean
  rejectReason?: string
}): Promise<{ data: { responseText: string } | null; error: string | null; quotaWarning?: boolean }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }
  if (!gate.enableTools) {
    return { data: null, error: "AI actions require Professional or higher." }
  }

  const access = await assertConversationOwner({
    conversationId: params.conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { data: auditRow, error: auditErr } = await admin
    .from("ai_action_audit")
    .select("id, conversation_id, company_id, user_id, status, message_id, tool_name, tool_input, tool_output, error_message")
    .eq("id", params.auditId)
    .maybeSingle()

  if (auditErr || !auditRow) {
    return { data: null, error: safeDbError(auditErr) || "Audit record not found." }
  }

  const audit = auditRow as {
    conversation_id: string | null
    company_id: string
    user_id: string
    status: string
    message_id: string | null
    tool_name: string | null
    tool_input: Record<string, unknown> | null
    tool_output: unknown
    error_message: string | null
  }

  if (audit.conversation_id !== params.conversationId || audit.company_id !== ctx.companyId || audit.user_id !== ctx.userId) {
    return { data: null, error: "You cannot resolve this action." }
  }

  const userRole = mapLegacyRole(ctx.user.role) as AppRole
  const assistantMessageId = audit.message_id

  /** Idempotent re-approve / re-cancel on already-resolved audit rows. */
  if (audit.status !== "pending_confirmation") {
    if (params.approve && (audit.status === "executed" || audit.status === "auto_executed")) {
      if (assistantMessageId) {
        const patched = await patchAssistantToolResultsByAudit({
          admin,
          assistantMessageId,
          auditId: params.auditId,
          approved: true,
          result: audit.tool_output,
        })
        if (!patched.ok) return { data: null, error: patched.error }
        await admin.from("ai_chat_messages").update({ pending_tool_use_id: null }).eq("id", assistantMessageId)
      }
    } else if (!params.approve && audit.status === "rejected") {
      if (assistantMessageId) {
        const patched = await patchAssistantToolResultsByAudit({
          admin,
          assistantMessageId,
          auditId: params.auditId,
          approved: false,
          rejectReason: params.rejectReason?.trim() || "User cancelled.",
        })
        if (!patched.ok) return { data: null, error: patched.error }
      }
      return { data: { responseText: "Action was already cancelled." }, error: null }
    } else if (audit.status === "failed") {
      if (assistantMessageId) {
        await patchAssistantToolResultsByAudit({
          admin,
          assistantMessageId,
          auditId: params.auditId,
          approved: false,
          rejectReason: audit.error_message || "Action failed.",
        })
      }
      return { data: null, error: audit.error_message || "This action failed previously." }
    } else {
      return { data: null, error: "This action is not awaiting confirmation." }
    }

    const historyReloaded = await loadConversationHistory(params.conversationId, ctx.companyId)
    const resume = await resumeAssistantAfterToolResolution({
      companyId: ctx.companyId,
      conversationHistory: historyReloaded,
      enableTools: gate.enableTools,
      companyTier: gate.companyTier,
      userRole,
      remainingAiCalls: gate.remainingAiCalls,
    })
    if (resume.error || resume.data === null) {
      return { data: null, error: resume.error || "Could not resume assistant." }
    }
    return {
      data: { responseText: resume.data.responseText },
      error: null,
      quotaWarning: resume.quotaWarning,
    }
  }

  if (!assistantMessageId) {
    return { data: null, error: "Assistant message link missing; retry from a new chat turn." }
  }

  let execResult: unknown = null
  if (params.approve) {
    const exec = await confirmTool({
      auditId: params.auditId,
      companyId: ctx.companyId,
      userId: ctx.userId,
      userRole,
    })
    if (!exec.ok) {
      return { data: null, error: exec.error }
    }
    execResult = exec.result
    const patched = await patchAssistantToolResultsByAudit({
      admin,
      assistantMessageId,
      auditId: params.auditId,
      approved: true,
      result: execResult,
    })
    if (!patched.ok) return { data: null, error: patched.error }
  } else {
    const rej = await rejectTool(params.auditId, {
      companyId: ctx.companyId,
      userId: ctx.userId,
      reason: params.rejectReason?.trim() || "User cancelled.",
    })
    if (!rej.ok) return { data: null, error: rej.error }
    const patched = await patchAssistantToolResultsByAudit({
      admin,
      assistantMessageId,
      auditId: params.auditId,
      approved: false,
      rejectReason: params.rejectReason?.trim() || "User cancelled.",
    })
    if (!patched.ok) return { data: null, error: patched.error }
  }

  await admin.from("ai_chat_messages").update({ pending_tool_use_id: null }).eq("id", assistantMessageId)

  // Accumulate the company's approve/reject preference for this tool (+ entity), best-effort.
  if (audit.tool_name) {
    void recordActionPreference({
      companyId: ctx.companyId,
      toolName: audit.tool_name,
      entityId: extractPreferenceEntityId(audit.tool_input),
      outcome: params.approve ? "approved" : "rejected",
    })
  }

  const historyReloaded = await loadConversationHistory(params.conversationId, ctx.companyId)

  const resume = await resumeAssistantAfterToolResolution({
    companyId: ctx.companyId,
    conversationHistory: historyReloaded,
    enableTools: gate.enableTools,
    companyTier: gate.companyTier,
    userRole,
    remainingAiCalls: gate.remainingAiCalls,
  })

  if (resume.error || resume.data === null) {
    return { data: null, error: resume.error || "Follow-up reply failed.", quotaWarning: resume.quotaWarning }
  }

  const resumeTokens = typeof resume.tokensUsed === "number" ? resume.tokensUsed : 0
  const resumeModel = typeof resume.model === "string" ? resume.model : null

  const { error: followErr } = await admin.from("ai_chat_messages").insert({
    conversation_id: params.conversationId,
    company_id: ctx.companyId,
    role: "assistant",
    content: resume.data.responseText,
    context_used: [],
    tokens_used: resumeTokens,
    cost_usd: 0,
    model: resumeModel,
    tool_calls: [],
    tool_results: [],
    pending_tool_use_id: null,
  })

  if (followErr) {
    return { data: null, error: safeDbError(followErr), quotaWarning: resume.quotaWarning }
  }

  const ts = new Date().toISOString()
  await admin
    .from("ai_conversations")
    .update({ last_message_at: ts, updated_at: ts })
    .eq("id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  return {
    data: { responseText: resume.data.responseText },
    error: null,
    quotaWarning: resume.quotaWarning,
  }
}

export async function archiveConversation(conversationId: string): Promise<{
  data: { archived: boolean } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const access = await assertConversationOwner({
    conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from("ai_conversations")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (error) {
    return { data: null, error: safeDbError(error) }
  }
  return { data: { archived: true }, error: null }
}

export async function generateConversationTitle(params: {
  conversationId: string
}): Promise<{ data: { title: string } | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const access = await assertConversationOwner({
    conversationId: params.conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { data: firstUser, error: firstErr } = await admin
    .from("ai_chat_messages")
    .select("content")
    .eq("conversation_id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstErr) {
    return { data: null, error: safeDbError(firstErr) }
  }
  const first = String((firstUser as { content?: string } | null)?.content || "").trim()
  if (!first) {
    return { data: null, error: "No user message to summarize." }
  }

  const system = `Return ONLY a short conversation title (3 to 6 words). No quotes. No punctuation at the end. Title case.`
  const res = await callClaude(system, `User first message:\n${first}`, {
    model: "haiku",
    maxTokens: 32,
    feature: "ai_chat_title",
    companyId: ctx.companyId,
    cacheSystemPrompt: true,
  })

  if (res.error || res.data === null || res.data === undefined) {
    return { data: null, error: res.error || "Title generation failed." }
  }

  let title = String(res.data).replace(/\s+/g, " ").trim()
  title = title.replace(/^["']|["']$/g, "")
  if (title.length > 80) title = `${title.slice(0, 77).trimEnd()}...`

  const { error: upErr } = await admin
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (upErr) {
    return { data: null, error: safeDbError(upErr) }
  }

  return { data: { title }, error: null }
}
