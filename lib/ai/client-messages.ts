import type { AiModel, AiResponse } from "@/lib/ai/types"
import { calculateCallCost, logAiUsage } from "@/lib/ai/usage"
import { checkMonthlyUsage } from "@/lib/plan-enforcement"

const MODEL_MAP: Record<AiModel, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-5",
}

export type ClaudeToolDefinition = {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type ClaudeContentPart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }

export type ClaudeMessage = {
  role: "user" | "assistant"
  content: string | ClaudeContentPart[]
}

function serializeMessageContent(content: string | ClaudeContentPart[]): string | unknown[] {
  if (typeof content === "string") return content
  return content.map((part) => {
    if (part.type === "tool_result") {
      const row: Record<string, unknown> = {
        type: "tool_result",
        tool_use_id: part.tool_use_id,
        content: part.content,
      }
      if (part.is_error) row.is_error = true
      return row
    }
    return part
  })
}

type ApiAssistantPayload = {
  content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>
}

function parseAssistantPayload(payload: ApiAssistantPayload): {
  text: string
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>
} {
  const blocks = payload.content || []
  const texts: string[] = []
  const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
  for (const b of blocks) {
    if (b.type === "text" && typeof b.text === "string") texts.push(b.text)
    if (b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string") {
      const rawIn = b.input
      const input =
        rawIn && typeof rawIn === "object" && !Array.isArray(rawIn)
          ? (rawIn as Record<string, unknown>)
          : {}
      toolUses.push({ id: b.id, name: b.name, input })
    }
  }
  return { text: texts.join("\n").trim(), toolUses }
}

type MessagesApiResponse = {
  id?: string
  model?: string
  stop_reason?: string
  content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  error?: { message?: string }
}

export async function callClaudeMessages(params: {
  systemBlocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> | string
  messages: ClaudeMessage[]
  tools?: ClaudeToolDefinition[]
  toolChoice?: { type: "auto" | "any" | "tool"; name?: string }
  maxTokens?: number
  model?: AiModel
  companyId?: string
  feature?: string
}): Promise<
  AiResponse<{
    text: string
    toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>
    stopReason: string | null
    rawModel?: string
  }>
> {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim()
  if (!apiKey) return { data: null, error: "AI unavailable" }

  let quotaWarning = false
  const companyId = params.companyId ?? null
  if (companyId) {
    const aiUsage = await checkMonthlyUsage({ companyId, usageType: "ai_calls" })
    if (aiUsage.hardCap) return { data: null, error: "AI quota exceeded for this month. Upgrade to continue." }
    quotaWarning = aiUsage.warningThreshold
  }

  const routedModel = MODEL_MAP[params.model || "sonnet"]
  const feature = String(params.feature || "unknown")

  const systemPayload =
    typeof params.systemBlocks === "string"
      ? params.systemBlocks
      : params.systemBlocks.length > 0
        ? params.systemBlocks
        : ""

  const body: Record<string, unknown> = {
    model: routedModel,
    max_tokens: params.maxTokens ?? 4096,
    temperature: 0,
    system: systemPayload,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: serializeMessageContent(m.content),
    })),
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }))
    body.tool_choice = params.toolChoice || { type: "auto" }
  }

  const startedAt = Date.now()

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => ({}))) as MessagesApiResponse

    if (!response.ok) {
      return {
        data: null,
        error: payload.error?.message || `Anthropic request failed (${response.status})`,
        quotaWarning,
      }
    }

    const parsed = parseAssistantPayload({ content: payload.content })

    const inputTokens = payload.usage?.input_tokens || 0
    const outputTokens = payload.usage?.output_tokens || 0
    const cacheWriteTokens = payload.usage?.cache_creation_input_tokens || 0
    const cacheReadTokens = payload.usage?.cache_read_input_tokens || 0
    const tokensUsed = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens
    const costUsd = calculateCallCost({
      model: routedModel as "claude-haiku-4-5" | "claude-sonnet-4-5",
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    })
    const durationMs = Date.now() - startedAt

    void logAiUsage({
      companyId,
      feature,
      model: payload.model || routedModel,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd,
      durationMs,
    })

    return {
      data: {
        text: parsed.text,
        toolUses: parsed.toolUses,
        stopReason: payload.stop_reason ?? null,
        rawModel: payload.model || routedModel,
      },
      error: null,
      tokensUsed,
      model: payload.model || routedModel,
      quotaWarning,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown AI error"
    return { data: null, error: msg, quotaWarning }
  }
}
