import { callClaude } from "@/lib/ai/client"
import {
  callClaudeMessages,
  type ClaudeContentPart,
  type ClaudeMessage,
} from "@/lib/ai/client-messages"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import type { AiMessage, AiResponse } from "@/lib/ai/types"
import {
  getComplianceContext,
  getDriverContext,
  getFinancialContext,
  getFleetContext,
  getLoadContext,
  getMaintenanceContext,
} from "@/lib/ai/context"
import { executeToolForChat as execTool } from "@/lib/ai/tools/executor"
import {
  anthropicToolsFromRegistry,
  getAvailableTools,
  getToolByName,
  toolConfirmationRequired,
} from "@/lib/ai/tools/registry"
import type { AppRole } from "@/lib/ai/tools/types"
import type { PlanTier } from "@/lib/plan-limits"
import { hasFeatureAccess } from "@/lib/plan-limits"

export type AiChatContextType = "fleet" | "driver" | "load" | "financial" | "compliance" | "maintenance"

export type PersistedToolCall = { id: string; name: string; input: Record<string, unknown> }
export type PersistedToolResult = { tool_use_id: string; content: string; is_error?: boolean }

export type AiChatHistoryRow = {
  role: "user" | "assistant"
  content: string
  tool_calls?: PersistedToolCall[] | null
  tool_results?: PersistedToolResult[] | null
}

const ALL_CONTEXT_TYPES: AiChatContextType[] = [
  "fleet",
  "driver",
  "load",
  "financial",
  "compliance",
  "maintenance",
]

const CLASSIFIER_SYSTEM = `You classify logistics questions for a fleet TMS assistant.
Return ONLY valid JSON with keys: "contextTypes" (array of strings) and "reasoning" (short string).
Allowed contextTypes values: fleet, driver, load, financial, compliance, maintenance.
Pick the minimal set needed to answer the user's latest question.`

const MAX_TOOL_ITERATIONS = 5
const MAX_DESTRUCTIVE_PER_TURN = 3
/** Billing: tool turns log multiple `ai_chat_tools` rows (schema + tool_result blocks); expect roughly $0.05–$0.15 USD per user turn on Sonnet when tools run. */

const TOOL_LOOP_GUIDANCE = `
Tool-use rules (Professional+ only):
- Prefer ONE mutation tool per turn unless the user explicitly requested multiple steps.
- Read-only tools (find_best_truck_for_load, find_available_drivers_near_location, get_load_profitability_analysis, get_driver_performance_summary) never require confirmation.
- Mutation tools may return pending_user_confirmation payloads until approved in the UI — acknowledge that plainly.
- Never invent UUIDs; ask for missing identifiers.
`.trim()

const CHAT_REPLY_INSTRUCTIONS = `
You are answering inside TruckMates (fleet TMS). Follow the TruckMates AI rules in your system prompt.
Use ONLY the cached company context blocks attached for factual claims about this carrier.
If the context does not contain enough information, say what is missing and suggest where in TruckMates the user should look.
Keep answers concise and operational.
`.trim()

export function buildClaudeThread(rows: AiChatHistoryRow[]): ClaudeMessage[] {
  const out: ClaudeMessage[] = []
  for (const row of rows) {
    if (row.role === "user") {
      const c = row.content.trim()
      if (c) out.push({ role: "user", content: c })
      continue
    }
    const calls = Array.isArray(row.tool_calls) ? row.tool_calls : []
    const results = Array.isArray(row.tool_results) ? row.tool_results : []
    if (calls.length === 0) {
      if (row.content.trim()) out.push({ role: "assistant", content: row.content.trim() })
      continue
    }
    const assistantParts: ClaudeContentPart[] = []
    if (row.content.trim()) assistantParts.push({ type: "text", text: row.content.trim() })
    for (const c of calls) {
      assistantParts.push({ type: "tool_use", id: c.id, name: c.name, input: c.input })
    }
    out.push({ role: "assistant", content: assistantParts })
    const userParts: ClaudeContentPart[] = results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.tool_use_id,
      content: r.content,
      is_error: r.is_error,
    }))
    if (userParts.length > 0) {
      out.push({ role: "user", content: userParts })
    }
  }
  return out
}

