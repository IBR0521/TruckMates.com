import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { fetchActiveEldDevicesForSync } from "@/lib/eld/device-credentials"
import { canonicalEldProvider, type EldProviderCanonical } from "@/lib/eld/provider-normalize"
import { syncTelemetryForDevice } from "@/lib/eld/telemetry-sync"

export const maxDuration = 300

type CompanyRow = { id: string; subscription_tier: string | null; subscription_status: string | null }

type SyncCursorRow = {
  company_id: string
  provider: string
  data_type: string
  last_synced_through: string
  consecutive_failures: number
}

async function loadCursor(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  provider: EldProviderCanonical,
): Promise<SyncCursorRow | null> {
  const { data, error } = await admin
    .from("eld_sync_cursors")
    .select("company_id, provider, data_type, last_synced_through, consecutive_failures")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .eq("data_type", "telemetry")
    .maybeSingle()
  if (error || !data) return null
  return data as SyncCursorRow
}

async function upsertCursor(
  admin: ReturnType<typeof createAdminClient>,
  patch: {
    company_id: string
    provider: EldProviderCanonical
    last_synced_through: string
    last_run_at: string
    last_error: string | null
    consecutive_failures: number
  },
): Promise<void> {
  const { error } = await admin.from("eld_sync_cursors").upsert(
    {
      company_id: patch.company_id,
      provider: patch.provider,
      data_type: "telemetry",
      last_synced_through: patch.last_synced_through,
      last_run_at: patch.last_run_at,
      last_error: patch.last_error,
      consecutive_failures: patch.consecutive_failures,
    },
    { onConflict: "company_id,provider,data_type" },
  )
  if (error) {
    Sentry.captureMessage(`eld_sync_cursors telemetry upsert failed: ${error.message}`, { level: "warning", extra: patch })
  }
}

async function processCompanyTelemetry(companyId: string, tier: PlanTier): Promise<{
  devices: number
  inserted: number
  skipped: number
}> {
  if (!hasFeatureAccess(tier, "trip_replay")) {
    return { devices: 0, inserted: 0, skipped: 0 }
  }
  const admin = createAdminClient()
  const { data: deviceRows, error: devErr } = await fetchActiveEldDevicesForSync({
    companyId,
    client: admin,
  })

  if (devErr || !deviceRows?.length) {
    return { devices: 0, inserted: 0, skipped: 0 }
  }

  const devices = deviceRows.filter((d) => d.id && d.company_id && canonicalEldProvider(d.provider))

  const until = new Date()
  const defaultSince = new Date(until.getTime() - 60 * 60 * 1000)

  const totals = { devices: 0, inserted: 0, skipped: 0 }

  const byProvider = new Map<EldProviderCanonical, EldDeviceSyncRow[]>()
  for (const d of devices) {
    const p = canonicalEldProvider(d.provider)
    if (!p) continue
    const list = byProvider.get(p) || []
    list.push(d)
    byProvider.set(p, list)
  }

  for (const [provider, list] of byProvider) {
    const cursor = await loadCursor(admin, companyId, provider)
    if (cursor && cursor.consecutive_failures >= 5) continue

    let since = defaultSince
    if (cursor?.last_synced_through) {
      const t = new Date(cursor.last_synced_through).getTime()
      if (Number.isFinite(t)) {
        since = new Date(Math.max(defaultSince.getTime(), t - 5 * 60 * 1000))
      }
    }

    const results = await Promise.all(list.map((d) => syncTelemetryForDevice(d, since, until)))
    const rate = results.some((r) => r.rateLimited)
    if (rate) {
      await upsertCursor(admin, {
        company_id: companyId,
        provider,
        last_synced_through: cursor?.last_synced_through ?? since.toISOString(),
        last_run_at: until.toISOString(),
        last_error: "rate_limited_429",
        consecutive_failures: cursor?.consecutive_failures ?? 0,
      })
      continue
    }

    const okSome = results.some((r) => !r.error || r.softSkip)
    const inserted = results.reduce((s, r) => s + r.inserted, 0)
    const skipped = results.reduce((s, r) => s + r.skipped, 0)
    totals.devices += list.length
    totals.inserted += inserted
    totals.skipped += skipped

    if (okSome) {
      await upsertCursor(admin, {
        company_id: companyId,
        provider,
        last_synced_through: until.toISOString(),
        last_run_at: until.toISOString(),
        last_error: null,
        consecutive_failures: 0,
      })
    } else {
      const fails = (cursor?.consecutive_failures ?? 0) + 1
      await upsertCursor(admin, {
        company_id: companyId,
        provider,
        last_synced_through: cursor?.last_synced_through ?? since.toISOString(),
        last_run_at: until.toISOString(),
        last_error: results.map((r) => r.error).filter(Boolean)[0] ?? "sync_failed",
        consecutive_failures: fails,
      })
    }
  }

  return totals
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

    const results = await mapWithConcurrency(eligible, 5, async (c) => {
      const tier: PlanTier = normalizePlanTier(c.subscription_tier ?? undefined)
      try {
        const stats = await processCompanyTelemetry(c.id, tier)
        return { companyId: c.id, ...stats, error: null as string | null }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "company_sync_failed"
        Sentry.captureException(e)
        return { companyId: c.id, devices: 0, inserted: 0, skipped: 0, error: msg }
      }
    })

    const aggregate = results.reduce(
      (acc, r) => {
        acc.companies += 1
        acc.devices += r.devices
        acc.inserted += r.inserted
        acc.skipped += r.skipped
        if (r.error) acc.errors += 1
        return acc
      },
      { companies: 0, devices: 0, inserted: 0, skipped: 0, errors: 0 },
    )

    return NextResponse.json({
      ok: true,
      eligibleCompanies: eligible.length,
      aggregate,
      sample: results.slice(0, 25),
    })
  } catch (e: unknown) {
    Sentry.captureException(e)
    return NextResponse.json(
      { ok: false, error: errorMessage(e, "sync-eld-telemetry cron failed") },
      { status: 500 },
    )
  }
}
