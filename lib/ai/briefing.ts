import { callClaude } from "@/lib/ai/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage } from "@/lib/error-message"
import {
  getComplianceContext,
  getDriverContext,
  getFinancialContext,
  getFleetContext,
  getLoadContext,
  getMaintenanceContext,
} from "@/lib/ai/context"

export type BriefingAlert = {
  severity: "critical" | "high" | "medium"
  category: "compliance" | "operations" | "financial" | "safety"
  title: string
  description: string
  action_url?: string
  metadata?: Record<string, string | number | boolean>
}

export type BriefingRecommendation = {
  priority: number
  title: string
  reasoning: string
  estimated_impact: string
  action_url?: string
}

export type MorningBriefing = {
  summary: string
  critical_alerts: BriefingAlert[]
  today_outlook: {
    loads_scheduled: number
    loads_in_transit: number
    drivers_available: number
    drivers_on_duty: number
    expected_revenue_today: number
    notable_events: string[]
  }
  financial_highlights: {
    unpaid_invoices_count: number
    unpaid_invoices_total: number
    invoices_due_this_week: number
    overdue_invoices_count: number
    expected_revenue_this_week: number
  }
  compliance_warnings: BriefingAlert[]
  recommendations: BriefingRecommendation[]
}

const FULL_CONTEXT_KEYS = [
  "fleet",
  "driver",
  "load",
  "financial",
  "compliance",
  "maintenance",
] as const

export function buildWelcomeStubBriefing(): MorningBriefing {
  return {
    summary:
      "Welcome to TruckMates — add your trucks, drivers, and loads so we can build personalized morning briefings with real operational data.",
    critical_alerts: [],
    today_outlook: {
      loads_scheduled: 0,
      loads_in_transit: 0,
      drivers_available: 0,
      drivers_on_duty: 0,
      expected_revenue_today: 0,
      notable_events: [],
    },
    financial_highlights: {
      unpaid_invoices_count: 0,
      unpaid_invoices_total: 0,
      invoices_due_this_week: 0,
      overdue_invoices_count: 0,
      expected_revenue_this_week: 0,
    },
    compliance_warnings: [],
    recommendations: [
      {
        priority: 1,
        title: "Add fleet and dispatch data",
        reasoning:
          "Briefings pull from live trucks, drivers, loads, billing, compliance, and maintenance — the more you enter, the more actionable each morning summary becomes.",
        estimated_impact: "Unlock daily operational intelligence",
        action_url: "/dashboard/loads",
      },
    ],
  }
}

export async function companyHasOperationalData(companyId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [loads, drivers, trucks] = await Promise.all([
    admin.from("loads").select("id", { count: "exact", head: true }).eq("company_id", companyId).limit(1),
    admin.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId).limit(1),
    admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId).limit(1),
  ])
  const lc = loads.count ?? 0
  const dc = drivers.count ?? 0
  const tc = trucks.count ?? 0
  return lc > 0 || dc > 0 || tc > 0
}

function buildBriefingSystemPrompt(briefingDate: string): string {
  return `You are TruckMates AI generating a morning briefing for a trucking company owner or dispatcher. The operational calendar date is ${briefingDate}.

Your job: produce a concise, ACTIONABLE briefing that surfaces ONLY what matters. Do not pad with generic content.

Rules:
- critical_alerts: things that will cost money or cause failure TODAY if ignored. Only the top 1–5 issues. Use severity critical | high | medium and category compliance | operations | financial | safety.
- today_outlook: scheduled/happening today — realistic counts derived ONLY from the data provided (use 0 if unknown).
- financial_highlights: unpaid invoices, amounts due, overdue counts, expected revenue this week — ground in provided data.
- compliance_warnings: licenses, medical, IFTA, DOT windows, recent HOS issues — only if supported by data.
- recommendations: 3–5 specific actions ranked by priority (1 = highest). Each must reference the data and explain WHY. Include estimated_impact when plausible.

Output ONLY valid JSON (no markdown fences, no commentary) with EXACTLY these snake_case top-level keys:
{
  "summary": "<2–3 sentence executive summary>",
  "critical_alerts": [ { "severity", "category", "title", "description", optional "action_url", optional "metadata" } ],
  "today_outlook": {
    "loads_scheduled": number,
    "loads_in_transit": number,
    "drivers_available": number,
    "drivers_on_duty": number,
    "expected_revenue_today": number,
    "notable_events": [ "string" ]
  },
  "financial_highlights": {
    "unpaid_invoices_count": number,
    "unpaid_invoices_total": number,
    "invoices_due_this_week": number,
    "overdue_invoices_count": number,
    "expected_revenue_this_week": number
  },
  "compliance_warnings": [ same shape as critical_alerts ],
  "recommendations": [ { "priority": number, "title", "reasoning", "estimated_impact", optional "action_url" } ]
}`
}

