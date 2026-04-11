"use server"

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import {
  mapBillableUsageToCategory,
  mapUsageActionToCategory,
  monthlyLimitForPlan,
  type GoogleUsageCategory,
} from "@/lib/api-usage-plan-limits"

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function actionsForCategory(category: GoogleUsageCategory): string[] {
  switch (category) {
    case "directions":
      return ["directions", "optimize_route"]
    case "geocoding":
      return ["geocoding", "reverse_geocode"]
    case "distance_matrix":
      return ["distance_matrix"]
    case "places":
      return ["place_details", "places_autocomplete"]
    case "toll_routing":
      return ["toll_cost_estimate"]
    default:
      return []
  }
}

async function activePlanNameForCompany(companyId: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("subscriptions")
      .select(`plan_id, subscription_plans!inner(name)`)
      .eq("company_id", companyId)
      .in("status", ["active", "trialing"])
      .maybeSingle()

    const row = data as { subscription_plans?: { name?: string } | null } | null
    return row?.subscription_plans?.name?.toLowerCase() ?? null
  } catch {
    return null
  }
}

async function countMonthUsage(companyId: string, category: GoogleUsageCategory): Promise<number> {
  const admin = createAdminClient()
  const start = new Date()
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  const actions = actionsForCategory(category)
  if (actions.length === 0) return 0

  let q = admin
    .from("api_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("action", actions)
    .gte("created_at", start.toISOString())

  if (category === "toll_routing") {
    q = q.eq("api_name", "tollguru")
  }

  const { count, error } = await q

  if (error) {
    Sentry.captureMessage(`[api_usage] count failed: ${error.message}`, "warning")
    return 0
  }
  return count ?? 0
}

async function quotaEmailAlreadySent(
  companyId: string,
  category: GoogleUsageCategory,
  level: "80" | "100",
  month: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const key = `quota_email:${level}:${companyId}:${category}:${month}`
  const { data } = await admin.from("api_cache").select("key").eq("key", key).maybeSingle()
  return !!data
}

async function markQuotaEmailSent(
  companyId: string,
  category: GoogleUsageCategory,
  level: "80" | "100",
  month: string,
) {
  const admin = createAdminClient()
  const key = `quota_email:${level}:${companyId}:${category}:${month}`
  const expiresAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
  await admin.from("api_cache").upsert({
    key,
    data: { sent: true },
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })
}

async function sendQuotaEmailToManagers(params: {
  companyId: string
  level: "80" | "100"
  category: GoogleUsageCategory
  used: number
  limit: number
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const admin = createAdminClient()
  const { data: users } = await admin
    .from("users")
    .select("email, full_name, role")
    .eq("company_id", params.companyId)
    .in("role", ["super_admin", "operations_manager"])

  const emails = (users || [])
    .map((u: { email: string | null }) => u.email)
    .filter((e): e is string => !!e && e.includes("@"))

  if (emails.length === 0) return

  const { Resend } = await import("resend")
  const resend = new Resend(apiKey)
  const subject =
    params.level === "80"
      ? `TruckMates: approaching monthly ${params.category} API limit`
      : `TruckMates: monthly ${params.category} API limit reached`
  const detail =
    params.category === "toll_routing"
      ? "toll routing (TollGuru / logged toll estimates)"
      : `Google Maps (${params.category})`
  const body = `
    <p>Your fleet used <strong>${params.used}</strong> of <strong>${params.limit}</strong> included monthly calls for <strong>${detail}</strong>.</p>
    <p>Monthly quotas for Maps and toll routing are <strong>enforced</strong> (new API calls are blocked when over limit until next month or upgrade).</p>
  `

  const from = process.env.RESEND_FROM_EMAIL || "TruckMates <onboarding@resend.dev>"
  for (const to of emails) {
    await resend.emails.send({ from, to, subject, html: body })
  }
}

async function maybeNotifyQuota(companyId: string, action: string, apiName?: string) {
  const category = apiName
    ? mapBillableUsageToCategory(apiName, action)
    : mapUsageActionToCategory(action)
  if (!category) return

  const plan = await activePlanNameForCompany(companyId)
  const limit = monthlyLimitForPlan(plan, category)
  if (limit >= 9_000_000) return

  const used = await countMonthUsage(companyId, category)
  const month = monthKey()

  if (used >= Math.ceil(limit * 0.8) && used < limit) {
    if (!(await quotaEmailAlreadySent(companyId, category, "80", month))) {
      await sendQuotaEmailToManagers({ companyId, level: "80", category, used, limit })
      await markQuotaEmailSent(companyId, category, "80", month)
    }
  }

  if (used >= limit) {
    if (!(await quotaEmailAlreadySent(companyId, category, "100", month))) {
      await sendQuotaEmailToManagers({ companyId, level: "100", category, used, limit })
      await markQuotaEmailSent(companyId, category, "100", month)
    }
  }
}

const UNLIMITED_THRESHOLD = 8_000_000

/**
 * Hard block for monthly Google Maps usage (directions, geocoding, etc.) before billing a new call.
 * Cached route hits do not consume quota (no record).
 */
export async function assertMonthlyGoogleMapsActionAllowed(
  companyId: string,
  action: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const category = mapUsageActionToCategory(action)
  if (!category || category === "toll_routing") return { allowed: true }

  const plan = await activePlanNameForCompany(companyId)
  const limit = monthlyLimitForPlan(plan, category)
  if (limit >= UNLIMITED_THRESHOLD) return { allowed: true }

  const used = await countMonthUsage(companyId, category)
  if (used >= limit) {
    return {
      allowed: false,
      reason: `Monthly ${category} API limit (${limit}) reached for your plan. Upgrade or try again next month.`,
    }
  }
  return { allowed: true }
}

/** Hard block before logging a toll routing billable event. */
export async function assertMonthlyTollRoutingAllowed(
  companyId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const category: GoogleUsageCategory = "toll_routing"
  const plan = await activePlanNameForCompany(companyId)
  const limit = monthlyLimitForPlan(plan, category)
  if (limit >= UNLIMITED_THRESHOLD) return { allowed: true }

  const used = await countMonthUsage(companyId, category)
  if (used >= limit) {
    return {
      allowed: false,
      reason: `Monthly toll routing limit (${limit}) reached for your plan. Upgrade or try again next month.`,
    }
  }
  return { allowed: true }
}

/**
 * Persist one billable Google Maps call. Monthly quota for this action is enforced
 * in `assertMonthlyGoogleMapsActionAllowed` before new API calls (e.g. directions).
 */
export async function recordBillableGoogleMapsUsage(companyId: string, action: string) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("api_usage_log").insert({
      company_id: companyId,
      api_name: "google_maps",
      action,
      success: true,
    })
    if (error) {
      Sentry.captureMessage(`[api_usage] insert failed: ${error.message}`, "warning")
      return
    }
    void maybeNotifyQuota(companyId, action)
  } catch (e) {
    Sentry.captureException(e)
  }
}

