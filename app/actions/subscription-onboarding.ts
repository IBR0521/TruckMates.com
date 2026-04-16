"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { redirect } from "next/navigation"

type PlanName = "starter" | "professional" | "enterprise"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])

export async function startPlanTrial(planName: PlanName) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  if (!MANAGER_ROLES.has(String(ctx.user.role || ""))) {
    return { data: null, error: "Only managers can choose a subscription plan." }
  }

  const planKey = String(planName || "").toLowerCase() as PlanName
  if (!["starter", "professional", "enterprise"].includes(planKey)) {
    return { data: null, error: "Invalid plan selection." }
  }

  const admin = createAdminClient()

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("id, name, display_name")
    .eq("name", planKey)
    .eq("is_active", true)
    .maybeSingle()

  if (planError || !plan?.id) {
    return { data: null, error: "Selected plan is not available right now." }
  }

  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id, status, trial_start, trial_end, stripe_subscription_id")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (existingError) {
    return { data: null, error: existingError.message || "Failed to read subscription state." }
  }

  if (existing?.stripe_subscription_id && existing.status === "active") {
    return { data: null, error: "Your company already has an active paid subscription." }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    company_id: ctx.companyId,
    plan_id: plan.id,
    status: "incomplete",
    trial_start: null,
    trial_end: null,
    current_period_start: nowIso,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    stripe_subscription_id: null,
    stripe_customer_id: null,
    stripe_price_id: null,
  }

  const { error: upsertError } = await admin.from("subscriptions").upsert(payload, {
    onConflict: "company_id",
  })

  if (upsertError) {
    return { data: null, error: upsertError.message || "Failed to save plan selection." }
  }

  return {
    data: {
      plan_name: plan.name,
      plan_display_name: plan.display_name,
      trial_start: null,
      trial_end: null,
      status: "incomplete",
    },
    error: null,
  }
}

export async function startBillingCheckoutSession() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    redirect("/billing/activate?step=payment&error=auth")
  }

  if (!MANAGER_ROLES.has(String(ctx.user.role || ""))) {
    redirect("/billing/activate?step=payment&error=role")
  }

  const admin = createAdminClient()
  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select(`
      id,
      plan_id,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      subscription_plans (
        id,
        name,
        stripe_price_id_monthly,
        stripe_price_id_yearly
      )
    `)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (subscriptionError || !subscription?.plan_id) {
    redirect("/pricing?onboarding=1")
  }

  if (subscription.stripe_subscription_id && subscription.status === "active") {
    redirect("/dashboard")
  }

  const planRaw = (subscription as any)?.subscription_plans
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw
  const priceId = plan?.stripe_price_id_monthly || plan?.stripe_price_id_yearly

  if (!priceId) {
    redirect("/billing/activate?step=payment&error=price")
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    redirect("/billing/activate?step=payment&error=stripe")
  }

  const stripe = (await import("stripe")).default
  const stripeClient = new stripe(secretKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  let customerId = subscription.stripe_customer_id || null
  if (!customerId) {
    const customer = await stripeClient.customers.create({
      email: ctx.user.email || undefined,
      metadata: {
        company_id: ctx.companyId,
        user_id: ctx.userId || "",
      },
    })
    customerId = customer.id
    await admin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("id", subscription.id)
      .eq("company_id", ctx.companyId)
  }

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing/activate?checkout=success`,
    cancel_url: `${appUrl}/billing/activate?step=payment&canceled=1`,
    metadata: {
      company_id: ctx.companyId,
      plan_id: subscription.plan_id,
    },
    subscription_data: {
      metadata: {
        company_id: ctx.companyId,
        plan_id: subscription.plan_id,
      },
    },
  })

  if (!session.url) {
    redirect("/billing/activate?step=payment&error=checkout")
  }

  redirect(session.url)
}
