import { callClaude } from "@/lib/ai/client"
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

export type AiChatContextType = "fleet" | "driver" | "load" | "financial" | "compliance" | "maintenance"

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
  const transcript = recent
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n")

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

const CHAT_REPLY_INSTRUCTIONS = `
You are answering inside TruckMates (fleet TMS). Follow the TruckMates AI rules in your system prompt.
Use ONLY the cached company context blocks attached for factual claims about this carrier.
If the context does not contain enough information, say what is missing and suggest where in TruckMates the user should look.
Keep answers concise and operational.
`.trim()

export async function handleChatMessage(params: {
  companyId: string
  userId: string
  conversationId: string
  userMessage: string
  previousMessages: AiMessage[]
}): Promise<
  AiResponse<{
    responseText: string
    contextUsed: string[]
  }>
> {
  const { contextTypes, reasoning } = await determineRequiredContext({
    userMessage: params.userMessage,
    previousMessages: params.previousMessages,
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

  const history = params.previousMessages.slice(-10)

  const userPrompt = [
    CHAT_REPLY_INSTRUCTIONS,
    "",
    "Latest user message:",
    params.userMessage.trim(),
  ].join("\n")

  const reply = await callClaude(LOGISTICS_SYSTEM_PROMPT, userPrompt, {
    model: "sonnet",
    companyId: params.companyId,
    feature: "ai_chat",
    maxTokens: 2048,
    cacheSystemPrompt: true,
    cacheContext,
    history,
  })

  if (reply.error || reply.data === null || reply.data === undefined) {
    return {
      data: null,
      error: reply.error || "AI reply unavailable",
      quotaWarning: reply.quotaWarning,
    }
  }

  return {
    data: { responseText: String(reply.data), contextUsed: used },
    error: null,
    tokensUsed: reply.tokensUsed,
    model: reply.model,
    quotaWarning: reply.quotaWarning,
  }
}
