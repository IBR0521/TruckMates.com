import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"
import { generateScorecardSnapshotsForCompany } from "@/lib/eld/scorecard-snapshot"

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
    const withDrivers: CompanyRow[] = []
    for (const c of companies) {
      const tier: PlanTier = normalizePlanTier(c.subscription_tier ?? undefined)
      if (!hasFeatureAccess(tier, "driver_safety_scorecards")) continue
      const { count, error: ctErr } = await admin
        .from("drivers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", c.id)
        .limit(1)
      if (ctErr) {
        Sentry.captureMessage(`generate-scorecards driver count ${c.id}: ${ctErr.message}`, { level: "warning" })
        continue
      }
      if ((count || 0) > 0) withDrivers.push(c)
    }

    const snapshotDate = new Date()

    const results = await mapWithConcurrency(withDrivers, 5, async (c) => {
      const out = await generateScorecardSnapshotsForCompany({
        companyId: c.id,
        snapshotDate,
      })
      if (out.error) {
        Sentry.captureMessage(`generate-scorecards company ${c.id}: ${out.error}`, { level: "warning" })
      }
      return { companyId: c.id, ...out }
    })

    const aggregate = results.reduce(
      (acc, r) => {
        acc.companies += 1
        if (r.data) {
          acc.generated += r.data.generated
          acc.skipped += r.data.skipped
          acc.errors += r.data.errors
          if (r.data.completed) acc.completed_companies += 1
        }
        if (r.error) acc.errors += 1
        return acc
      },
      { companies: 0, generated: 0, skipped: 0, errors: 0, completed_companies: 0 },
    )

    return NextResponse.json({
      ok: true,
      snapshot_date: snapshotDate.toISOString().slice(0, 10),
      eligible_companies: withDrivers.length,
      aggregate,
      sample: results.slice(0, 25),
    })
  } catch (e: unknown) {
    Sentry.captureException(e)
    return NextResponse.json(
      { ok: false, error: errorMessage(e, "generate-scorecards cron failed") },
      { status: 500 },
    )
  }
}
