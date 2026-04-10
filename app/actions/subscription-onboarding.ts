"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"

type PlanName = "starter" | "professional" | "enterprise"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])
const TRIAL_DAYS = 14

function trialWindow() {
  const start = new Date()
  const end = new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

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

  const now = Date.now()
  const trialEndMs = existing?.trial_end ? new Date(existing.trial_end).getTime() : null

  if (existing?.stripe_subscription_id && existing.status === "active") {
    return { data: null, error: "Your company already has an active paid subscription." }
  }

  // One trial window per company to prevent repeated resets.
  if (existing?.trial_start && trialEndMs && now > trialEndMs) {
    return {
      data: null,
      error: "Your 14-day trial has ended. Please add a payment method to continue.",
    }
  }

  const { start, end } = trialWindow()
  const payload = {
    company_id: ctx.companyId,
    plan_id: plan.id,
    status: "trialing",
    trial_start: start,
    trial_end: end,
    current_period_start: start,
    current_period_end: end,
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
    return { data: null, error: upsertError.message || "Failed to start trial." }
  }

  return {
    data: {
      plan_name: plan.name,
      plan_display_name: plan.display_name,
      trial_start: start,
      trial_end: end,
      status: "trialing",
    },
    error: null,
  }
}
