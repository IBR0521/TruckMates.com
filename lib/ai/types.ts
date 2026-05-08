export type AiMessage = {
  role: "user" | "assistant"
  content: string
}

export type AiResponse<T> = {
  data: T | null
  error: string | null
  tokensUsed?: number
  model?: string
}

export type AiModel = "haiku" | "sonnet"

export interface AiUsageRecord {
  id: string
  companyId: string | null
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
  durationMs: number
  createdAt: string
}

export type AutomationLevel = "off" | "notify" | "approval" | "autonomous"

export type AgentAction = {
  type: string
  companyId: string
  triggeredBy: string
  payload: Record<string, unknown>
  confidence: number
  reasoning: string
  automationLevel: AutomationLevel
  reversible: boolean
}

export type AgentDecision = {
  shouldAct: boolean
  action: AgentAction | null
  confidence: number
  reasoning: string
}
