import { callClaude } from "@/lib/ai/client"
import { calculateCallCost } from "@/lib/ai/usage"

export type NotificationToScore = {
  id: string
  type: string
  title: string
  body: string
  metadata: Record<string, unknown>
  created_at: string
  related_resource_type: string | null
  related_resource_id: string | null
}

export type ScoringResult = {
  notificationId: string
  priority: "critical" | "high" | "medium" | "low"
  clusterId: string | null
  reasoning: string
  suppress: boolean
}

type ScoringPayload = {
  results: Array<{
    notificationId?: unknown
    priority?: unknown
    clusterId?: unknown
    reasoning?: unknown
    suppress?: unknown
  }>
}

const PRIORITIES = new Set<string>(["critical", "high", "medium", "low"])

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function parseRow(raw: ScoringPayload["results"][number], validIds: Set<string>): ScoringResult | null {
  const notificationId = typeof raw.notificationId === "string" ? raw.notificationId : ""
  if (!notificationId || !validIds.has(notificationId)) return null
  const p = typeof raw.priority === "string" ? raw.priority.toLowerCase() : ""
  if (!PRIORITIES.has(p)) return null
  const priority = p as ScoringResult["priority"]
  let clusterId: string | null = null
  if (raw.clusterId === null) clusterId = null
  else if (typeof raw.clusterId === "string" && isUuid(raw.clusterId)) clusterId = raw.clusterId
  const reasoning = typeof raw.reasoning === "string" ? raw.reasoning.trim().slice(0, 500) : "Prioritized by AI."
  const suppress = Boolean(raw.suppress)
  return { notificationId, priority, clusterId, reasoning, suppress }
}

const SCORER_SYSTEM = `You triage in-app TMS notifications for a trucking carrier dispatcher.
Return ONLY valid JSON with shape: {"results":[{"notificationId":"<uuid>","priority":"critical|high|medium|low","clusterId":"<uuid or null>","reasoning":"<one short sentence>","suppress":<boolean>}]}

Priority rubric:
- critical: action within ~1 hour, safety, or major money exposure (driver no-show, breakdown blocking delivery, invoice very overdue >60d implied in text, violation_alert).
- high: action today (HOS warning, missed pickup confirmation, invoice ~30d overdue, urgent load_update).
- medium: this week (maintenance due soon, license renewal window, routine payment_reminder).
- low: informational (delivered confirmation, payment received, morning_digest).

clusterId: reuse the SAME UUID string for notifications that are operationally one thread (e.g. multiple load_update lines about the same shipment_number from metadata). Otherwise null.

suppress: true only for clear duplicates (same underlying event repeated twice in this batch). Never suppress violation_alert or unique critical safety rows.

You MUST output exactly one result object per input notification id, same ids only, no extras.`

export async function scoreNotificationBatch(params: {
  companyId: string
  notifications: NotificationToScore[]
  companyContext: string
}): Promise<{
  data: ScoringResult[] | null
  error: string | null
  tokensUsed: number
  costUsd: number
}> {
  if (params.notifications.length === 0) {
    return { data: [], error: null, tokensUsed: 0, costUsd: 0 }
  }

  const validIds = new Set(params.notifications.map((n) => n.id))
  const userPayload = JSON.stringify(
    {
      companyContext: params.companyContext,
      notifications: params.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        metadata: n.metadata,
        created_at: n.created_at,
        related_resource_type: n.related_resource_type,
        related_resource_id: n.related_resource_id,
      })),
    },
    null,
    2,
  )

  const res = await callClaude<ScoringPayload>(SCORER_SYSTEM, `Score this batch:\n${userPayload}`, {
    expectJson: true,
    model: "haiku",
    maxTokens: 2048,
    companyId: params.companyId,
    feature: "ai_smart_notification_score",
    cacheSystemPrompt: true,
  })

  const tokensUsed = typeof res.tokensUsed === "number" ? res.tokensUsed : 0
  const inTok = Math.round(tokensUsed * 0.65)
  const outTok = Math.max(0, tokensUsed - inTok)
  const costUsd = calculateCallCost({
    model: "claude-haiku-4-5",
    inputTokens: inTok,
    outputTokens: outTok,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  })

  if (res.error || !res.data) {
    return { data: null, error: res.error || "Scoring failed", tokensUsed, costUsd: 0 }
  }

  const rows = Array.isArray(res.data.results) ? res.data.results : []
  const byId = new Map<string, ScoringResult>()
  for (const row of rows) {
    const one = parseRow(row, validIds)
    if (one) byId.set(one.notificationId, one)
  }

  const merged: ScoringResult[] = params.notifications.map((n) => {
    const found = byId.get(n.id)
    if (found) return found
    return {
      notificationId: n.id,
      priority: "medium",
      clusterId: null,
      reasoning: "Ranked as medium (scoring fallback).",
      suppress: false,
    }
  })

  return { data: merged, error: null, tokensUsed, costUsd }
}