/** Generic usage logger for non-Google providers (e.g. TollGuru). Quota notifications use `mapBillableUsageToCategory`. */
export async function recordBillableApiUsage(companyId: string, apiName: string, action: string) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("api_usage_log").insert({
      company_id: companyId,
      api_name: apiName,
      action,
      success: true,
    })
    if (error) {
      Sentry.captureMessage(`[api_usage] ${apiName} insert failed: ${error.message}`, "warning")
      return
    }
    void maybeNotifyQuota(companyId, action, apiName)
  } catch (e) {
    Sentry.captureException(e)
  }
}

/** Pre-flight for Places UI: block before calling Google when quota is exhausted. */
export async function assertPlacesUsageAllowedForSession(
  kind: "autocomplete" | "details",
): Promise<{ allowed: boolean; reason?: string }> {
  const ctx = await getCachedAuthContext()
  if (!ctx.companyId) {
    return { allowed: false, reason: "Not authenticated" }
  }
  const action = kind === "autocomplete" ? "places_autocomplete" : "place_details"
  return assertMonthlyGoogleMapsActionAllowed(ctx.companyId, action)
}

/** Called from client after debounced Places predictions / details (session-bound company). */
export async function recordClientPlacesUsageForSession(
  kind: "autocomplete" | "details",
): Promise<{ allowed: boolean; reason?: string }> {
  const ctx = await getCachedAuthContext()
  if (!ctx.companyId) {
    return { allowed: false, reason: "Not authenticated" }
  }
  const action = kind === "autocomplete" ? "places_autocomplete" : "place_details"
  const gate = await assertMonthlyGoogleMapsActionAllowed(ctx.companyId, action)
  if (!gate.allowed) {
    return { allowed: false, reason: gate.reason }
  }
  await recordBillableGoogleMapsUsage(ctx.companyId, action)
  return { allowed: true }
}