function parseContextTypes(raw: unknown): AiChatContextType[] {
  if (!raw || typeof raw !== "object") return [...ALL_CONTEXT_TYPES]
  const types = (raw as { contextTypes?: unknown }).contextTypes
  if (!Array.isArray(types)) return [...ALL_CONTEXT_TYPES]
  const allowed = new Set<string>(ALL_CONTEXT_TYPES)
  const out: AiChatContextType[] = []
  for (const entry of types) {
    const key = String(entry || "").trim().toLowerCase()
    if (allowed.has(key)) out.push(key as AiChatContextType)
  }
  return out.length > 0 ? out : [...ALL_CONTEXT_TYPES]
}

export async function determineRequiredContext(params: {
  userMessage: string
  previousMessages: AiMessage[]
  companyId: string
}): Promise<{
  contextTypes: AiChatContextType[]
  reasoning: string
}> {
  const recent = params.previousMessages.slice(-6)
  const transcript = recent.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")

  const userBlock = [
    "Latest user message:",
    params.userMessage.trim(),
    "",
    "Recent conversation (may be empty):",
    transcript || "(none)",
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(CLASSIFIER_SYSTEM, userBlock, {
    expectJson: true,
    model: "haiku",
    maxTokens: 256,
    feature: "ai_chat_context",
    companyId: params.companyId,
    cacheSystemPrompt: true,
  })

  if (res.error || !res.data) {
    return { contextTypes: [...ALL_CONTEXT_TYPES], reasoning: "Classifier unavailable; using full context." }
  }

  const reasoning =
    typeof (res.data as { reasoning?: unknown }).reasoning === "string"
      ? String((res.data as { reasoning: string }).reasoning)
      : "classified"

  return {
    contextTypes: parseContextTypes(res.data),
    reasoning,
  }
}

async function gatherContextBlocks(
  companyId: string,
  types: AiChatContextType[],
): Promise<{ text: string; used: string[] }> {
  const jobs: Array<Promise<{ key: AiChatContextType; text: string }>> = []

  for (const t of types) {
    if (t === "fleet") jobs.push(getFleetContext(companyId).then((text) => ({ key: t, text })))
    if (t === "driver") jobs.push(getDriverContext(companyId).then((text) => ({ key: t, text })))
    if (t === "load") jobs.push(getLoadContext(companyId).then((text) => ({ key: t, text })))
    if (t === "financial") jobs.push(getFinancialContext(companyId).then((text) => ({ key: t, text })))
    if (t === "compliance") jobs.push(getComplianceContext(companyId).then((text) => ({ key: t, text })))
    if (t === "maintenance") jobs.push(getMaintenanceContext(companyId).then((text) => ({ key: t, text })))
  }

  const settled = await Promise.all(jobs)
  const used: string[] = []
  const parts: string[] = []
  for (const row of settled) {
    const trimmed = row.text.trim()
    if (!trimmed) continue
    parts.push(trimmed)
    used.push(row.key)
  }

  return { text: parts.join("\n\n"), used }
}

function buildSystemBlocks(enableTools: boolean, cacheContext: string) {
  const mergedPrompt = [LOGISTICS_SYSTEM_PROMPT.trim(), enableTools ? TOOL_LOOP_GUIDANCE : ""].filter(Boolean).join("\n\n")
  return [
    { type: "text" as const, text: mergedPrompt, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: cacheContext, cache_control: { type: "ephemeral" as const } },
  ]
}

function hasAdvancedActionsTier(tier: PlanTier): boolean {
  return hasFeatureAccess(tier, "ai_advanced_actions")
}

export async function handleChatMessage(params: {
  companyId: string
  userId: string
  userRole: AppRole
  companyTier: PlanTier
  conversationId: string
  userMessage: string
  conversationHistory: AiChatHistoryRow[]
  enableTools: boolean
}): Promise<
  AiResponse<{
    responseText: string
    contextUsed: string[]
    toolCallsExecuted: Array<{ name: string; result: unknown }>
    pendingConfirmations: Array<{
      auditId: string
      toolName: string
      toolUseId: string
      summary: string
      affected: Array<{ type: string; id: string; label: string }>
    }>
    mergedToolCalls: PersistedToolCall[]
    mergedToolResults: PersistedToolResult[]
    firstPendingToolUseId: string | null
    auditIdsForMessageLink: string[]
  }>
> {
  const sliceForClassifier: AiMessage[] = params.conversationHistory.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const { contextTypes, reasoning } = await determineRequiredContext({
    userMessage: params.userMessage,
    previousMessages: sliceForClassifier,
    companyId: params.companyId,
  })

  const { text: contextBlock, used } = await gatherContextBlocks(params.companyId, contextTypes)

  const cacheContext = [
    `Conversation: ${params.conversationId}`,
    `User: ${params.userId}`,
    `Context selection reasoning: ${reasoning}`,
    "",
    "=== Grounding context (this company) ===",
    contextBlock || "(no structured context available for the selected domains)",
  ].join("\n")

  const userPrompt = [CHAT_REPLY_INSTRUCTIONS, "", "Latest user message:", params.userMessage.trim()].join("\n")

  const loopMessages: ClaudeMessage[] = [...buildClaudeThread(params.conversationHistory), { role: "user", content: userPrompt }]

  const toolsEligible =
    params.enableTools &&
    hasAdvancedActionsTier(params.companyTier) &&
    getAvailableTools({ userRole: params.userRole, companyTier: params.companyTier }).length > 0

  const toolsDefs = toolsEligible
    ? anthropicToolsFromRegistry(getAvailableTools({ userRole: params.userRole, companyTier: params.companyTier }))
    : undefined

  const systemBlocks = buildSystemBlocks(Boolean(toolsDefs?.length), cacheContext)

  let iterations = 0
  let quotaWarning = false
  let tokensUsedTotal = 0
  let modelLast: string | undefined

  const responsePieces: string[] = []
  const mergedToolCalls: PersistedToolCall[] = []
  const mergedToolResults: PersistedToolResult[] = []
  const pendingConfirmations: Array<{
    auditId: string
    toolName: string
    toolUseId: string
    summary: string
    affected: Array<{ type: string; id: string; label: string }>
  }> = []
  const toolCallsExecuted: Array<{ name: string; result: unknown }> = []
  const auditIdsForMessageLink: string[] = []
  let firstPendingToolUseId: string | null = null

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1

    const reply = await callClaudeMessages({
      systemBlocks,
      messages: loopMessages,
      tools: toolsDefs && toolsDefs.length > 0 ? toolsDefs : undefined,
      toolChoice: toolsDefs && toolsDefs.length > 0 ? { type: "auto" } : undefined,
      maxTokens: toolsDefs && toolsDefs.length > 0 ? 4096 : 2048,
      model: "sonnet",
      companyId: params.companyId,
      feature: toolsDefs && toolsDefs.length > 0 ? "ai_chat_tools" : "ai_chat",
    })

    if (reply.quotaWarning) quotaWarning = true
    if (typeof reply.tokensUsed === "number") tokensUsedTotal += reply.tokensUsed
    if (typeof reply.model === "string") modelLast = reply.model

    if (reply.error || !reply.data) {
      return {
        data: null,
        error: reply.error || "AI reply unavailable",
        quotaWarning,
        tokensUsed: tokensUsedTotal,
        model: modelLast,
      }
    }

    if (reply.data.text.trim()) responsePieces.push(reply.data.text.trim())

    const toolUses = reply.data.toolUses
    if (!toolsDefs || toolsDefs.length === 0 || toolUses.length === 0) {
      break
    }

    const assistantParts: ClaudeContentPart[] = []
    if (reply.data.text.trim()) assistantParts.push({ type: "text", text: reply.data.text.trim() })
    for (const tu of toolUses) {
      assistantParts.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input })
      mergedToolCalls.push({ id: tu.id, name: tu.name, input: tu.input })
    }
    loopMessages.push({ role: "assistant", content: assistantParts })

    const persistedRound: PersistedToolResult[] = []
    const apiToolResults: ClaudeContentPart[] = []
    let destructiveLeft = MAX_DESTRUCTIVE_PER_TURN
    let pausedForConfirmation = false

    for (const tu of toolUses) {
      const known = getToolByName(tu.name)
      const skipConfirmation = known ? !toolConfirmationRequired(known, tu.input) : false

      const outcome = await execTool({
        toolName: tu.name,
        toolInput: tu.input,
        toolUseId: tu.id,
        conversationId: params.conversationId,
        messageId: null,
        companyId: params.companyId,
        userId: params.userId,
        userRole: params.userRole,
        companyTier: params.companyTier,
        skipConfirmation,
        destructiveSlotsRemaining: destructiveLeft,
      })

      auditIdsForMessageLink.push(outcome.auditId)

      if (outcome.status === "pending_confirmation") {
        destructiveLeft -= 1
        pausedForConfirmation = true
        if (!firstPendingToolUseId) firstPendingToolUseId = tu.id
        const summary = outcome.preview?.summary ?? "Awaiting confirmation."
        const affected = outcome.preview?.affected ?? []
        pendingConfirmations.push({
          auditId: outcome.auditId,
          toolName: tu.name,
          toolUseId: tu.id,
          summary,
          affected,
        })
        const body = JSON.stringify({
          pending_user_confirmation: true,
          audit_id: outcome.auditId,
          summary,
          affected,
        })
        persistedRound.push({ tool_use_id: tu.id, content: body })
        apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body })
        continue
      }

      if (outcome.status === "auto_executed" || outcome.status === "executed") {
        toolCallsExecuted.push({ name: tu.name, result: outcome.result })
        const body = JSON.stringify({ ok: true, data: outcome.result })
        persistedRound.push({ tool_use_id: tu.id, content: body })
        apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body })
        continue
      }

      const body = JSON.stringify({ ok: false, error: outcome.error || outcome.status })
      persistedRound.push({ tool_use_id: tu.id, content: body, is_error: true })
      apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body, is_error: true })
    }

    mergedToolResults.push(...persistedRound)
    loopMessages.push({ role: "user", content: apiToolResults })

    if (pausedForConfirmation) {
      break
    }
  }

  const responseText = responsePieces.join("\n\n").trim()

  return {
    data: {
      responseText,
      contextUsed: used,
      toolCallsExecuted,
      pendingConfirmations,
      mergedToolCalls,
      mergedToolResults,
      firstPendingToolUseId,
      auditIdsForMessageLink,
    },
    error: null,
    tokensUsed: tokensUsedTotal,
    model: modelLast,
    quotaWarning,
  }
}

/** Continuation after pending tool rows were resolved in the database. */
export async function resumeAssistantAfterToolResolution(params: {
  companyId: string
  conversationHistory: AiChatHistoryRow[]
  enableTools: boolean
  companyTier: PlanTier
}): Promise<AiResponse<{ responseText: string }>> {
  const cacheContext = [
    "=== Grounding context (this company) ===",
    (await gatherContextBlocks(params.companyId, [...ALL_CONTEXT_TYPES])).text ||
      "(no structured context available for the selected domains)",
  ].join("\n")

  const systemBlocks = buildSystemBlocks(
    params.enableTools && hasAdvancedActionsTier(params.companyTier),
    cacheContext,
  )

  const loopMessages = buildClaudeThread(params.conversationHistory)

  const reply = await callClaudeMessages({
    systemBlocks,
    messages: loopMessages,
    maxTokens: 2048,
    model: "sonnet",
    companyId: params.companyId,
    feature: "ai_chat_resume",
  })

  const text = reply.data?.text.trim() ?? ""
  return {
    data: reply.error ? null : { responseText: text },
    error: reply.error,
    tokensUsed: reply.tokensUsed,
    model: reply.model,
    quotaWarning: reply.quotaWarning,
  }
}
