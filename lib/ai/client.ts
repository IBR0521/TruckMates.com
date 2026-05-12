import type { AiModel, AiResponse } from "@/lib/ai/types"
import { calculateCallCost, logAiUsage } from "@/lib/ai/usage"
import { checkMonthlyUsage } from "@/lib/plan-enforcement"

type CallClaudeOptions = {
  maxTokens?: number
  expectJson?: boolean
  model?: AiModel
  feature?: string
  companyId?: string
  cacheSystemPrompt?: boolean
  cacheContext?: string
  /** Prior turns (user/assistant only). Latest user turn is `userPrompt`. Max ~10 recommended. */
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

type AnthropicMessageResponse = {
  id?: string
  model?: string
  content?: Array<{
    type?: string
    text?: string
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  error?: {
    message?: string
  }
}

type ClaudeModelName = "claude-haiku-4-5" | "claude-sonnet-4-5"

const MODEL_MAP: Record<AiModel, ClaudeModelName> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-5",
}

const MODEL_RATES: Record<ClaudeModelName, { input: number; output: number; cachedInput: number }> = {
  "claude-haiku-4-5": {
    input: 1.0,
    output: 5.0,
    cachedInput: 0.1,
  },
  "claude-sonnet-4-5": {
    input: 3.0,
    output: 15.0,
    cachedInput: 0.3,
  },
}

function extractTextContent(payload: AnthropicMessageResponse): string {
  return (payload.content || [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
    .trim()
}

function extractJson(text: string): Record<string, unknown> | null {
  const source = text.trim()
  if (!source) return null

  try {
    const parsed = JSON.parse(source)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Continue with substring extraction.
  }

  for (let start = 0; start < source.length; start++) {
    if (source[start] !== "{") continue

    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < source.length; i++) {
      const char = source[i]

      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === "\"") {
        inString = !inString
        continue
      }

      if (inString) continue

      if (char === "{") depth += 1
      if (char === "}") depth -= 1

      if (depth === 0) {
        const candidate = source.slice(start, i + 1)
        try {
          const parsed = JSON.parse(candidate)
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>
          }
        } catch {
          // Keep scanning for the first valid object.
        }
        break
      }
    }
  }

  return null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unknown AI error"
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number
    expectJson?: false
    model?: AiModel
    feature?: string
    companyId?: string
    cacheSystemPrompt?: boolean
    cacheContext?: string
    history?: Array<{ role: "user" | "assistant"; content: string }>
  }
): Promise<AiResponse<string>>
export async function callClaude<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number
    expectJson?: true
    model?: AiModel
    feature?: string
    companyId?: string
    cacheSystemPrompt?: boolean
    cacheContext?: string
    history?: Array<{ role: "user" | "assistant"; content: string }>
  }
): Promise<AiResponse<T>>
export async function callClaude<T = string>(
  systemPrompt: string,
  userPrompt: string,
  options: CallClaudeOptions = {}
): Promise<AiResponse<T>> {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim()
  if (!apiKey) {
    return { data: null, error: "AI unavailable" }
  }

  let quotaWarning = false
  if (options.companyId) {
    const aiUsage = await checkMonthlyUsage({ companyId: options.companyId, usageType: "ai_calls" })
    if (aiUsage.hardCap) {
      return {
        data: null,
        error: "AI quota exceeded for this month. Upgrade to continue.",
      }
    }
    quotaWarning = aiUsage.warningThreshold
  }

  const startedAt = Date.now()
  const routedModel = MODEL_MAP[options.model || "sonnet"]
  const shouldCacheSystemPrompt = options.cacheSystemPrompt !== false
  const cacheContext = String(options.cacheContext || "").trim()
  const feature = String(options.feature || "unknown")
  const companyId = options.companyId ?? null

  const historyMessages = (Array.isArray(options.history) ? options.history : [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.trim() }))

  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...historyMessages,
    { role: "user", content: userPrompt },
  ]

  const systemPayload = shouldCacheSystemPrompt
    ? ([
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
        ...(cacheContext
          ? [
              {
                type: "text",
                text: cacheContext,
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : []),
      ] as Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }>)
    : systemPrompt

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: routedModel,
        system: systemPayload,
        max_tokens: options.maxTokens ?? 1024,
        temperature: 0,
        messages: anthropicMessages,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as AnthropicMessageResponse

    if (!response.ok) {
      const errorMessage =
        payload.error?.message ||
        `Anthropic request failed (${response.status})`

      return { data: null, error: errorMessage, quotaWarning }
    }

    const text = extractTextContent(payload)
    const inputTokens = payload.usage?.input_tokens || 0
    const outputTokens = payload.usage?.output_tokens || 0
    const cacheWriteTokens = payload.usage?.cache_creation_input_tokens || 0
    const cacheReadTokens = payload.usage?.cache_read_input_tokens || 0
    const tokensUsed = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens
    const costUsd = calculateCallCost({
      model: routedModel,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    })
    const durationMs = Date.now() - startedAt
    const expectedCachedInput = MODEL_RATES[routedModel].cachedInput

    if (process.env.NODE_ENV === "development") {
      console.log("[AI] callClaude usage", {
        feature,
        model: payload.model || routedModel,
        inputTokens,
        outputTokens,
        cacheWriteTokens,
        cacheReadTokens,
        expectedCachedInputRatePerM: expectedCachedInput,
        tokensUsed,
        costUsd,
        durationMs,
      })
    }

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

    if (options.expectJson) {
      const parsed = extractJson(text)
      if (!parsed) {
        return {
          data: null,
          error: "Failed to parse JSON response",
          tokensUsed,
          model: payload.model || routedModel,
          quotaWarning,
        }
      }

      return {
        data: parsed as T,
        error: null,
        tokensUsed,
        model: payload.model || routedModel,
        quotaWarning,
      }
    }

    return {
      data: text as T,
      error: null,
      tokensUsed,
      model: payload.model || routedModel,
      quotaWarning,
    }
  } catch (error: unknown) {
    return { data: null, error: toErrorMessage(error) }
  }
}
