"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import { calendarDateInTimeZone } from "@/lib/datetime/company-calendar-date"
import {
  buildWelcomeStubBriefing,
  companyHasOperationalData,
  generateBriefingForCompany,
  insertMorningBriefingRecord,
  type BriefingAlert,
  type BriefingRecommendation,
  type MorningBriefing,
} from "@/lib/ai/briefing"
import { logAiUsage } from "@/lib/ai/usage"

async function assertBriefingAllowed(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await checkFeatureAccess({ companyId, feature: "ai_morning_briefing" })
  if (!gate.allowed) {
    return { ok: false, error: "Morning briefing is not available on your current plan." }
  }
  return { ok: true }
}

async function getCompanyTimeZone(companyId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from("company_settings").select("timezone").eq("company_id", companyId).maybeSingle()
  if (error || !data) return null
  const tz = (data as { timezone?: string | null }).timezone
  return typeof tz === "string" && tz.trim() ? tz.trim() : null
}

function parseActionedItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x)).filter(Boolean)
}

function mapBriefingRow(row: Record<string, unknown>): {
  id: string
  briefingDate: string
  summary: string
  critical_alerts: BriefingAlert[]
  today_outlook: MorningBriefing["today_outlook"]
  financial_highlights: MorningBriefing["financial_highlights"]
  compliance_warnings: BriefingAlert[]
  recommendations: BriefingRecommendation[]
  viewed_at: string | null
  dismissed_at: string | null
  actioned_items: string[]
} {
  return {
    id: String(row.id || ""),
    briefingDate: String(row.briefing_date || ""),
    summary: String(row.summary || ""),
    critical_alerts: Array.isArray(row.critical_alerts)
      ? (row.critical_alerts as BriefingAlert[])
      : [],
    today_outlook:
      row.today_outlook && typeof row.today_outlook === "object"
        ? (row.today_outlook as MorningBriefing["today_outlook"])
        : {
            loads_scheduled: 0,
            loads_in_transit: 0,
            drivers_available: 0,
            drivers_on_duty: 0,
            expected_revenue_today: 0,
            notable_events: [],
          },
    financial_highlights:
      row.financial_highlights && typeof row.financial_highlights === "object"
        ? (row.financial_highlights as MorningBriefing["financial_highlights"])
        : {
            unpaid_invoices_count: 0,
            unpaid_invoices_total: 0,
            invoices_due_this_week: 0,
            overdue_invoices_count: 0,
            expected_revenue_this_week: 0,
          },
    compliance_warnings: Array.isArray(row.compliance_warnings)
      ? (row.compliance_warnings as BriefingAlert[])
      : [],
    recommendations: Array.isArray(row.recommendations)
      ? (row.recommendations as BriefingRecommendation[])
      : [],
    viewed_at: row.viewed_at ? String(row.viewed_at) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    actioned_items: parseActionedItems(row.actioned_items),
  }
}

export async function getTodaysBriefing(): Promise<{
  data: {
    id: string
    briefingDate: string
    summary: string
    critical_alerts: BriefingAlert[]
    today_outlook: MorningBriefing["today_outlook"]
    financial_highlights: MorningBriefing["financial_highlights"]
    compliance_warnings: BriefingAlert[]
    recommendations: BriefingRecommendation[]
    viewed_at: string | null
    dismissed_at: string | null
    actioned_items: string[]
  } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await assertBriefingAllowed(ctx.companyId)
  if (!gate.ok) {
    return { data: null, error: null }
  }

  const admin = createAdminClient()
  const tz = await getCompanyTimeZone(ctx.companyId)
  const briefingDate = calendarDateInTimeZone(new Date(), tz)

  const { data: row, error } = await admin
    .from("ai_morning_briefings")
    .select(
      "id, briefing_date, summary, critical_alerts, today_outlook, financial_highlights, compliance_warnings, recommendations, viewed_at, dismissed_at, actioned_items",
    )
    .eq("company_id", ctx.companyId)
    .eq("briefing_date", briefingDate)
    .is("dismissed_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: safeDbError(error) }
  }
  if (!row || !(row as { id?: string }).id) {
    return { data: null, error: null }
  }

  const mapped = mapBriefingRow(row as Record<string, unknown>)

  if (!mapped.viewed_at) {
    const now = new Date().toISOString()
    await admin.from("ai_morning_briefings").update({ viewed_at: now }).eq("id", mapped.id).eq("company_id", ctx.companyId)
    mapped.viewed_at = now
  }

  return { data: mapped, error: null }
}

