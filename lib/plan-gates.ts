import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"

export type PlanName = "free" | "starter" | "professional" | "enterprise"
export type PlanFeature = "quickbooks" | "api_keys" | "route_optimization"

const PLAN_FEATURES: Record<PlanName, Record<PlanFeature, boolean>> = {
  free: { quickbooks: false, api_keys: false, route_optimization: false },
  starter: { quickbooks: false, api_keys: false, route_optimization: false },
  professional: { quickbooks: true, api_keys: true, route_optimization: true },
  enterprise: { quickbooks: true, api_keys: true, route_optimization: true },
}

function normalizePlanName(input: string | null | undefined): PlanName {
  const value = String(input || "free").toLowerCase()
  if (value === "starter" || value === "professional" || value === "enterprise" || value === "free") {
    return value
  }
  return "free"
}

export function isFeatureAllowedForPlan(plan: PlanName, feature: PlanFeature): boolean {
  return PLAN_FEATURES[plan][feature]
}

export async function getCurrentCompanyPlanName(): Promise<{
  planName: PlanName
  companyId: string | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { planName: "free", companyId: null, error: ctx.error || "Not authenticated" }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("subscriptions")
    .select("subscription_plans!inner(name)")
    .eq("company_id", ctx.companyId)
    .in("status", ["active", "trialing"])
    .maybeSingle()

  if (error) {
    return { planName: "free", companyId: ctx.companyId, error: error.message || "Failed to resolve plan" }
  }

  const planRaw = (data as { subscription_plans?: { name?: string } | { name?: string }[] } | null)?.subscription_plans
  const planName = normalizePlanName(Array.isArray(planRaw) ? planRaw[0]?.name : planRaw?.name)

  return { planName, companyId: ctx.companyId, error: null }
}

export async function getCurrentCompanyFeatureAccess(feature: PlanFeature): Promise<{
  allowed: boolean
  planName: PlanName
  companyId: string | null
  error: string | null
}> {
  const plan = await getCurrentCompanyPlanName()
  if (plan.error || !plan.companyId) {
    return {
      allowed: false,
      planName: plan.planName,
      companyId: plan.companyId,
      error: plan.error || "Not authenticated",
    }
  }

  return {
    allowed: isFeatureAllowedForPlan(plan.planName, feature),
    planName: plan.planName,
    companyId: plan.companyId,
    error: null,
  }
}