function isBriefingSeverity(v: unknown): v is BriefingAlert["severity"] {
  return v === "critical" || v === "high" || v === "medium"
}

function isBriefingCategory(v: unknown): v is BriefingAlert["category"] {
  return v === "compliance" || v === "operations" || v === "financial" || v === "safety"
}

function parseAlert(raw: unknown): BriefingAlert | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const severity = o.severity
  const category = o.category
  const title = String(o.title || "").trim()
  const description = String(o.description || "").trim()
  if (!isBriefingSeverity(severity) || !isBriefingCategory(category) || !title || !description) return null
  const action_url =
    typeof o.action_url === "string" && o.action_url.trim() ? String(o.action_url).trim() : undefined
  let metadata: Record<string, string | number | boolean> | undefined
  if (o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)) {
    const entries: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(o.metadata as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") entries[k] = v
    }
    if (Object.keys(entries).length > 0) metadata = entries
  }
  return { severity, category, title, description, action_url, metadata }
}

function parseAlerts(raw: unknown): BriefingAlert[] {
  if (!Array.isArray(raw)) return []
  const out: BriefingAlert[] = []
  for (const item of raw) {
    const a = parseAlert(item)
    if (a) out.push(a)
  }
  return out
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || "").trim()).filter(Boolean)
}

function parseOutlook(raw: unknown): MorningBriefing["today_outlook"] {
  if (!raw || typeof raw !== "object") {
    return {
      loads_scheduled: 0,
      loads_in_transit: 0,
      drivers_available: 0,
      drivers_on_duty: 0,
      expected_revenue_today: 0,
      notable_events: [],
    }
  }
  const o = raw as Record<string, unknown>
  return {
    loads_scheduled: num(o.loads_scheduled),
    loads_in_transit: num(o.loads_in_transit),
    drivers_available: num(o.drivers_available),
    drivers_on_duty: num(o.drivers_on_duty),
    expected_revenue_today: num(o.expected_revenue_today),
    notable_events: parseStringArray(o.notable_events),
  }
}

function parseFinancial(raw: unknown): MorningBriefing["financial_highlights"] {
  if (!raw || typeof raw !== "object") {
    return {
      unpaid_invoices_count: 0,
      unpaid_invoices_total: 0,
      invoices_due_this_week: 0,
      overdue_invoices_count: 0,
      expected_revenue_this_week: 0,
    }
  }
  const o = raw as Record<string, unknown>
  return {
    unpaid_invoices_count: num(o.unpaid_invoices_count),
    unpaid_invoices_total: num(o.unpaid_invoices_total),
    invoices_due_this_week: num(o.invoices_due_this_week),
    overdue_invoices_count: num(o.overdue_invoices_count),
    expected_revenue_this_week: num(o.expected_revenue_this_week),
  }
}

function parseRecommendations(raw: unknown): BriefingRecommendation[] {
  if (!Array.isArray(raw)) return []
  const out: BriefingRecommendation[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const priority = num(o.priority, 99)
    const title = String(o.title || "").trim()
    const reasoning = String(o.reasoning || "").trim()
    const estimated_impact = String(o.estimated_impact || "").trim()
    if (!title || !reasoning || !estimated_impact) continue
    const action_url =
      typeof o.action_url === "string" && o.action_url.trim() ? String(o.action_url).trim() : undefined
    out.push({ priority, title, reasoning, estimated_impact, action_url })
  }
  return out.sort((a, b) => a.priority - b.priority)
}

export function parseMorningBriefingPayload(raw: Record<string, unknown> | null): MorningBriefing | null {
  if (!raw) return null
  const summary = String(raw.summary || "").trim()
  if (!summary) return null
  return {
    summary,
    critical_alerts: parseAlerts(raw.critical_alerts),
    today_outlook: parseOutlook(raw.today_outlook),
    financial_highlights: parseFinancial(raw.financial_highlights),
    compliance_warnings: parseAlerts(raw.compliance_warnings),
    recommendations: parseRecommendations(raw.recommendations),
  }
}

