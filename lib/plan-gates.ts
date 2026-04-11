import { getCachedAuthContext } from "@/lib/auth/server"
import { getCompanySubscriptionAccess } from "@/lib/subscription-access"

export type PlanName = "free" | "starter" | "professional" | "enterprise"
export type PlanFeature =
  | "quickbooks"
  | "api_keys"
  | "route_optimization"
  | "geofencing"
  | "driver_scorecards"
  | "predictive_maintenance"
  | "crm"

const PLAN_FEATURES: Record<PlanName, Record<PlanFeature, boolean>> = {
  free: {
    quickbooks: false,
    api_keys: false,
    route_optimization: false,
    geofencing: false,
    driver_scorecards: false,
    predictive_maintenance: false,
    crm: false,
  },
  starter: {
    quickbooks: false,
    api_keys: false,
    route_optimization: false,
    geofencing: false,
    driver_scorecards: false,
    predictive_maintenance: false,
    crm: false,
  },
  professional: {
    quickbooks: true,
    api_keys: true,
    route_optimization: true,
    geofencing: true,
    driver_scorecards: true,
    predictive_maintenance: true,
    crm: true,
  },
  enterprise: {
    quickbooks: true,
    api_keys: true,
    route_optimization: true,
    geofencing: true,
    driver_scorecards: true,
    predictive_maintenance: true,
    crm: true,
  },
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

  const access = await getCompanySubscriptionAccess()
  const normalized = normalizePlanName(access.planName)

  if (!access.allowed) {
    return {
      planName: normalized,
      companyId: access.companyId,
      error: access.reason || "Subscription inactive",
    }
  }

  return { planName: normalized, companyId: access.companyId, error: null }
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
