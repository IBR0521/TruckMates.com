import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { processSmartNotificationsForCompany } from "@/lib/ai/notifications/process-company-smart"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"

export const maxDuration = 300

type CompanyRow = { id: string; subscription_tier: string | null; subscription_status: string | null }

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
      .select("id, subscription_tier, subscription_status")
      .in("subscription_status", ["active", "trial"])

    if (companiesErr) {
      return NextResponse.json(
        { error: databaseErrorMessage(companiesErr, "Failed to load companies") },
        { status: 500 },
      )
    }

    const companies = ((companiesRaw || []) as CompanyRow[]).filter((r) => r.id)
    const eligible = companies.filter((c) => {
      const tier: PlanTier = normalizePlanTier(c.subscription_tier ?? undefined)
      return hasFeatureAccess(tier, "ai_smart_notifications")
    })

    const results = await mapWithConcurrency(eligible, 5, async (c) => {
      const stats = await processSmartNotificationsForCompany(c.id)
      if (stats.error) {
        Sentry.captureMessage(`smart-notifications company ${c.id}: ${stats.error}`, {
          level: "warning",
          extra: { companyId: c.id, stats },
        })
      }
      return { companyId: c.id, ...stats }
    })

    const aggregate = results.reduce(
      (acc, r) => {
        acc.scored += r.scored
        acc.proactive_created += r.proactive_created
        acc.resolved += r.resolved
        acc.deleted += r.deleted
        if (r.skippedPlan) acc.skipped_plan += 1
        if (r.skippedThrottle) acc.skipped_throttle += 1
        if (r.skippedNoSmartUser) acc.skipped_no_smart_user += 1
        if (r.error) acc.errors += 1
        return acc
      },
      {
        scored: 0,
        proactive_created: 0,
        resolved: 0,
        deleted: 0,
        skipped_plan: 0,
        skipped_throttle: 0,
        skipped_no_smart_user: 0,
        errors: 0,
      },
    )

    return NextResponse.json({
      success: true,
      processed_companies: eligible.length,
      companies_total: companies.length,
      companies: results,
      ...aggregate,
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "process-smart-notifications cron failed") },
      { status: 500 },
    )
  }
}