async function gatherFullContext(companyId: string): Promise<{ text: string; contextUsed: string[] }> {
  const [fleet, driver, load, financial, compliance, maintenance] = await Promise.all([
    getFleetContext(companyId),
    getDriverContext(companyId),
    getLoadContext(companyId),
    getFinancialContext(companyId),
    getComplianceContext(companyId),
    getMaintenanceContext(companyId),
  ])
  const blocks = [
    fleet && `### Fleet\n${fleet}`,
    driver && `### Drivers\n${driver}`,
    load && `### Loads\n${load}`,
    financial && `### Financial\n${financial}`,
    compliance && `### Compliance\n${compliance}`,
    maintenance && `### Maintenance\n${maintenance}`,
  ].filter(Boolean)

  const text = blocks.join("\n\n")
  const parts = [fleet, driver, load, financial, compliance, maintenance]
  const contextUsed: string[] = []
  FULL_CONTEXT_KEYS.forEach((key, i) => {
    const p = parts[i]
    if (typeof p === "string" && p.trim().length > 0) {
      contextUsed.push(key)
    }
  })

  return {
    text: text.trim() || "(No operational context returned from TMS aggregates.)",
    contextUsed,
  }
}

export async function generateBriefingForCompany(params: {
  companyId: string
  briefingDate: string
  usageFeature?: string
}): Promise<{
  data: MorningBriefing | null
  error: string | null
  tokensUsed: number
  costUsd: number
  durationMs: number
  contextUsed: string[]
  model: string | null
  quotaWarning?: boolean
}> {
  const started = Date.now()
  const usageFeature = params.usageFeature ?? "ai_morning_briefing_cron"

  const { text: cacheContext, contextUsed } = await gatherFullContext(params.companyId)
  const userBlock = [
    `Company briefing date: ${params.briefingDate}`,
    "",
    "Operational context (ground truth — do not invent facts beyond reasonable inference):",
    cacheContext,
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(buildBriefingSystemPrompt(params.briefingDate), userBlock, {
    expectJson: true,
    model: "sonnet",
    maxTokens: 4096,
    companyId: params.companyId,
    feature: usageFeature,
    cacheSystemPrompt: true,
    cacheContext,
  })

  const durationMs = Date.now() - started
  const tokensUsed = typeof res.tokensUsed === "number" ? res.tokensUsed : 0
  const modelName = typeof res.model === "string" ? res.model : null

  if (res.error || !res.data) {
    return {
      data: null,
      error: res.error || "Briefing generation failed",
      tokensUsed,
      costUsd: 0,
      durationMs,
      contextUsed,
      model: modelName,
      quotaWarning: res.quotaWarning,
    }
  }

  const parsed = parseMorningBriefingPayload(res.data)
  if (!parsed) {
    return {
      data: null,
      error: "Failed to parse briefing JSON",
      tokensUsed,
      costUsd: 0,
      durationMs,
      contextUsed,
      model: modelName,
    }
  }

  return {
    data: parsed,
    error: null,
    tokensUsed,
    costUsd: 0,
    durationMs,
    contextUsed,
    model: modelName,
    quotaWarning: res.quotaWarning,
  }
}

export type MorningBriefingInsertPayload = {
  companyId: string
  briefingDate: string
  briefing: MorningBriefing
  tokensUsed: number
  costUsd: number
  durationMs: number
  contextUsed: string[]
  model: string | null
}

/** Insert a briefing row. Returns duplicate=true when unique (company_id, briefing_date) already exists. */
export async function insertMorningBriefingRecord(
  payload: MorningBriefingInsertPayload,
): Promise<{ ok: true; duplicate?: boolean; id?: string } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const row = {
    company_id: payload.companyId,
    briefing_date: payload.briefingDate,
    summary: payload.briefing.summary,
    critical_alerts: payload.briefing.critical_alerts,
    today_outlook: payload.briefing.today_outlook,
    financial_highlights: payload.briefing.financial_highlights,
    compliance_warnings: payload.briefing.compliance_warnings,
    recommendations: payload.briefing.recommendations,
    context_used: payload.contextUsed,
    tokens_used: payload.tokensUsed,
    cost_usd: payload.costUsd,
    model: payload.model,
    generation_duration_ms: payload.durationMs,
  }

  const { data, error } = await admin.from("ai_morning_briefings").insert(row).select("id").single()

  if (error) {
    if (error.code === "23505") {
      return { ok: true, duplicate: true }
    }
    return { ok: false, error: databaseErrorMessage(error, "Insert failed") }
  }

  const id = data && typeof (data as { id?: unknown }).id === "string" ? String((data as { id: string }).id) : undefined
  return { ok: true, id }
}
