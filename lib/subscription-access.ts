"use server"

import { cache } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "unknown"

export type CompanySubscriptionAccess = {
  allowed: boolean
  companyId: string | null
  planName: string
  status: SubscriptionStatus
  reason: string | null
}

async function getCompanySubscriptionAccessInternal(): Promise<CompanySubscriptionAccess> {
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

  const admin = createAdminClient()
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select(`
      status,
      trial_end,
      stripe_subscription_id,
      subscription_plans(name)
    `)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

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
  const hasPaidSubscription = Boolean((subscription as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id)

  if (!subscription || planName === "free") {
    return {
      allowed: false,
      companyId: ctx.companyId,
      planName,
      status,
      reason: "A paid subscription is required to continue.",
    }
  }

  if (
    (status === "trialing" && trialExpired && !hasPaidSubscription) ||
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

export const getCompanySubscriptionAccess = cache(getCompanySubscriptionAccessInternal)

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
