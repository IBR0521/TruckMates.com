import { createHash } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

export type ExplainabilityCategory = "hos" | "csa" | "inspection" | "hazmat" | "other"
export type ExplainabilitySource = "chat" | "agent"

export const EXPLAINABILITY_PROMPT_VERSION_CHAT = "chat_v1"
export const EXPLAINABILITY_PROMPT_VERSION_AGENT = "agent_v1"

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function categorizeSafetyCompliance(text: string): ExplainabilityCategory | null {
  const t = String(text || "").toLowerCase()
  if (!t) return null
  if (t.includes("hos") || t.includes("hours of service") || t.includes("rest break") || t.includes("drive time")) return "hos"
  if (t.includes("csa") || t.includes("basi") || t.includes("sms score") || t.includes("safety measurement")) return "csa"
  if (t.includes("inspection") || t.includes("dot inspection") || t.includes("roadside")) return "inspection"
  if (t.includes("hazmat") || t.includes("hazardous") || t.includes("endorsement") || t.includes("placard")) return "hazmat"
  if (t.includes("compliance") || t.includes("violation") || t.includes("fmcsa")) return "other"
  return null
}

/** Pull only the lines most likely to be relevant for safety/compliance reasoning. */
export function extractRelevantDataPointsFromContext(context: string): string[] {
  const lines = String(context || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const keep: string[] = []
  const re = /(hos|hours of service|remaining hos|drive hours|on-duty|duty status|violation|csa|inspection|dot|hazmat|endorsement|cdl|license|permit|registration|ifta|mc|dot number)/i
  for (const line of lines) {
    if (re.test(line)) keep.push(line)
    if (keep.length >= 60) break
  }
  return keep
}

export async function insertExplainabilityRecord(params: {
  companyId: string
  source: ExplainabilitySource
  category: ExplainabilityCategory
  recommendation: string
  dataPoints: Record<string, unknown>
  contextUsed: string[]
  model: string | null
  promptVersion: string
  promptHash: string
  confidence: number | null
  conversationId?: string | null
  messageId?: string | null
  automationType?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from("ai_recommendation_explainability").insert({
    company_id: params.companyId,
    source: params.source,
    category: params.category,
    recommendation: params.recommendation,
    data_points: params.dataPoints,
    context_used: params.contextUsed,
    model: params.model,
    prompt_version: params.promptVersion,
    prompt_hash: params.promptHash,
    confidence: params.confidence,
    conversation_id: params.conversationId ?? null,
    message_id: params.messageId ?? null,
    automation_type: params.automationType ?? null,
  })
}

