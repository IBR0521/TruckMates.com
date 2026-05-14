import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"
import { canonicalEldProvider, type EldProviderCanonical } from "@/lib/eld/provider-normalize"
import { syncHarshEventsForDevice } from "@/lib/eld/harsh-events-sync"
import { syncIdleSessionsForDevice } from "@/lib/eld/idle-sessions-sync"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"

export const maxDuration = 300

type CompanyRow = { id: string; subscription_tier: string | null; subscription_status: string | null }

type SyncCursorRow = {
  company_id: string
  provider: string
  data_type: string
  last_synced_through: string
  consecutive_failures: number
}

function toEldDeviceSyncRow(row: Record<string, unknown>): EldDeviceSyncRow {
  return {
    id: String(row.id ?? ""),
    company_id: String(row.company_id ?? ""),
    truck_id: (row.truck_id as string | null | undefined) ?? null,
    driver_id: (row.driver_id as string | null | undefined) ?? undefined,
    api_key: (row.api_key as string | null | undefined) ?? undefined,
    api_secret: (row.api_secret as string | null | undefined) ?? undefined,
    api_endpoint: (row.api_endpoint as string | null | undefined) ?? undefined,
    provider_device_id: String(row.provider_device_id ?? "").trim(),
    provider: (row.provider as string | null | undefined) ?? null,
    status: (row.status as string | null | undefined) ?? null,
  }
}

async function loadCursor(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  provider: EldProviderCanonical,
  dataType: "harsh_events" | "idle_sessions",
): Promise<SyncCursorRow | null> {
  const { data, error } = await admin
    .from("eld_sync_cursors")
    .select("company_id, provider, data_type, last_synced_through, consecutive_failures")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .eq("data_type", dataType)
    .maybeSingle()
  if (error || !data) return null
  return data as SyncCursorRow
}

async function upsertCursor(
  admin: ReturnType<typeof createAdminClient>,
  patch: {
    company_id: string
    provider: EldProviderCanonical
    data_type: "harsh_events" | "idle_sessions"
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
      data_type: patch.data_type,
      last_synced_through: patch.last_synced_through,
      last_run_at: patch.last_run_at,
      last_error: patch.last_error,
      consecutive_failures: patch.consecutive_failures,
    },
    { onConflict: "company_id,provider,data_type" },
  )
  if (error) {
    Sentry.captureMessage(`eld_sync_cursors upsert failed: ${error.message}`, { level: "warning", extra: patch })
  }
}

