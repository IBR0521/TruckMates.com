"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import {
  checkMonthlyUsage,
  checkResourceLimit,
  getCompanyTier,
} from "@/lib/plan-enforcement"
import { getPlanLimits, normalizePlanTier, planTierLabel, type PlanTier } from "@/lib/plan-limits"
import { createCheckout } from "@/lib/billing"

export async function getBillingPlanContext() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from("companies")
    .select("subscription_tier, subscription_status, billing_cycle, trial_ends_at, paddle_subscription_id")
    .eq("id", ctx.companyId)
    .maybeSingle()

  const row = data as {
    subscription_tier?: string | null
    subscription_status?: string | null
    billing_cycle?: string | null
    trial_ends_at?: string | null
    paddle_subscription_id?: string | null
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
      paddle_subscription_id: row?.paddle_subscription_id || null,
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

export async function startPlanCheckout(params: { tier: PlanTier; billingCycle: "monthly" | "annual" }) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    return { error: ctx.error || "Not authenticated", data: null as { checkout_url: string } | null }
  }
  if (!MANAGER_ROLES.has(String(ctx.user.role || ""))) {
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

export async function cancelPaddleBillingSubscription() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { success: false, error: ctx.error || "Not authenticated" }
  }
  const role = String(ctx.user?.role || "")
  if (!["super_admin", "operations_manager"].includes(role)) {
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
