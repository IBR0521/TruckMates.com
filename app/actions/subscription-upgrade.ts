"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"

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

  const currentPlan = Array.isArray((subscription as any)?.subscription_plans)
    ? (subscription as any)?.subscription_plans?.[0]
    : (subscription as any)?.subscription_plans
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

  const candidates = (plans || []).filter((p: any) => planOrder(String(p.name)) >= planOrder(minTarget))
  const target = candidates.find((p: any) => planOrder(String(p.name)) > planOrder(currentPlanName)) || candidates[0] || null
  if (!target) return { error: "No upgrade plan available", data: null }

  const targetPrice = Number((target as any).price_monthly || 0)
  const unlocks = Array.isArray((target as any).features) ? (target as any).features.map(String).slice(0, 6) : []
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
        id: String((target as any).id),
        name: String((target as any).name),
        display_name: String((target as any).display_name || (target as any).name),
        price_monthly: targetPrice,
      },
      price_difference_monthly: Math.max(0, targetPrice - currentPrice),
      unlocks,
    },
  }
}

export async function createUpgradeCheckoutSession(feature: UpgradeFeatureKey, targetPlanName?: PlanName) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) return { error: ctx.error || "Not authenticated", data: null }
  if (!MANAGER_ROLES.has(String(ctx.user.role || ""))) {
    return { error: "Only managers can upgrade plans.", data: null }
  }

  const requestedPlan = targetPlanName || FEATURE_TARGET_PLAN[feature]
  const admin = createAdminClient()
  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("id, name, stripe_price_id_monthly")
    .eq("name", requestedPlan)
    .eq("is_active", true)
    .maybeSingle()
  if (planError || !plan?.id || !plan.stripe_price_id_monthly) {
    return { error: "Target plan is unavailable for checkout.", data: null }
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return { error: "Stripe is not configured.", data: null }
  const stripe = (await import("stripe")).default
  const stripeClient = new stripe(stripeKey)

  let customerId = subscription?.stripe_customer_id || null
  if (!customerId) {
    const customer = await stripeClient.customers.create({
      email: ctx.user.email || undefined,
      metadata: { company_id: ctx.companyId, user_id: ctx.userId || "" },
    })
    customerId = customer.id
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId || undefined,
    line_items: [{ price: String(plan.stripe_price_id_monthly), quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/settings/billing?canceled=1`,
    metadata: {
      company_id: ctx.companyId,
      plan_id: plan.id,
      feature,
    },
    subscription_data: {
      metadata: {
        company_id: ctx.companyId,
        plan_id: plan.id,
        feature,
      },
    },
  })

  if (!session.url) return { error: "Failed to start checkout.", data: null }

  await admin.from("subscriptions").upsert(
    {
      company_id: ctx.companyId,
      plan_id: plan.id,
      stripe_customer_id: customerId,
      status: "incomplete",
    },
    { onConflict: "company_id" },
  )

  return { error: null, data: { checkout_url: session.url } }
}
