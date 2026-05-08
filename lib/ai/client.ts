import type { AiResponse } from "@/lib/ai/types"

type CallClaudeOptions = {
  maxTokens?: number
  expectJson?: boolean
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
  }
  error?: {
    message?: string
  }
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
  options?: { maxTokens?: number; expectJson?: false }
): Promise<AiResponse<string>>
export async function callClaude<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; expectJson?: true }
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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        max_tokens: options.maxTokens ?? 1024,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as AnthropicMessageResponse

    if (!response.ok) {
      const errorMessage =
        payload.error?.message ||
        `Anthropic request failed (${response.status})`

      return { data: null, error: errorMessage }
    }

    const text = extractTextContent(payload)
    const tokensUsed =
      (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0)

    if (process.env.NODE_ENV === "development") {
      console.log("[AI] callClaude usage", {
        model: payload.model || "claude-sonnet-4-20250514",
        inputTokens: payload.usage?.input_tokens || 0,
        outputTokens: payload.usage?.output_tokens || 0,
        tokensUsed,
      })
    }

    if (options.expectJson) {
      const parsed = extractJson(text)
      if (!parsed) {
        return {
          data: null,
          error: "Failed to parse JSON response",
          tokensUsed,
          model: payload.model || "claude-sonnet-4-20250514",
        }
      }

      return {
        data: parsed as T,
        error: null,
        tokensUsed,
        model: payload.model || "claude-sonnet-4-20250514",
      }
    }

    return {
      data: text as T,
      error: null,
      tokensUsed,
      model: payload.model || "claude-sonnet-4-20250514",
    }
  } catch (error: unknown) {
    return { data: null, error: toErrorMessage(error) }
  }
}
