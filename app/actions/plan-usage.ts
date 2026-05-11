"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import {
  checkFeatureAccess,
  checkMonthlyUsage,
  checkResourceLimit,
  getCompanyTier,
} from "@/lib/plan-enforcement"
import {
  getPlanLimits,
  isUnlimited,
  minimumTierForFeature,
  nextPlanTier,
  normalizePlanTier,
  planTierLabel,
  type PlanFeatures,
  type PlanTier,
} from "@/lib/plan-limits"
import { createCheckout, createCustomerPortalSession } from "@/lib/billing"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"

export async function getBillingPlanContext() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from("companies")
    .select(
      "subscription_tier, subscription_status, billing_cycle, trial_ends_at, subscription_ends_at, paddle_subscription_id, paddle_customer_id",
    )
    .eq("id", ctx.companyId)
    .maybeSingle()

  const row = data as {
    subscription_tier?: string | null
    subscription_status?: string | null
    billing_cycle?: string | null
    trial_ends_at?: string | null
    subscription_ends_at?: string | null
    paddle_subscription_id?: string | null
    paddle_customer_id?: string | null
  } | null

  const tier = normalizePlanTier(row?.subscription_tier ?? undefined)

  return {
    error: null,
    data: {
      tier,
      tierLabel: planTierLabel(tier),
      subscription_status: row?.subscription_status || "trial",
      billing_cycle: row?.billing_cycle || "monthly",
      trial_ends_at: row?.trial_ends_at || null,
      subscription_ends_at: row?.subscription_ends_at || null,
      paddle_subscription_id: row?.paddle_subscription_id || null,
      paddle_customer_id: row?.paddle_customer_id || null,
    },
  }
}

export async function getCompanyPlanUsageSnapshot() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const cid = ctx.companyId
  const tier = await getCompanyTier(cid)
  const limits = getPlanLimits(tier)

  const [loads, sms, ai, trucks, trailers, drivers, seats, customers, vendors] = await Promise.all([
    checkMonthlyUsage({ companyId: cid, usageType: "loads" }),
    checkMonthlyUsage({ companyId: cid, usageType: "sms" }),
    checkMonthlyUsage({ companyId: cid, usageType: "ai_calls" }),
    checkResourceLimit({ companyId: cid, resourceType: "trucks" }),
    checkResourceLimit({ companyId: cid, resourceType: "trailers" }),
    checkResourceLimit({ companyId: cid, resourceType: "drivers" }),
    checkResourceLimit({ companyId: cid, resourceType: "user_seats" }),
    checkResourceLimit({ companyId: cid, resourceType: "customers" }),
    checkResourceLimit({ companyId: cid, resourceType: "vendors" }),
  ])

  return {
    error: null,
    data: {
      tier,
      tierLabel: planTierLabel(tier),
      limits,
      metered: { loads, sms, ai },
      resources: { trucks, trailers, drivers, user_seats: seats, customers, vendors },
    },
  }
}

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])

const AI_QUOTA_BANNER_ROLES = new Set<EmployeeRole>(["super_admin", "operations_manager"])

/** Dashboard AI quota banners: operations + super admins only (not dispatchers/drivers). */
export async function getAiQuotaBannerContext() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = mapLegacyRole(ctx.user?.role)
  if (!AI_QUOTA_BANNER_ROLES.has(role)) {
    return {
      error: null,
      data: { eligible: false as const },
    }
  }

  const companyId = ctx.companyId
  const tier = await getCompanyTier(companyId)
  const limits = getPlanLimits(tier)
  if (isUnlimited(limits.ai_calls_per_month)) {
    return { error: null, data: { eligible: false as const } }
  }

  const ai = await checkMonthlyUsage({ companyId, usageType: "ai_calls" })
  const nextTier = nextPlanTier(tier)
  let nextAiCalls: number | null = null
  if (nextTier) {
    const nl = getPlanLimits(nextTier).ai_calls_per_month
    nextAiCalls = typeof nl === "number" && nl > 0 && !isUnlimited(nl) ? nl : null
  }

  return {
    error: null,
    data: {
      eligible: true as const,
      tier,
      tierLabel: planTierLabel(tier),
      nextTier,
      nextTierLabel: nextTier ? planTierLabel(nextTier) : null,
      nextTierAiCalls: nextAiCalls,
      ai,
    },
  }
}

export async function startPlanCheckout(params: { tier: PlanTier; billingCycle: "monthly" | "annual" }) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    return { error: ctx.error || "Not authenticated", data: null as { checkout_url: string } | null }
  }
  const mappedRole = mapLegacyRole(ctx.user.role)
  if (!MANAGER_ROLES.has(mappedRole)) {
    return { error: "Only managers can change plans.", data: null }
  }
  const res = await createCheckout({
    companyId: ctx.companyId,
    tier: params.tier,
    billingCycle: params.billingCycle,
  })
  if (res.error || !res.checkoutUrl) {
    return { error: res.error || "Checkout unavailable", data: null }
  }
  return { error: null, data: { checkout_url: res.checkoutUrl } }
}

export async function getPlanFeatureGate(feature: keyof PlanFeatures) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature })
  return {
    error: null,
    data: {
      allowed: gate.allowed,
      currentTier: gate.currentTier,
      minimumTier: minimumTierForFeature(feature),
    },
  }
}

/** Opens Paddle-hosted customer portal (manage payment method, invoices, subscription). */
export async function openPaddleBillingPortal(): Promise<{ portalUrl: string | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    return { portalUrl: null, error: ctx.error || "Not authenticated" }
  }
  const portalRole = mapLegacyRole(ctx.user.role)
  if (!MANAGER_ROLES.has(portalRole)) {
    return { portalUrl: null, error: "Only managers can manage billing." }
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from("companies")
    .select("paddle_customer_id, paddle_subscription_id")
    .eq("id", ctx.companyId)
    .maybeSingle()
  const row = data as { paddle_customer_id?: string | null; paddle_subscription_id?: string | null } | null
  const customerId = row?.paddle_customer_id?.trim()
  if (!customerId) {
    return {
      portalUrl: null,
      error: "Add a subscription first (checkout creates your Paddle profile), or contact support.",
    }
  }
  const subscriptionIds =
    typeof row?.paddle_subscription_id === "string" && row.paddle_subscription_id.trim()
      ? [row.paddle_subscription_id.trim()]
      : undefined
  return createCustomerPortalSession({ customerId, subscriptionIds })
}

export async function cancelPaddleBillingSubscription() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { success: false, error: ctx.error || "Not authenticated" }
  }
  const cancelRole = mapLegacyRole(ctx.user?.role)
  if (!MANAGER_ROLES.has(cancelRole)) {
    return { success: false, error: "Only managers can cancel the subscription." }
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from("companies")
    .select("paddle_subscription_id")
    .eq("id", ctx.companyId)
    .maybeSingle()
  const subId = (data as { paddle_subscription_id?: string | null } | null)?.paddle_subscription_id
  if (!subId) {
    return { success: false, error: "No Paddle subscription on file." }
  }
  const { cancelSubscription } = await import("@/lib/billing")
  return cancelSubscription(subId)
}