async function processCompanyHarshAndIdle(companyId: string, tier: PlanTier): Promise<{
  harsh: { devices: number; inserted: number; skipped: number }
  idle: { devices: number; inserted: number; skipped: number }
}> {
  const admin = createAdminClient()
  const harshOk = hasFeatureAccess(tier, "eld_harsh_events")
  const idleOk = hasFeatureAccess(tier, "eld_idle_tracking")
  if (!harshOk && !idleOk) {
    return { harsh: { devices: 0, inserted: 0, skipped: 0 }, idle: { devices: 0, inserted: 0, skipped: 0 } }
  }

  const { data: deviceRows, error: devErr } = await admin
    .from("eld_devices")
    .select("id, company_id, truck_id, provider, status, provider_device_id, api_key, api_secret, api_endpoint")
    .eq("company_id", companyId)
    .eq("status", "active")

  if (devErr || !deviceRows?.length) {
    return { harsh: { devices: 0, inserted: 0, skipped: 0 }, idle: { devices: 0, inserted: 0, skipped: 0 } }
  }

  const devices = deviceRows
    .map((r) => toEldDeviceSyncRow(r as Record<string, unknown>))
    .filter((d) => d.id && d.company_id && canonicalEldProvider(d.provider))

  const until = new Date()
  const defaultSince = new Date(until.getTime() - 24 * 60 * 60 * 1000)

  const harshTotals = { devices: 0, inserted: 0, skipped: 0 }
  const idleTotals = { devices: 0, inserted: 0, skipped: 0 }

  const byProvider = new Map<EldProviderCanonical, EldDeviceSyncRow[]>()
  for (const d of devices) {
    const p = canonicalEldProvider(d.provider)
    if (!p) continue
    const list = byProvider.get(p) || []
    list.push(d)
    byProvider.set(p, list)
  }

  for (const [provider, list] of byProvider) {
    if (harshOk) {
      const cursorH = await loadCursor(admin, companyId, provider, "harsh_events")
      if (!cursorH || cursorH.consecutive_failures < 5) {
        let sinceH = defaultSince
        if (cursorH?.last_synced_through) {
          const t = new Date(cursorH.last_synced_through).getTime()
          if (Number.isFinite(t)) {
            sinceH = new Date(Math.max(defaultSince.getTime(), t - 5 * 60 * 1000))
          }
        }
        const results = await Promise.all(list.map((d) => syncHarshEventsForDevice(d, sinceH, until)))
        const rate = results.some((r) => r.rateLimited)
        if (rate) {
          await upsertCursor(admin, {
            company_id: companyId,
            provider,
            data_type: "harsh_events",
            last_synced_through: cursorH?.last_synced_through ?? sinceH.toISOString(),
            last_run_at: until.toISOString(),
            last_error: "rate_limited_429",
            consecutive_failures: cursorH?.consecutive_failures ?? 0,
          })
        } else {
          const okSome = results.some((r) => !r.error || r.softSkip)
          const inserted = results.reduce((s, r) => s + r.inserted, 0)
          const skipped = results.reduce((s, r) => s + r.skipped, 0)
          harshTotals.devices += list.length
          harshTotals.inserted += inserted
          harshTotals.skipped += skipped
          if (okSome) {
            await upsertCursor(admin, {
              company_id: companyId,
              provider,
              data_type: "harsh_events",
              last_synced_through: until.toISOString(),
              last_run_at: until.toISOString(),
              last_error: null,
              consecutive_failures: 0,
            })
          } else {
            const fails = (cursorH?.consecutive_failures ?? 0) + 1
            await upsertCursor(admin, {
              company_id: companyId,
              provider,
              data_type: "harsh_events",
              last_synced_through: cursorH?.last_synced_through ?? sinceH.toISOString(),
              last_run_at: until.toISOString(),
              last_error: results.map((r) => r.error).filter(Boolean)[0] ?? "sync_failed",
              consecutive_failures: fails,
            })
          }
        }
      }
    }

    if (idleOk) {
      const cursorI = await loadCursor(admin, companyId, provider, "idle_sessions")
      if (!cursorI || cursorI.consecutive_failures < 5) {
        let sinceI = defaultSince
        if (cursorI?.last_synced_through) {
          const t = new Date(cursorI.last_synced_through).getTime()
          if (Number.isFinite(t)) {
            sinceI = new Date(Math.max(defaultSince.getTime(), t - 5 * 60 * 1000))
          }
        }
        const results = await Promise.all(list.map((d) => syncIdleSessionsForDevice(d, sinceI, until)))
        const rate = results.some((r) => r.rateLimited)
        if (rate) {
          await upsertCursor(admin, {
            company_id: companyId,
            provider,
            data_type: "idle_sessions",
            last_synced_through: cursorI?.last_synced_through ?? sinceI.toISOString(),
            last_run_at: until.toISOString(),
            last_error: "rate_limited_429",
            consecutive_failures: cursorI?.consecutive_failures ?? 0,
          })
        } else {
          const okSome = results.some((r) => !r.error || r.softSkip)
          const inserted = results.reduce((s, r) => s + r.inserted, 0)
          const skipped = results.reduce((s, r) => s + r.skipped, 0)
          idleTotals.devices += list.length
          idleTotals.inserted += inserted
          idleTotals.skipped += skipped
          if (okSome) {
            await upsertCursor(admin, {
              company_id: companyId,
              provider,
              data_type: "idle_sessions",
              last_synced_through: until.toISOString(),
              last_run_at: until.toISOString(),
              last_error: null,
              consecutive_failures: 0,
            })
          } else {
            const fails = (cursorI?.consecutive_failures ?? 0) + 1
            await upsertCursor(admin, {
              company_id: companyId,
              provider,
              data_type: "idle_sessions",
              last_synced_through: cursorI?.last_synced_through ?? sinceI.toISOString(),
              last_run_at: until.toISOString(),
              last_error: results.map((r) => r.error).filter(Boolean)[0] ?? "sync_failed",
              consecutive_failures: fails,
            })
          }
        }
      }
    }
  }

  return { harsh: harshTotals, idle: idleTotals }
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
      return hasFeatureAccess(tier, "eld_harsh_events") || hasFeatureAccess(tier, "eld_idle_tracking")
    })

    const results = await mapWithConcurrency(eligible, 5, async (c) => {
      const tier: PlanTier = normalizePlanTier(c.subscription_tier ?? undefined)
      try {
        const stats = await processCompanyHarshAndIdle(c.id, tier)
        return { companyId: c.id, ...stats, error: null as string | null }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "company_sync_failed"
        Sentry.captureException(e)
        return {
          companyId: c.id,
          harsh: { devices: 0, inserted: 0, skipped: 0 },
          idle: { devices: 0, inserted: 0, skipped: 0 },
          error: msg,
        }
      }
    })

    const aggregate = results.reduce(
      (acc, r) => {
        acc.companies += 1
        acc.harsh_devices += r.harsh.devices
        acc.harsh_inserted += r.harsh.inserted
        acc.harsh_skipped += r.harsh.skipped
        acc.idle_devices += r.idle.devices
        acc.idle_inserted += r.idle.inserted
        acc.idle_skipped += r.idle.skipped
        if (r.error) acc.errors += 1
        return acc
      },
      {
        companies: 0,
        harsh_devices: 0,
        harsh_inserted: 0,
        harsh_skipped: 0,
        idle_devices: 0,
        idle_inserted: 0,
        idle_skipped: 0,
        errors: 0,
      },
    )

    return NextResponse.json({
      ok: true,
      eligibleCompanies: eligible.length,
      aggregate,
      sample: results.slice(0, 20),
    })
  } catch (e: unknown) {
    Sentry.captureException(e)
    return NextResponse.json({ error: "Cron failed" }, { status: 500 })
  }
}
