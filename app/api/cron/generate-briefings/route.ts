import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { calendarDateInTimeZone } from "@/lib/datetime/company-calendar-date"
import {
  buildWelcomeStubBriefing,
  companyHasOperationalData,
  generateBriefingForCompany,
  insertMorningBriefingRecord,
} from "@/lib/ai/briefing"

/** Long-running batch; matches vercel.json override for this route. */
export const maxDuration = 300

type CompanyRow = { id: string }

async function processCompany(params: {
  companyId: string
  timeZone: string | null
}): Promise<"generated" | "skipped" | "failed"> {
  const admin = createAdminClient()
  const briefingDate = calendarDateInTimeZone(new Date(), params.timeZone)

  const { data: existing } = await admin
    .from("ai_morning_briefings")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("briefing_date", briefingDate)
    .maybeSingle()

  if (existing?.id) {
    return "skipped"
  }

  try {
    const hasData = await companyHasOperationalData(params.companyId)
    if (!hasData) {
      const stub = buildWelcomeStubBriefing()
      const ins = await insertMorningBriefingRecord({
        companyId: params.companyId,
        briefingDate,
        briefing: stub,
        tokensUsed: 0,
        costUsd: 0,
        durationMs: 0,
        contextUsed: [],
        model: null,
      })
      if (!ins.ok) {
        Sentry.captureMessage(`Morning briefing stub insert failed: ${ins.error}`, {
          level: "warning",
          extra: { companyId: params.companyId, briefingDate },
        })
        return "failed"
      }
      if (ins.duplicate) return "skipped"
      return "generated"
    }

    const gen = await generateBriefingForCompany({
      companyId: params.companyId,
      briefingDate,
      usageFeature: "ai_morning_briefing_cron",
    })

    if (gen.error || !gen.data) {
      Sentry.captureMessage(gen.error || "Morning briefing AI returned empty", {
        level: "warning",
        extra: { companyId: params.companyId, briefingDate },
      })
      return "failed"
    }

    const ins = await insertMorningBriefingRecord({
      companyId: params.companyId,
      briefingDate,
      briefing: gen.data,
      tokensUsed: gen.tokensUsed,
      costUsd: gen.costUsd,
      durationMs: gen.durationMs,
      contextUsed: gen.contextUsed,
      model: gen.model,
    })

    if (!ins.ok) {
      Sentry.captureMessage(`Morning briefing insert failed: ${ins.error}`, {
        level: "warning",
        extra: { companyId: params.companyId, briefingDate },
      })
      return "failed"
    }
    if (ins.duplicate) return "skipped"
    return "generated"
  } catch (err: unknown) {
    Sentry.captureException(err, { extra: { companyId: params.companyId } })
    return "failed"
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const cronSecret = process.env.CRON_SECRET

  const isAuthorizedBySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthorizedByVercelCron = !!vercelCronHeader
  if (!isAuthorizedBySecret && !isAuthorizedByVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: companiesRaw, error: companiesErr } = await admin
      .from("companies")
      .select("id")
      .in("subscription_status", ["active", "trial"])
      .neq("subscription_tier", "owner_operator")

    if (companiesErr) {
      return NextResponse.json({ error: databaseErrorMessage(companiesErr, "Failed to load companies") }, { status: 500 })
    }

    const companies = ((companiesRaw || []) as CompanyRow[]).filter((r) => r.id)
    const ids = companies.map((c) => c.id)

    const tzMap = new Map<string, string | null>()
    if (ids.length > 0) {
      const { data: settingsRows } = await admin.from("company_settings").select("company_id, timezone").in("company_id", ids)
      for (const row of settingsRows || []) {
        const sid = String((row as { company_id?: string }).company_id || "")
        if (!sid) continue
        tzMap.set(sid, typeof (row as { timezone?: string }).timezone === "string" ? (row as { timezone: string }).timezone : null)
      }
    }

    let generated = 0
    let skipped = 0
    let failed = 0

    for (const row of companies) {
      const outcome = await processCompany({
        companyId: row.id,
        timeZone: tzMap.get(row.id) ?? null,
      })
      if (outcome === "generated") generated += 1
      else if (outcome === "skipped") skipped += 1
      else failed += 1
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped,
      failed,
      processed: companies.length,
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "generate-briefings cron failed") },
      { status: 500 },
    )
  }
}
