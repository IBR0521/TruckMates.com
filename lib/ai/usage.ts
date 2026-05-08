import { createAdminClient } from "@/lib/supabase/admin"

const MODEL_RATES: Record<string, { input: number; output: number; cachedInput: number }> = {
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

export function calculateCallCost(params: {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}): number {
  const rate = MODEL_RATES[params.model] || MODEL_RATES["claude-sonnet-4-5"]
  const inputCost = (Math.max(0, params.inputTokens) / 1_000_000) * rate.input
  const outputCost = (Math.max(0, params.outputTokens) / 1_000_000) * rate.output
  const cacheReadCost = (Math.max(0, params.cacheReadTokens) / 1_000_000) * rate.cachedInput
  const cacheWriteCost = (Math.max(0, params.cacheWriteTokens) / 1_000_000) * rate.input * 1.25

  return Number((inputCost + outputCost + cacheReadCost + cacheWriteCost).toFixed(6))
}

export async function logAiUsage(params: {
  companyId: string | null
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
  durationMs: number
}): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("ai_usage_logs").insert({
      company_id: params.companyId,
      feature: params.feature,
      model: params.model,
      input_tokens: Math.max(0, Math.round(params.inputTokens)),
      output_tokens: Math.max(0, Math.round(params.outputTokens)),
      cache_read_tokens: Math.max(0, Math.round(params.cacheReadTokens)),
      cache_write_tokens: Math.max(0, Math.round(params.cacheWriteTokens)),
      cost_usd: params.costUsd,
      duration_ms: Math.max(0, Math.round(params.durationMs)),
    })

    if (error) {
      console.error("[AI Usage]", error.message || "Failed to write ai usage log")
    }
  } catch (error) {
    console.error("[AI Usage]", error)
  }
}
