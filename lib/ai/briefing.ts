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
import { isAiBriefingActionableRecommendationsEnabled } from "@/lib/ai/feature-flags"
import {
  buildBriefingToolCatalogSection,
  gatherBriefingEntityContext,
  parseBriefingSuggestedTool,
  sanitizeBriefingSuggestedTools,
} from "@/lib/ai/briefing-actionable"
import type { BriefingAlert, BriefingRecommendation, MorningBriefing } from "@/lib/ai/briefing-types"

export type { BriefingSuggestedTool, BriefingAlert, BriefingRecommendation, MorningBriefing } from "@/lib/ai/briefing-types"

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

function buildBriefingSystemPrompt(briefingDate: string, includeActionableTools: boolean): string {
  const actionableSection = includeActionableTools
    ? `

${buildBriefingToolCatalogSection()}

For each recommendations[] and critical_alerts[] entry, include optional:
"suggested_tool": { "tool_name": "<exact registry name>", "tool_input": { ... } } | null
Set suggested_tool to null unless a specific tool cleanly matches with inputs grounded in Entity references or location text from context.`
    : ""

  return `You are TruckMates AI generating a morning briefing for a trucking company owner or dispatcher. The operational calendar date is ${briefingDate}.

Your job: produce a concise, ACTIONABLE briefing that surfaces ONLY what matters. Do not pad with generic content.

Rules:
- critical_alerts: things that will cost money or cause failure TODAY if ignored. Only the top 1–5 issues. Use severity critical | high | medium and category compliance | operations | financial | safety.
- today_outlook: scheduled/happening today — realistic counts derived ONLY from the data provided (use 0 if unknown).
- financial_highlights: unpaid invoices, amounts due, overdue counts, expected revenue this week — ground in provided data.
- compliance_warnings: licenses, medical, IFTA, DOT windows, recent HOS issues — only if supported by data.
- recommendations: 3–5 specific actions ranked by priority (1 = highest). Each must reference the data and explain WHY. Include estimated_impact when plausible.
- last-24h events: the user turn includes a "What actually happened in the last 24 hours" section drawn from real records. Ground the summary and today_outlook.notable_events in those events. If that section states no notable events occurred, say so plainly in the summary and leave notable_events empty — do NOT fabricate activity that is not supported by the data.

Output ONLY valid JSON (no markdown fences, no commentary) with EXACTLY these snake_case top-level keys:
{
  "summary": "<2–3 sentence executive summary>",
  "critical_alerts": [ { "severity", "category", "title", "description", optional "action_url", optional "metadata", optional "suggested_tool" } ],
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
  "recommendations": [ { "priority": number, "title", "reasoning", "estimated_impact", optional "action_url", optional "suggested_tool" } ]
}${actionableSection}`
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
  return { severity, category, title, description, action_url, metadata, suggested_tool: parseBriefingSuggestedTool(o.suggested_tool) }
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
    out.push({
      priority,
      title,
      reasoning,
      estimated_impact,
      action_url,
      suggested_tool: parseBriefingSuggestedTool(o.suggested_tool),
    })
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

/** Lookback window for "what happened" in the daily event summary. */
const EVENT_LOOKBACK_HOURS = 24
/** Horizon for "documents now expiring soon" surfaced in the daily summary. */
const DOC_EXPIRY_HORIZON_DAYS = 7

type CountAndSamples = { count: number; samples: string[] }

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function bumpBreakdown(map: Record<string, number>, key: string): void {
  const k = key || "unknown"
  map[k] = (map[k] || 0) + 1
}

function renderTypeBreakdown(map: Record<string, number>): string {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return "none"
  return entries.map(([type, count]) => `${type} (${count})`).join(", ")
}

/**
 * Summarize the company's actual prior-24h events from real tables (scoped to company_id) so the
 * briefing reflects what genuinely happened: loads delivered/completed, new HOS violations detected,
 * maintenance that became due/overdue, invoices paid, and documents now expiring within 7 days.
 *
 * Returns a compact, LLM-readable block. When nothing notable occurred it returns an explicit
 * "no notable events" statement so the model states that plainly instead of fabricating activity.
 * Each sub-query is best-effort and isolated; a hard failure returns "" (section simply omitted).
 */
export async function buildDailyEventSummary(companyId: string): Promise<string> {
  try {
    const admin = createAdminClient()
    const now = new Date()
    const sinceIso = new Date(now.getTime() - EVENT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
    const sinceDate = sinceIso.slice(0, 10)
    const todayDate = now.toISOString().slice(0, 10)
    const horizonDate = new Date(now.getTime() + DOC_EXPIRY_HORIZON_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    const [loadsResult, hosResult, maintenanceResult, invoicesResult, documentsResult] = await Promise.all([
      admin
        .from("loads")
        .select("id, shipment_number, status, updated_at")
        .eq("company_id", companyId)
        .in("status", ["delivered", "completed"])
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false })
        .limit(100),
      admin
        .from("ai_automation_logs")
        .select("id, action_payload, created_at")
        .eq("company_id", companyId)
        .eq("automation_type", "hos_violation_prevention")
        .eq("triggered", true)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("maintenance")
        .select("id, service_type, scheduled_date, status")
        .eq("company_id", companyId)
        .not("status", "in", '("completed","cancelled")')
        .gte("scheduled_date", sinceDate)
        .lte("scheduled_date", horizonDate)
        .limit(200),
      admin
        .from("invoices")
        .select("id, invoice_number, amount, status, paid_date")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .gte("paid_date", sinceDate)
        .limit(200),
      admin
        .from("documents")
        .select("id, type, expiry_date")
        .eq("company_id", companyId)
        .not("expiry_date", "is", null)
        .gte("expiry_date", todayDate)
        .lte("expiry_date", horizonDate)
        .limit(200),
    ])

    const lines: string[] = []

    // Loads completed/delivered in the window.
    const loadsDelivered: CountAndSamples = { count: 0, samples: [] }
    if (!loadsResult.error) {
      const rows = (loadsResult.data || []) as Array<{ shipment_number?: string | null }>
      loadsDelivered.count = rows.length
      loadsDelivered.samples = rows
        .map((r) => String(r.shipment_number || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    }
    if (loadsDelivered.count > 0) {
      const sample = loadsDelivered.samples.length ? ` (e.g. ${loadsDelivered.samples.join(", ")})` : ""
      lines.push(`- Loads completed/delivered: ${loadsDelivered.count}${sample}`)
    }

    // New HOS violations detected (from automation log of triggered HOS-prevention events).
    if (!hosResult.error) {
      const rows = (hosResult.data || []) as Array<{ action_payload: Record<string, unknown> | null }>
      const severityCounts: Record<string, number> = {}
      for (const row of rows) {
        const payload = row.action_payload || {}
        const trigger =
          payload.triggerData && typeof payload.triggerData === "object" && !Array.isArray(payload.triggerData)
            ? (payload.triggerData as Record<string, unknown>)
            : {}
        const severity = String(trigger.severity || "unspecified").toLowerCase()
        bumpBreakdown(severityCounts, severity)
      }
      const total = rows.length
      if (total > 0) {
        lines.push(`- New HOS violation alerts: ${total} (by severity: ${renderTypeBreakdown(severityCounts)})`)
      }
    }

    // Maintenance that became due/overdue (scheduled date within window, not yet completed).
    if (!maintenanceResult.error) {
      const rows = (maintenanceResult.data || []) as Array<{ scheduled_date?: string | null }>
      let overdue = 0
      let dueSoon = 0
      for (const row of rows) {
        const scheduled = String(row.scheduled_date || "").slice(0, 10)
        if (!scheduled) continue
        if (scheduled < todayDate) overdue += 1
        else dueSoon += 1
      }
      if (overdue > 0 || dueSoon > 0) {
        lines.push(`- Maintenance changes: ${overdue} newly overdue, ${dueSoon} now due within ${DOC_EXPIRY_HORIZON_DAYS} days`)
      }
    }

    // Invoices paid in the window.
    if (!invoicesResult.error) {
      const rows = (invoicesResult.data || []) as Array<{ amount?: unknown }>
      const count = rows.length
      const total = rows.reduce((sum, r) => sum + num(r.amount), 0)
      if (count > 0) {
        lines.push(`- Invoices paid: ${count} totaling ${formatMoney(total)}`)
      }
    }

    // Documents now expiring within the horizon.
    if (!documentsResult.error) {
      const rows = (documentsResult.data || []) as Array<{ type?: string | null }>
      const typeCounts: Record<string, number> = {}
      for (const row of rows) bumpBreakdown(typeCounts, String(row.type || "unknown").toLowerCase())
      if (rows.length > 0) {
        lines.push(`- Documents now expiring within ${DOC_EXPIRY_HORIZON_DAYS} days: ${rows.length} (${renderTypeBreakdown(typeCounts)})`)
      }
    }

    if (lines.length === 0) {
      return "Last 24 hours (real events, scoped to this company): No notable operational events were recorded — no loads completed, no new HOS alerts, no maintenance status changes, no invoices paid, and no documents newly expiring within 7 days."
    }

    return ["Last 24 hours (real events, scoped to this company):", ...lines].join("\n")
  } catch {
    return ""
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
  suggestedToolStats?: {
    validated: number
    discarded: number
    nullCount: number
    rawNonNull: number
  }
}> {
  const started = Date.now()
  const usageFeature = params.usageFeature ?? "ai_morning_briefing_cron"

  const includeActionable = isAiBriefingActionableRecommendationsEnabled()
  const [{ text: cacheContext, contextUsed }, eventSummary, entityCtx] = await Promise.all([
    gatherFullContext(params.companyId),
    buildDailyEventSummary(params.companyId),
    includeActionable ? gatherBriefingEntityContext(params.companyId) : Promise.resolve(null),
  ])
  const userBlock = [
    `Company briefing date: ${params.briefingDate}`,
    "",
    "What actually happened in the last 24 hours (real events — base the summary and notable_events on these):",
    eventSummary || "No 24-hour event data was available for this company.",
    "",
    ...(entityCtx
      ? ["Entity references for suggested_tool (use exact UUIDs only when recommending id-based tools):", entityCtx.referenceBlock, ""]
      : []),
    "Operational context (ground truth — do not invent facts beyond reasonable inference):",
    cacheContext,
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(
    buildBriefingSystemPrompt(params.briefingDate, includeActionable),
    userBlock,
    {
      expectJson: true,
      model: "sonnet",
      maxTokens: 4096,
      companyId: params.companyId,
      feature: usageFeature,
      cacheSystemPrompt: true,
      cacheContext,
    },
  )

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

  if (includeActionable && entityCtx) {
    const suggestedToolStats = sanitizeBriefingSuggestedTools(parsed, entityCtx.allowlist)
    return {
      data: parsed,
      error: null,
      tokensUsed,
      costUsd: 0,
      durationMs,
      contextUsed,
      model: modelName,
      quotaWarning: res.quotaWarning,
      suggestedToolStats,
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
