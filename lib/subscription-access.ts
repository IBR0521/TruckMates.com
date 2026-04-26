"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"

const TEMP_DISABLE_PAYMENT_GATE = true

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "unknown"

export type CompanySubscriptionAccess = {
  allowed: boolean
  companyId: string | null
  planName: string
  status: SubscriptionStatus
  reason: string | null
}

async function ensureFreeSubscriptionRow(companyId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle()

  if (existingError || existing) return

  const { data: freePlan } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("name", "free")
    .maybeSingle()

  if (!freePlan?.id) return

  await admin.from("subscriptions").insert({
    company_id: companyId,
    plan_id: freePlan.id,
    status: "active",
  })
}

export async function getCompanySubscriptionAccess(): Promise<CompanySubscriptionAccess> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return {
      allowed: false,
      companyId: null,
      planName: "free",
      status: "unknown",
      reason: ctx.error || "Not authenticated",
    }
  }

  if (TEMP_DISABLE_PAYMENT_GATE) {
    return {
      allowed: true,
      companyId: ctx.companyId,
      planName: "enterprise",
      status: "active",
      reason: null,
    }
  }

  const admin = createAdminClient()
  let { data: subscription, error } = await admin
    .from("subscriptions")
    .select(`
      status,
      trial_end,
      stripe_subscription_id,
      subscription_plans(name)
    `)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (!subscription && !error) {
    await ensureFreeSubscriptionRow(ctx.companyId)
    const retry = await admin
      .from("subscriptions")
      .select(`
        status,
        trial_end,
        stripe_subscription_id,
        subscription_plans(name)
      `)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    subscription = retry.data
    error = retry.error
  }

  if (error) {
    return {
      allowed: false,
      companyId: ctx.companyId,
      planName: "free",
      status: "unknown",
      reason: error.message || "Failed to fetch subscription",
    }
  }

  const planRaw = (subscription as { subscription_plans?: { name?: string } | { name?: string }[] } | null)?.subscription_plans
  const planName = String((Array.isArray(planRaw) ? planRaw[0]?.name : planRaw?.name) || "free").toLowerCase()
  const status = String((subscription as { status?: string } | null)?.status || "unknown").toLowerCase() as SubscriptionStatus
  const trialEndIso = (subscription as { trial_end?: string | null } | null)?.trial_end
  const trialEndMs = trialEndIso ? new Date(trialEndIso).getTime() : null
  const trialExpired = typeof trialEndMs === "number" && Number.isFinite(trialEndMs) && trialEndMs < Date.now()
  if (!subscription) {
    return {
      allowed: false,
      companyId: ctx.companyId,
      planName: "free",
      status,
      reason: "Subscription not initialized. Please try again.",
    }
  }

  if (
    (status === "trialing" && trialExpired) ||
    status === "past_due" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete"
  ) {
    return {
      allowed: false,
      companyId: ctx.companyId,
      planName,
      status,
      reason: "Subscription inactive. Please update billing to continue.",
    }
  }

  return {
    allowed: true,
    companyId: ctx.companyId,
    planName,
    status,
    reason: null,
  }
}

export async function requireActiveSubscriptionForWrite(): Promise<{
  allowed: boolean
  error: string | null
  planName: string
  status: SubscriptionStatus
}> {
  const access = await getCompanySubscriptionAccess()
  if (!access.allowed) {
    return {
      allowed: false,
      error: access.reason || "Subscription inactive",
      planName: access.planName,
      status: access.status,
    }
  }

  return {
    allowed: true,
    error: null,
    planName: access.planName,
    status: access.status,
  }
}
