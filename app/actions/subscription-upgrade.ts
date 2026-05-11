"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createCheckout } from "@/lib/billing"
import type { PlanTier } from "@/lib/plan-limits"
import { mapLegacyRole } from "@/lib/roles"

type UpgradeFeatureKey =
  | "drivers_limit"
  | "vehicles_limit"
  | "users_limit"
  | "api_keys"
  | "quickbooks"
  | "edi"
  | "hazmat"
  | "crm"
  | "geofencing"
  | "driver_scorecards"
  | "route_optimization"
type PlanName = "starter" | "professional" | "enterprise"

const FEATURE_TARGET_PLAN: Record<UpgradeFeatureKey, PlanName> = {
  drivers_limit: "professional",
  vehicles_limit: "professional",
  users_limit: "professional",
  api_keys: "professional",
  quickbooks: "professional",
  edi: "professional",
  hazmat: "professional",
  crm: "professional",
  geofencing: "professional",
  driver_scorecards: "professional",
  route_optimization: "professional",
}

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])

type SubscriptionPlanSummary = {
  name?: string | null
  display_name?: string | null
  price_monthly?: number | string | null
}

type UpgradePlanCandidate = {
  id?: string | null
  name?: string | null
  display_name?: string | null
  price_monthly?: number | string | null
  features?: unknown
}

function planOrder(name: string) {
  if (name === "free") return 0
  if (name === "starter") return 1
  if (name === "professional") return 2
  if (name === "enterprise") return 3
  return 0
}

export async function getUpgradeOffer(feature: UpgradeFeatureKey) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) return { error: ctx.error || "Not authenticated", data: null }

  const admin = createAdminClient()
  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .select("plan_id, subscription_plans(name, display_name, price_monthly)")
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (subError) return { error: subError.message, data: null }

  const subscriptionPlans = (subscription as { subscription_plans?: SubscriptionPlanSummary | SubscriptionPlanSummary[] | null } | null)?.subscription_plans
  const currentPlan = Array.isArray(subscriptionPlans) ? subscriptionPlans[0] : subscriptionPlans
  const currentPlanName = String(currentPlan?.name || "free")
  const currentPrice = Number(currentPlan?.price_monthly || 0)

  const minTarget = FEATURE_TARGET_PLAN[feature]
  const { data: plans, error: plansError } = await admin
    .from("subscription_plans")
    .select("id, name, display_name, price_monthly, stripe_price_id_monthly, features")
    .eq("is_active", true)
    .in("name", ["starter", "professional", "enterprise"])
    .order("price_monthly", { ascending: true })
  if (plansError) return { error: plansError.message, data: null }

  const candidates = ((plans || []) as UpgradePlanCandidate[]).filter((p) => planOrder(String(p.name)) >= planOrder(minTarget))
  const target = candidates.find((p) => planOrder(String(p.name)) > planOrder(currentPlanName)) || candidates[0] || null
  if (!target) return { error: "No upgrade plan available", data: null }

  const targetPrice = Number(target.price_monthly || 0)
  const unlocks = Array.isArray(target.features) ? target.features.map(String).slice(0, 6) : []
  return {
    error: null,
    data: {
      feature,
      current_plan: {
        name: currentPlanName,
        display_name: String(currentPlan?.display_name || currentPlanName),
        price_monthly: currentPrice,
      },
      target_plan: {
        id: String(target.id),
        name: String(target.name),
        display_name: String(target.display_name || target.name),
        price_monthly: targetPrice,
      },
      price_difference_monthly: Math.max(0, targetPrice - currentPrice),
      unlocks,
    },
  }
}

const PLAN_NAME_TO_TIER: Record<PlanName, PlanTier> = {
  starter: "starter",
  professional: "professional",
  enterprise: "enterprise",
}

export async function createUpgradeCheckoutSession(feature: UpgradeFeatureKey, targetPlanName?: PlanName) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) return { error: ctx.error || "Not authenticated", data: null }
  if (!MANAGER_ROLES.has(mapLegacyRole(ctx.user.role))) {
    return { error: "Only managers can upgrade plans.", data: null }
  }

  const requestedPlan = targetPlanName || FEATURE_TARGET_PLAN[feature]
  const tier: PlanTier = PLAN_NAME_TO_TIER[requestedPlan] ?? "professional"

  const checkout = await createCheckout({
    companyId: ctx.companyId,
    tier,
    billingCycle: "monthly",
  })

  if (checkout.error || !checkout.checkoutUrl) {
    return { error: checkout.error || "Checkout unavailable", data: null }
  }

  return { error: null, data: { checkout_url: checkout.checkoutUrl } }
}
