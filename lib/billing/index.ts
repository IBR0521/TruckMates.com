import type { PlanTier } from "@/lib/plan-limits"
import * as paddle from "./paddle"

export type BillingProvider = "paddle" | "stripe"

function provider(): BillingProvider {
  const p = String(process.env.BILLING_PROVIDER || "paddle").toLowerCase()
  if (p === "stripe") return "stripe"
  return "paddle"
}

/** Unified checkout — defaults to Paddle; Stripe code stays in-repo and can be re-wired here when BILLING_PROVIDER=stripe. */
export async function createCheckout(params: {
  companyId: string
  tier: PlanTier
  billingCycle: "monthly" | "annual"
}): Promise<{ checkoutUrl: string | null; error: string | null }> {
  if (provider() === "paddle") {
    return paddle.createPaddleCheckout(params)
  }
  return {
    checkoutUrl: null,
    error:
      "Stripe billing is disabled for this deployment. Keep Stripe modules for a future US entity, or set BILLING_PROVIDER=paddle.",
  }
}

export async function getSubscription(externalId: string) {
  if (provider() === "paddle") {
    return paddle.getPaddleSubscription(externalId)
  }
  return { data: null, error: "Stripe subscription fetch not configured in billing index." }
}

export async function cancelSubscription(externalId: string) {
  if (provider() === "paddle") {
    return paddle.cancelPaddleSubscription(externalId)
  }
  return { success: false, error: "Stripe cancel path not enabled. Use BILLING_PROVIDER=paddle or extend lib/billing/index.ts." }
}

export async function changePlan(params: {
  paddleSubscriptionId: string
  newTier: PlanTier
  newBillingCycle: "monthly" | "annual"
}) {
  if (provider() === "paddle") {
    return paddle.changePaddlePlan(params)
  }
  return { success: false, error: "Stripe plan change not enabled in billing index." }
}