export async function dismissBriefing(briefingId: string): Promise<{
  data: { dismissed: boolean } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await assertBriefingAllowed(ctx.companyId)
  if (!gate.ok) {
    return { data: null, error: gate.error }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("ai_morning_briefings")
    .update({ dismissed_at: now })
    .eq("id", briefingId)
    .eq("company_id", ctx.companyId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { data: null, error: safeDbError(error) }
  }
  if (!updated) {
    return { data: null, error: "Briefing not found." }
  }

  return { data: { dismissed: true }, error: null }
}

export async function markBriefingItemActioned(params: {
  briefingId: string
  itemId: string
}): Promise<{
  data: { actioned: boolean } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await assertBriefingAllowed(ctx.companyId)
  if (!gate.ok) {
    return { data: null, error: gate.error }
  }

  const itemId = String(params.itemId || "").trim()
  if (!itemId) {
    return { data: null, error: "itemId is required." }
  }

  const admin = createAdminClient()
  const { data: row, error: fetchErr } = await admin
    .from("ai_morning_briefings")
    .select("actioned_items")
    .eq("id", params.briefingId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (fetchErr) {
    return { data: null, error: safeDbError(fetchErr) }
  }
  if (!row) {
    return { data: null, error: "Briefing not found." }
  }

  const current = parseActionedItems((row as { actioned_items?: unknown }).actioned_items)
  if (current.includes(itemId)) {
    return { data: { actioned: true }, error: null }
  }

  const next = [...current, itemId]

  const { error: upErr } = await admin
    .from("ai_morning_briefings")
    .update({ actioned_items: next })
    .eq("id", params.briefingId)
    .eq("company_id", ctx.companyId)

  if (upErr) {
    return { data: null, error: safeDbError(upErr) }
  }

  return { data: { actioned: true }, error: null }
}

export async function generateBriefingOnDemand(): Promise<{
  data: { briefingId: string } | null
  error: string | null
  quotaWarning?: boolean
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const gate = await assertBriefingAllowed(ctx.companyId)
  if (!gate.ok) {
    return { data: null, error: gate.error }
  }

  const admin = createAdminClient()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentManual, error: throttleErr } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.companyId)
    .eq("feature", "ai_morning_briefing_manual")
    .gte("created_at", hourAgo)

  if (throttleErr) {
    return { data: null, error: safeDbError(throttleErr) }
  }
  if ((recentManual ?? 0) > 0) {
    return { data: null, error: "You can refresh your briefing at most once per hour." }
  }

  const tz = await getCompanyTimeZone(ctx.companyId)
  const briefingDate = calendarDateInTimeZone(new Date(), tz)

  const hasData = await companyHasOperationalData(ctx.companyId)

  let briefingBody: MorningBriefing
  let tokensUsed = 0
  let costUsd = 0
  let durationMs = 0
  let contextUsed: string[] = []
  let model: string | null = null
  let quotaWarning = false

  if (!hasData) {
    briefingBody = buildWelcomeStubBriefing()
  } else {
    const gen = await generateBriefingForCompany({
      companyId: ctx.companyId,
      briefingDate,
      usageFeature: "ai_morning_briefing_manual",
    })
    quotaWarning = Boolean(gen.quotaWarning)
    if (gen.error || !gen.data) {
      return { data: null, error: gen.error || "Could not generate briefing.", quotaWarning }
    }
    briefingBody = gen.data
    tokensUsed = gen.tokensUsed
    costUsd = gen.costUsd
    durationMs = gen.durationMs
    contextUsed = gen.contextUsed
    model = gen.model
  }

  await admin.from("ai_morning_briefings").delete().eq("company_id", ctx.companyId).eq("briefing_date", briefingDate)

  const ins = await insertMorningBriefingRecord({
    companyId: ctx.companyId,
    briefingDate,
    briefing: briefingBody,
    tokensUsed,
    costUsd,
    durationMs,
    contextUsed,
    model,
  })

  if (!ins.ok) {
    return { data: null, error: ins.error, quotaWarning }
  }

  if (!hasData) {
    await logAiUsage({
      companyId: ctx.companyId,
      feature: "ai_morning_briefing_manual",
      model: "stub",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      durationMs: 0,
    })
  }

  const briefingId = ins.id
  if (briefingId) {
    return { data: { briefingId }, error: null, quotaWarning }
  }

  const { data: row } = await admin
    .from("ai_morning_briefings")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("briefing_date", briefingDate)
    .maybeSingle()
  const bid = row && typeof (row as { id?: unknown }).id === "string" ? String((row as { id: string }).id) : ""
  if (!bid) return { data: null, error: "Briefing saved but could not be loaded.", quotaWarning }
  return { data: { briefingId: bid }, error: null, quotaWarning }
}
