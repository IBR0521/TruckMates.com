import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  type PlanFeatures,
  type PlanTier,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  hasFeatureAccess,
} from "@/lib/plan-limits"

async function getCompanyTier(companyId: string): Promise<PlanTier> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("companies")
    .select("subscription_tier")
    .eq("id", companyId)
    .maybeSingle()
  const raw = (data as { subscription_tier?: string | null } | null)?.subscription_tier
  return normalizePlanTier(raw ?? undefined)
}

export async function checkResourceLimit(params: {
  companyId: string
  resourceType: "trucks" | "trailers" | "drivers" | "user_seats" | "customers" | "vendors"
}): Promise<{
  allowed: boolean
  current: number
  limit: number
  tier: PlanTier
  error?: string
}> {
  const tier = await getCompanyTier(params.companyId)
  const limits = getPlanLimits(tier)

  const limit =
    limits[
      params.resourceType as keyof Pick<
        typeof limits,
        "trucks" | "trailers" | "drivers" | "user_seats" | "customers" | "vendors"
      >
    ]
  if (isUnlimited(limit)) {
    return { allowed: true, current: 0, limit: -1, tier }
  }

  const admin = createAdminClient()
  let current = 0

  if (params.resourceType === "trucks") {
    const { count } = await admin
      .from("trucks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .eq("status", "active")
    current = count ?? 0
  } else if (params.resourceType === "trailers") {
    // Exclude retired trailers (Schema: trailers.status IN available, in_use, maintenance, out_of_service, retired)
    const { count } = await admin
      .from("trailers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .neq("status", "retired")
    current = count ?? 0
  } else if (params.resourceType === "drivers") {
    // Workforce drivers only — not inactive / on_leave (see app/dashboard/drivers filters)
    const { count } = await admin
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .in("status", ["active", "on_route", "off_duty"])
    current = count ?? 0
  } else if (params.resourceType === "user_seats") {
    // Drivers / mobile-only legacy `user` rows do not consume office seats.
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .not("role", "in", '("driver","user")')
    current = count ?? 0
  } else if (params.resourceType === "customers") {
    const { count } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .eq("status", "active")
    current = count ?? 0
  } else if (params.resourceType === "vendors") {
    const { count } = await admin
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .eq("status", "active")
    current = count ?? 0
  }

  const allowed = current < limit
  return {
    allowed,
    current,
    limit,
    tier,
    error: allowed ? undefined : `Plan limit reached (${current}/${limit}).`,
  }
}

function monthStartUtc(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function checkMonthlyUsage(params: {
  companyId: string
  usageType: "loads" | "sms" | "ai_calls"
}): Promise<{
  allowed: boolean
  used: number
  limit: number
  percentUsed: number
  warningThreshold: boolean
  hardCap: boolean
}> {
  const tier = await getCompanyTier(params.companyId)
  const limits = getPlanLimits(tier)
  const since = monthStartUtc()
  const admin = createAdminClient()

  let limit = 0
  let used = 0

  if (params.usageType === "loads") {
    limit = limits.loads_per_month
    const { count } = await admin
      .from("loads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .gte("created_at", since)
    used = count ?? 0
  } else if (params.usageType === "sms") {
    limit = limits.sms_per_month
    const { count } = await admin
      .from("sms_logs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .gte("created_at", since)
    used = count ?? 0
  } else {
    limit = limits.ai_calls_per_month
    const { count } = await admin
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .gte("created_at", since)
    used = count ?? 0
  }

  if (isUnlimited(limit)) {
    return {
      allowed: true,
      used,
      limit: -1,
      percentUsed: 0,
      warningThreshold: false,
      hardCap: false,
    }
  }

  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const warningThreshold = percentUsed >= 80
  const hardCap = used >= limit
  return {
    allowed: !hardCap,
    used,
    limit,
    percentUsed,
    warningThreshold,
    hardCap,
  }
}

export async function checkFeatureAccess(params: {
  companyId: string
  feature: keyof PlanFeatures
}): Promise<{ allowed: boolean; currentTier: PlanTier }> {
  const tier = await getCompanyTier(params.companyId)
  return {
    allowed: hasFeatureAccess(tier, params.feature),
    currentTier: tier,
  }
}

/** Enforces company document storage vs plan `storage_gb` (documents.file_size bytes). Graceful no-op if unmeasurable. */
export async function checkStorageLimit(params: {
  companyId: string
  additionalBytes: number
}): Promise<{
  allowed: boolean
  currentBytes: number
  limitBytes: number
  tier: PlanTier
  percentUsed: number
  skippedMeasurement?: boolean
}> {
  const tier = await getCompanyTier(params.companyId)
  const limits = getPlanLimits(tier)
  const limitGB = limits.storage_gb

  const additionalBytes = Math.max(0, Math.floor(Number(params.additionalBytes) || 0))

  if (isUnlimited(limitGB)) {
    return {
      allowed: true,
      currentBytes: 0,
      limitBytes: -1,
      tier,
      percentUsed: 0,
    }
  }

  const limitBytes = limitGB * 1024 * 1024 * 1024

  const admin = createAdminClient()

  try {
    const { data, error } = await admin.from("documents").select("file_size").eq("company_id", params.companyId)

    if (error) {
      Sentry.captureMessage(`checkStorageLimit: documents aggregation skipped (${error.message})`, "warning")
      return {
        allowed: true,
        currentBytes: 0,
        limitBytes,
        tier,
        percentUsed: 0,
        skippedMeasurement: true,
      }
    }

    const usageBeforeBytes = (data || []).reduce((sum, row) => sum + (Number((row as { file_size?: unknown }).file_size) || 0), 0)
    const projectedBytes = usageBeforeBytes + additionalBytes
    const percentUsed =
      limitBytes > 0 ? Math.min(100, Math.round((projectedBytes / limitBytes) * 100)) : 0

    return {
      allowed: projectedBytes <= limitBytes,
      /** Total bytes after hypothetical upload — matches enforcement decision. */
      currentBytes: projectedBytes,
      limitBytes,
      tier,
      percentUsed,
    }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return {
      allowed: true,
      currentBytes: 0,
      limitBytes,
      tier,
      percentUsed: 0,
      skippedMeasurement: true,
    }
  }
}

export { getCompanyTier }
