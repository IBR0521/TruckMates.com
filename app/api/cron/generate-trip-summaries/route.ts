import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"
import { generateTripSummaryForLoad } from "@/lib/eld/trip-aggregator"
import { listLoadIdsNeedingTripSummary } from "@/lib/eld/trip-cron-queries"

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
      return hasFeatureAccess(tier, "trip_replay")
    })

    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const results = await mapWithConcurrency(eligible, 5, async (c) => {
      const tier: PlanTier = normalizePlanTier(c.subscription_tier ?? undefined)
      if (!hasFeatureAccess(tier, "trip_replay")) {
        return { companyId: c.id, processed: 0, errors: 0, error: null as string | null }
      }
      try {
        const need = await listLoadIdsNeedingTripSummary({ companyId: c.id, sinceIso })
        if (need.error) {
          return { companyId: c.id, processed: 0, errors: 1, error: need.error }
        }
        let processed = 0
        let errors = 0
        for (const loadId of need.data) {
          const out = await generateTripSummaryForLoad({ loadId, companyId: c.id })
          if (out.error) {
            errors += 1
            Sentry.captureMessage(`generate-trip-summaries ${c.id}/${loadId}: ${out.error}`, { level: "warning" })
          } else {
            processed += 1
          }
        }
        return { companyId: c.id, processed, errors, error: null as string | null }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "company_failed"
        Sentry.captureException(e)
        return { companyId: c.id, processed: 0, errors: 1, error: msg }
      }
    })

    const aggregate = results.reduce(
      (acc, r) => {
        acc.companies += 1
        acc.processed += r.processed
        acc.errors += r.errors
        if (r.error) acc.company_errors += 1
        return acc
      },
      { companies: 0, processed: 0, errors: 0, company_errors: 0 },
    )

    return NextResponse.json({
      ok: true,
      sinceIso,
      eligibleCompanies: eligible.length,
      aggregate,
      sample: results.slice(0, 25),
    })
  } catch (e: unknown) {
    Sentry.captureException(e)
    return NextResponse.json(
      { ok: false, error: errorMessage(e, "generate-trip-summaries cron failed") },
      { status: 500 },
    )
  }
}
